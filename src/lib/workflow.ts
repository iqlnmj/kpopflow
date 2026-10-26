import { Prisma } from "@prisma/client";
import { db } from "./db";
import { ai, demoScript } from "./ai";
import {
  scriptOutput,
  timelineOutput,
  requireGate,
  comparisonSchema,
} from "./contracts";
type Tx = Prisma.TransactionClient;
export const include = {
  scripts: { orderBy: { createdAt: "asc" as const } },
  timelines: { orderBy: { createdAt: "asc" as const } },
  revisions: {
    orderBy: { number: "asc" as const },
    include: { reports: { orderBy: { createdAt: "desc" as const } } },
  },
  sources: true,
  events: { orderBy: { createdAt: "desc" as const }, take: 80 },
  approvals: true,
  jobs: { orderBy: { createdAt: "desc" as const }, take: 30 },
};
export async function lock(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${id} FOR UPDATE`;
  const p = await tx.project.findUnique({ where: { id }, include });
  if (!p) throw new Error("Project tidak ditemukan.");
  return p;
}
export async function event(
  tx: Tx,
  id: string,
  action: string,
  detail: string,
) {
  await tx.auditEvent.create({ data: { projectId: id, action, detail } });
  await tx.project.update({ where: { id }, data: { updatedAt: new Date() } });
}
export async function command(
  id: string,
  action: string,
  input: Record<string, unknown>,
) {
  return db.$transaction(
    async (tx) => {
      const p = await lock(tx, id);
      if (p.finalRevisionId && action !== "reopen")
        throw new Error(
          "Project sudah final. Buka kembali secara eksplisit untuk mengubahnya.",
        );
      const latestId = p.scripts.filter((s) => s.language === "id").at(-1),
        latestEn = p.scripts.filter((s) => s.language === "en").at(-1);
      const context = {
        project: {
          title: p.title,
          artist: p.artist,
          category: p.category,
          topic: p.topic,
          targetDuration: p.targetDuration,
        },
        sources: p.sources,
        preferences: {
          draft: "Indonesian",
          narration: "American English",
          wpm: 150,
          tone: "Curious, engaging, informative",
          avoid: "Rumors, filler, generic openings",
        },
        approvedIndonesian: p.scripts.find((s) => s.id === p.idApproved)?.text,
        approvedEnglish: p.scripts.find((s) => s.id === p.enApproved)?.text,
      };
      if (
        ["generate-id", "generate-en", "revise", "save-script"].includes(action)
      ) {
        const language =
          action === "generate-id"
            ? "id"
            : action === "generate-en"
              ? "en"
              : input.language;
        requireGate(
          language === "id" || language === "en",
          "Bahasa tidak valid.",
        );
        const latest = language === "id" ? latestId : latestEn;
        if (language === "en")
          requireGate(
            p.idApproved && p.idApproved === latestId?.id,
            "Setujui versi Indonesia terbaru terlebih dahulu.",
          );
        let text: string,
          demo = false;
        if (action === "save-script") {
          requireGate(
            typeof input.text === "string" &&
              input.text.trim().length >= 10 &&
              input.text.length <= 12000,
            "Script harus 10–12.000 karakter.",
          );
          text = input.text.trim();
          demo = latest?.demo || false;
        } else {
          if (action === "revise")
            requireGate(
              latest &&
                typeof input.instruction === "string" &&
                input.instruction.trim().length > 0 &&
                input.instruction.length <= 2000,
              "Instruksi revisi wajib diisi.",
            );
          const out = await ai(
            action === "revise" ? "revision" : language === "id" ? "id" : "en",
            {
              ...context,
              currentScript: latest?.text,
              instruction: input.instruction,
              language,
            },
            scriptOutput,
            () => ({
              text:
                action === "revise"
                  ? `${latest!.text} ${language === "id" ? "[DEMO: terapkan revisi secara manual.]" : "[DEMO: apply the requested revision manually.]"}`
                  : demoScript(language, p.topic),
            }),
          );
          text = out.data.text;
          demo = out.demo;
        }
        if (language === "en")
          requireGate(
            !/[\r\n]/.test(text) && !/^\s*[#*\-•]/.test(text),
            "Script English harus satu paragraf tanpa heading atau markdown.",
          );
        const s = await tx.scriptVersion.create({
          data: {
            projectId: id,
            language,
            text,
            demo,
            parentId: latest?.id,
            basedOn: language === "en" ? p.idApproved : undefined,
            instruction:
              typeof input.instruction === "string"
                ? input.instruction
                : action,
          },
        });
        await tx.project.update({
          where: { id },
          data:
            language === "id"
              ? {
                  idApproved: null,
                  enApproved: null,
                  status: "INDONESIAN_DRAFT",
                }
              : { enApproved: null, status: "ENGLISH_DRAFT" },
        });
        await event(
          tx,
          id,
          action,
          `Versi ${s.id} (${language}); approval downstream dibatalkan, artifact lama dipertahankan.`,
        );
      } else if (action === "approve-id" || action === "approve-en") {
        const s = action === "approve-id" ? latestId : latestEn;
        requireGate(
          s && s.id === input.scriptId,
          "Pilih versi script terbaru untuk approval.",
        );
        if (action === "approve-en")
          requireGate(
            p.idApproved === latestId?.id && s.basedOn === p.idApproved,
            "English tidak sinkron dengan Indonesia yang disetujui.",
          );
        await tx.project.update({
          where: { id },
          data:
            action === "approve-id"
              ? { idApproved: s.id, status: "INDONESIAN_APPROVED" }
              : { enApproved: s.id, status: "ENGLISH_APPROVED" },
        });
        await tx.approvalEvent.create({
          data: { projectId: id, kind: action, artifactId: s.id },
        });
        await event(tx, id, action, s.id);
      } else if (action === "timeline") {
        requireGate(
          p.enApproved &&
            p.enApproved === latestEn?.id &&
            p.idApproved === latestId?.id,
          "Setujui kedua script terbaru terlebih dahulu.",
        );
        const text = latestEn!.text;
        const out = await ai("timeline", context, timelineOutput, () => {
          const parts = text.match(/[^.!?]+[.!?]*/g) || [text];
          let start = 0;
          return {
            scenes: parts.map((voiceover, i) => {
              const duration =
                (voiceover.trim().split(/\s+/).length / 150) * 60;
              const scene = {
                start,
                end: start + duration,
                voiceover: voiceover.trim(),
                visual:
                  i === 0
                    ? "Hook: tampilkan detail utama"
                    : "Tampilkan bukti visual sesuai kalimat",
                footage: "Cuplikan berizin yang dimasukkan pengguna",
                motion: "Cut langsung; zoom ringan bila relevan",
                overlay: i === 0 ? "LOOK CLOSER" : "",
                subtitle: "Tekankan kata kunci",
                transition: "Hard cut",
                sound: "Tidak wajib",
                purpose:
                  i === 0
                    ? "Hook"
                    : i === parts.length - 1
                      ? "Payoff"
                      : "Context",
              };
              start += duration;
              return scene;
            }),
          };
        });
        requireGate(
          out.data.scenes
            .map((s) => s.voiceover)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim() === text.replace(/\s+/g, " ").trim(),
          "Narasi timeline harus sama dengan English script.",
        );
        await tx.editingTimeline.create({
          data: {
            projectId: id,
            scriptId: p.enApproved,
            scenes: out.data.scenes,
            demo: out.demo,
          },
        });
        await tx.project.update({
          where: { id },
          data: { status: "EDITING_PLAN_READY" },
        });
        await event(tx, id, action, p.enApproved);
      } else if (action === "source") {
        const data = {
          projectId: id,
          name: String(input.name || "").trim(),
          url: String(input.url || ""),
          notes: String(input.notes || ""),
          kind: String(input.kind || "UNVERIFIED"),
          publishedAt: input.publishedAt ? String(input.publishedAt) : null,
        };
        requireGate(
          data.name.length > 0 &&
            data.name.length <= 200 &&
            data.notes.length <= 6000,
          "Nama sumber diperlukan, maksimum 200 karakter; catatan maksimum 6000.",
        );
        const url = new URL(data.url);
        requireGate(
          ["http:", "https:"].includes(url.protocol),
          "URL harus HTTP/HTTPS.",
        );
        requireGate(
          ["UNVERIFIED", "CONFIRMED", "OPINION", "FAN_INTERPRETATION"].includes(
            data.kind!,
          ),
          "Jenis sumber tidak valid.",
        );
        await tx.researchSource.create({ data });
        await event(
          tx,
          id,
          action,
          "Sumber manual ditambahkan; verifikasi oleh pengguna.",
        );
      } else if (action === "review" || action === "compare") {
        const r = p.revisions.find((r) => r.id === input.revisionId);
        requireGate(r, "Revisi tidak ditemukan.");
        requireGate(
          p.enApproved && p.timelines.at(-1)?.scriptId === p.enApproved,
          "Timeline dan approval terbaru diperlukan.",
        );
        if (action === "compare") {
          const old = p.revisions.find((x) => x.id === input.previousId);
          requireGate(
            old && old.number < r.number && old.review && r.review,
            "Pilih dua revisi berurutan waktu yang sudah direview.",
          );
          await tx.videoRevision.update({
            where: { id: r.id },
            data: { comparedToId: old.id },
          });
        }
        const pending = p.jobs.some(
          (j) =>
            j.revisionId === r.id &&
            ["QUEUED", "PROCESSING"].includes(j.status),
        );
        requireGate(!pending, "Job untuk revisi ini masih berjalan.");
        await tx.backgroundJob.create({
          data: { projectId: id, revisionId: r.id, kind: action },
        });
        await tx.project.update({
          where: { id },
          data: { status: "VIDEO_REVIEW_PENDING" },
        });
        await event(tx, id, action, `Queued ${r.id}`);
      } else if (action === "final") {
        const r = p.revisions.find((r) => r.id === input.revisionId);
        const timeline = p.timelines.at(-1);
        requireGate(
          r?.review &&
            p.idApproved === latestId?.id &&
            p.enApproved === latestEn?.id &&
            timeline?.scriptId === p.enApproved,
          "Final memerlukan video yang direview dan approval script/timeline yang sinkron.",
        );
        requireGate(
          r.contextVersion === `${p.idApproved}:${p.enApproved}:${timeline.id}`,
          "Review video perlu diperbarui untuk konteks terbaru.",
        );
        requireGate(
          !p.jobs.some((j) => ["QUEUED", "PROCESSING"].includes(j.status)),
          "Tunggu seluruh job selesai.",
        );
        await tx.project.update({
          where: { id },
          data: { finalRevisionId: r.id, status: "FINAL_APPROVED" },
        });
        await tx.approvalEvent.create({
          data: { projectId: id, kind: "final", artifactId: r.id },
        });
        await event(tx, id, action, r.id);
      } else if (action === "reopen") {
        await tx.project.update({
          where: { id },
          data: { finalRevisionId: null, status: "REVISION_REQUESTED" },
        });
        await event(tx, id, action, "Final dibuka kembali oleh pengguna.");
      } else throw new Error("Action tidak didukung.");
      return tx.project.findUniqueOrThrow({ where: { id }, include });
    },
    { timeout: 180000, maxWait: 10000 },
  );
}
