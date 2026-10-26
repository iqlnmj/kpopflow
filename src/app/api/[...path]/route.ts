import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { session, sameOrigin, rateLimit } from "@/lib/auth";
import {
  projectInput,
  topicOutput,
  uploadCheck,
  requireGate,
} from "@/lib/contracts";
import { include, command, lock, event } from "@/lib/workflow";
import { ai, isDemo } from "@/lib/ai";
import { assetPath, probe, storage } from "@/lib/media";
import { mkdir, writeFile, rm, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
type Ctx = { params: Promise<{ path: string[] }> };
async function authorized() {
  return session();
}
const json = (v: unknown, status = 200) =>
  NextResponse.json(v, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(req: Request, ctx: Ctx) {
  if (!(await authorized())) return json({ error: "Login diperlukan" }, 401);
  try {
    const { path: p } = await ctx.params;
    if (p[0] === "status")
      return json({
        mode: process.env.AI_MODE || "unconfigured",
        configured: isDemo() || !!process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      });
    if (p[0] === "projects" && p.length === 1)
      return json(
        await db.project.findMany({
          orderBy: { updatedAt: "desc" },
          include: { _count: { select: { scripts: true, revisions: true } } },
        }),
      );
    if (p[0] === "projects" && p.length === 2) {
      const project = await db.project.findUnique({
        where: { id: p[1] },
        include,
      });
      return project
        ? json(project)
        : json({ error: "Project tidak ditemukan" }, 404);
    }
    if (p[0] === "topics")
      return json(
        await db.topicCandidate.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      );
    if (p[0] === "media" && p.length === 3) {
      const r = await db.videoRevision.findFirst({
        where: { storageKey: p[1] },
      });
      if (!r) return json({ error: "Asset tidak ditemukan" }, 404);
      const file = assetPath(`${p[1]}/${p[2]}`);
      const s = await stat(file);
      const range = req.headers.get("range");
      let start = 0,
        end = s.size - 1,
        partial = false;
      if (range) {
        const m = /^bytes=(\d+)-(\d*)$/.exec(range);
        if (!m)
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${s.size}` },
          });
        start = Number(m[1]);
        end = m[2] ? Number(m[2]) : end;
        if (start > end || end >= s.size)
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${s.size}` },
          });
        partial = true;
      }
      const h: Record<string, string> = {
        "Content-Type": p[2] === "video.mp4" ? "video/mp4" : "image/jpeg",
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      };
      if (partial) h["Content-Range"] = `bytes ${start}-${end}/${s.size}`;
      return new Response(
        Readable.toWeb(
          createReadStream(file, { start, end }),
        ) as ReadableStream,
        { status: partial ? 206 : 200, headers: h },
      );
    }
    return json({ error: "Tidak ditemukan" }, 404);
  } catch (e) {
    console.error(e);
    return json(
      { error: "Tidak dapat membaca data. Periksa database atau asset." },
      500,
    );
  }
}
export async function POST(req: Request, ctx: Ctx) {
  if (!(await authorized())) return json({ error: "Login diperlukan" }, 401);
  if (!sameOrigin(req)) return json({ error: "Origin tidak diizinkan" }, 403);
  try {
    const { path: p } = await ctx.params;
    if (p[0] === "projects" && p.length === 1) {
      const body = await req.json();
      const input = projectInput.parse(body);
      const project = await db.project.create({
        data: {
          ...input,
          demo: isDemo(),
          events: {
            create: {
              action: "create",
              detail: "Topik dipilih secara eksplisit oleh pengguna.",
            },
          },
        },
      });
      return json(project, 201);
    }
    if (p[0] === "topics" && p.length === 1) {
      rateLimit("ai", 12);
      const body = z
        .object({ topic: z.string().max(3000).default("") })
        .parse(await req.json());
      const titles = await db.project.findMany({
        select: { title: true },
        take: 30,
        orderBy: { createdAt: "desc" },
      });
      const out = await ai(
        "topics",
        { customTopic: body.topic, priorProjects: titles },
        topicOutput,
        () => ({
          ideas: [
            {
              title: body.topic
                ? `${body.topic.slice(0, 95)} — sudut cerita`
                : "K-Pop Might Be Returning to Its Roots",
              idolOrGroup: "K-Pop",
              category: "Music commentary",
              summary:
                "DEMO — eksplorasi kontras durasi lagu. Ini ide riset, bukan klaim terverifikasi.",
              hook: "Are longer K-pop songs making a comeback?",
              angle:
                "Bandingkan durasi lagu dengan data resmi sebelum menulis kesimpulan.",
              visualRequirements: "Tracklist resmi dan cuplikan MV berizin.",
              durationEstimate: 35,
              risks: "Data tren dan izin footage belum diverifikasi.",
              confidence: "Unverified",
              distinctiveness:
                "Periksa histori project untuk menghindari pengulangan.",
            },
            {
              title: "IVE Yujin Teleportation Fancam",
              idolOrGroup: "IVE / Yujin",
              category: "Visual mystery",
              summary:
                "DEMO — ide mengulas ilusi pergerakan pada fancam. Belum ada footage.",
              hook: "Did Yujin just teleport?",
              angle: "Lihat konteks dan sudut kamera sebelum menyimpulkan.",
              visualRequirements: "Fancam asli berizin; tidak disertakan.",
              durationEstimate: 30,
              risks: "Cuplikan dan konteks belum tersedia.",
              confidence: "Unverified",
              distinctiveness: "Fokus detail visual, bukan biografi umum.",
            },
            {
              title: "ALLDAY PROJECT Tarzzan Crowd Surfing",
              idolOrGroup: "ALLDAY PROJECT / Tarzzan",
              category: "Unexpected moment",
              summary:
                "DEMO — research lead; kejadian belum diverifikasi dalam aplikasi.",
              hook: "What happened in this crowd moment?",
              angle: "Telusuri urutan kejadian lewat sumber resmi.",
              visualRequirements: "Video sumber berizin.",
              durationEstimate: 32,
              risks: "Jangan mengubah interpretasi fans menjadi fakta.",
              confidence: "Unverified",
              distinctiveness: "Susun micro-story dari satu momen.",
            },
          ],
        }),
      );
      const rows = [];
      for (const data of out.data.ideas)
        rows.push(
          await db.topicCandidate.create({ data: { data, demo: out.demo } }),
        );
      return json(rows);
    }
    if (p[0] === "topics" && p.length === 2) {
      const body = z
        .object({ disposition: z.enum(["SAVED", "REJECTED", "USED"]) })
        .parse(await req.json());
      return json(
        await db.topicCandidate.update({ where: { id: p[1] }, data: body }),
      );
    }
    if (p[0] === "projects" && p.length === 3 && p[2] === "action") {
      const body = z
        .object({
          action: z.string(),
          input: z.record(z.string(), z.unknown()).default({}),
        })
        .parse(await req.json());
      if (
        [
          "generate-id",
          "generate-en",
          "revise",
          "timeline",
          "review",
          "compare",
        ].includes(body.action)
      )
        rateLimit("ai", 12);
      return json(await command(p[1], body.action, body.input));
    }
    if (p[0] === "projects" && p.length === 3 && p[2] === "upload") {
      rateLimit("upload", 6);
      const length = Number(req.headers.get("content-length"));
      requireGate(
        Number.isFinite(length) && length > 0 && length < 101 * 1024 * 1024,
        "Content-Length wajib, maksimal file 100 MB.",
      );
      const form = await req.formData();
      const file = form.get("file");
      requireGate(file instanceof File, "File MP4 wajib.");
      uploadCheck(file.name, file.type, file.size);
      const key = randomUUID();
      await mkdir(storage(), { recursive: true });
      await mkdir(assetPath(key));
      let saved = false;
      try {
        const data = Buffer.from(await file.arrayBuffer());
        await writeFile(assetPath(`${key}/video.mp4`), data, { flag: "wx" });
        const metadata = {
          ...(await probe(assetPath(`${key}/video.mp4`))),
          sha256: createHash("sha256").update(data).digest("hex"),
        };
        const r = await db.$transaction(async (tx) => {
          const project = await lock(tx, p[1]);
          requireGate(
            !project.finalRevisionId,
            "Buka kembali project final sebelum upload.",
          );
          const timeline = project.timelines.at(-1);
          requireGate(
            project.idApproved &&
              project.enApproved &&
              timeline?.scriptId === project.enApproved,
            "Setujui script dan buat timeline terbaru sebelum upload.",
          );
          const r = await tx.videoRevision.create({
            data: {
              projectId: project.id,
              number: (project.revisions.at(-1)?.number || 0) + 1,
              filename: file.name.slice(0, 200),
              storageKey: key,
              metadata,
              frames: [],
              contextVersion: `${project.idApproved}:${project.enApproved}:${timeline.id}`,
            },
          });
          await tx.backgroundJob.create({
            data: { projectId: project.id, revisionId: r.id, kind: "review" },
          });
          await tx.project.update({
            where: { id: project.id },
            data: { status: "VIDEO_REVIEW_PENDING" },
          });
          await event(
            tx,
            project.id,
            "upload",
            `Revision ${r.number}; FFprobe validated`,
          );
          return r;
        });
        saved = true;
        return json(r, 201);
      } finally {
        if (!saved) await rm(assetPath(key), { recursive: true, force: true });
      }
    }
    return json({ error: "Tidak ditemukan" }, 404);
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: e.issues.map((i) => i.message).join("; ") }, 400);
    console.error(e instanceof Error ? e.message : e);
    return json(
      { error: e instanceof Error ? e.message : "Operasi gagal" },
      400,
    );
  }
}
