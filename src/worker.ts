import "dotenv/config";
import { db } from "./lib/db";
import { lock, event } from "./lib/workflow";
import { ai } from "./lib/ai";
import {
  reviewSchema,
  comparisonSchema,
  validateReview,
} from "./lib/contracts";
import { frames, imageInputs, type Metadata, type Frame } from "./lib/media";
import { Prisma } from "@prisma/client";
async function tick() {
  const rows = await db.$queryRaw<
    { id: string }[]
  >`UPDATE "BackgroundJob" SET status='PROCESSING', progress=10, attempts=attempts+1, "updatedAt"=NOW() WHERE id=(SELECT id FROM "BackgroundJob" WHERE status='QUEUED' ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id`;
  if (!rows.length) return false;
  const job = await db.backgroundJob.findUniqueOrThrow({
    where: { id: rows[0].id },
  });
  const heartbeat = setInterval(() => {
    void db.backgroundJob
      .updateMany({
        where: { id: job.id, status: "PROCESSING" },
        data: { updatedAt: new Date() },
      })
      .catch(() => {});
  }, 15000);
  try {
    const p = await db.project.findUniqueOrThrow({
      where: { id: job.projectId },
      include: {
        scripts: true,
        sources: true,
        timelines: { orderBy: { createdAt: "asc" } },
        revisions: true,
      },
    });
    const r = p.revisions.find((v) => v.id === job.revisionId)!;
    const meta = r.metadata as unknown as Metadata;
    const contextVersion = `${p.idApproved}:${p.enApproved}:${p.timelines.at(-1)?.id}`;
    const extracted = await frames(r.storageKey, meta.duration);
    await db.backgroundJob.update({
      where: { id: job.id },
      data: { progress: 50 },
    });
    const context = {
      project: { title: p.title, topic: p.topic, category: p.category },
      sources: p.sources,
      scripts: p.scripts.filter((s) =>
        [p.idApproved, p.enApproved].includes(s.id),
      ),
      timeline: p.timelines.at(-1),
      metadata: meta,
      sampledFrames: extracted.map((f) => f.time),
    };
    let result: Prisma.VideoRevisionUpdateInput;
    if (job.kind === "review") {
      const out = await ai(
        "review",
        context,
        reviewSchema,
        () => ({
          score: 0,
          strengths: [
            "DEMO: metadata dan frame benar-benar diekstrak; penilaian visual belum dilakukan.",
          ],
          findings: [
            {
              start: 0,
              end: Math.min(3, meta.duration),
              category: "Demo fixture",
              severity: "Medium",
              observation: "DEMO — contoh temuan, bukan observasi video ini.",
              evidence:
                "Tidak ada model AI yang menganalisis frame dalam mode demo.",
              recommendation:
                "Aktifkan AI_MODE=live dan jalankan ulang review.",
              confidence: "Low",
            },
          ],
          summary:
            "DEMO — contoh struktur review. Skor 0 adalah placeholder, bukan evaluasi kualitas.",
          ready: false,
          limitations:
            "DEMO: tidak menganalisis isi video. Metadata/frame nyata. Tidak ada audio transcription.",
        }),
        await imageInputs(extracted, "Video"),
      );
      validateReview(out.data, meta.duration);
      result = {
        frames: extracted,
        review: out.data,
        reviewDemo: out.demo,
        contextVersion,
        comparison: Prisma.DbNull,
        comparedToId: null,
      };
    } else {
      const old = p.revisions.find((v) => v.id === r.comparedToId);
      if (!old?.review || !r.review) throw new Error("Dua review diperlukan.");
      const oldFrames = await frames(
        old.storageKey,
        (old.metadata as unknown as Metadata).duration,
      );
      const identical =
        (old.metadata as unknown as Metadata).sha256 === meta.sha256;
      const out = await ai(
        "comparison",
        {
          ...context,
          previousMetadata: old.metadata,
          previousReview: old.review,
          currentReview: r.review,
          identicalBytes: identical,
        },
        comparisonSchema,
        () => ({
          changes: [
            identical
              ? "File identik berdasarkan SHA-256."
              : "File berbeda; isi visual belum dibandingkan oleh AI (DEMO).",
            `Durasi ${(old.metadata as unknown as Metadata).duration.toFixed(2)}s → ${meta.duration.toFixed(2)}s.`,
          ],
          improvements: [],
          regressions: [],
          unresolved: ["DEMO: temuan editorial belum dievaluasi ulang."],
          newIssues: [],
          recommendation:
            "DEMO — lakukan review manual atau jalankan kembali dengan API AI aktif.",
          limitations:
            "Metadata nyata; perbandingan visual merupakan fixture DEMO.",
        }),
        [
          ...(await imageInputs(oldFrames, "A previous")),
          ...(await imageInputs(extracted, "B current")),
        ],
      );
      result = {
        frames: extracted,
        comparison: { ...out.data, demo: out.demo },
        comparedToId: old.id,
      };
    }
    await db.$transaction(async (tx) => {
      const current = await lock(tx, p.id);
      if (current.finalRevisionId)
        throw new Error("Project telah disetujui final.");
      if (
        `${current.idApproved}:${current.enApproved}:${current.timelines.at(-1)?.id}` !==
        contextVersion
      )
        throw new Error("Konteks berubah saat job berjalan. Jalankan ulang.");
      await tx.videoRevision.update({ where: { id: r.id }, data: result });
      await tx.reviewReport.create({
        data: {
          revisionId: r.id,
          kind: job.kind,
          data: (job.kind === "review"
            ? result.review
            : result.comparison) as Prisma.InputJsonValue,
          demo:
            job.kind === "review"
              ? !!result.reviewDemo
              : !!(result.comparison as Record<string, unknown>)?.demo,
          contextVersion,
        },
      });
      await tx.backgroundJob.update({
        where: { id: job.id },
        data: { status: "COMPLETED", progress: 100, error: null },
      });
      await tx.project.update({
        where: { id: p.id },
        data: { status: "VIDEO_REVIEWED" },
      });
      await event(tx, p.id, `job-${job.kind}`, `Completed ${r.id}`);
    });
  } catch (e) {
    await db.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        error: e instanceof Error ? e.message : "Processing gagal",
      },
    });
    console.error(
      "Job failed",
      job.id,
      e instanceof Error ? e.message : "unknown",
    );
  } finally {
    clearInterval(heartbeat);
  }
  return true;
}
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
console.log("K-Shorts durable worker active");
async function main() {
  while (!stopping) {
    try {
      await db.backgroundJob.updateMany({
        where: {
          status: "PROCESSING",
          updatedAt: { lt: new Date(Date.now() - 180000) },
        },
        data: {
          status: "FAILED",
          error: "Worker terputus. Klik review/compare untuk retry.",
        },
      });
      const worked = await tick();
      if (!worked) await new Promise((r) => setTimeout(r, 1500));
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  await db.$disconnect();
}
void main();
