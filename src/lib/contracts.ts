import { z } from "zod";
export const categories = [
  "Visual mystery",
  "Idol micro-story",
  "Unexpected moment",
  "Music commentary",
  "Behind-the-scenes",
  "Other",
];
export const projectInput = z.object({
  title: z.string().trim().min(3).max(160),
  artist: z.string().trim().min(1).max(100),
  category: z.enum(categories as [string, ...string[]]),
  topic: z.string().trim().min(10).max(6000),
  targetDuration: z.number().int().min(15).max(120),
});
export const scriptOutput = z.object({ text: z.string().min(10).max(12000) });
export const topicOutput = z.object({
  ideas: z
    .array(
      z.object({
        title: z.string(),
        idolOrGroup: z.string(),
        category: z.enum(categories as [string, ...string[]]),
        summary: z.string(),
        hook: z.string(),
        angle: z.string(),
        visualRequirements: z.string(),
        durationEstimate: z.number().min(15).max(120),
        risks: z.string(),
        confidence: z.enum(["Unverified", "Low", "Medium", "High"]),
        distinctiveness: z.string(),
      }),
    )
    .min(1)
    .max(6),
});
export const sceneSchema = z.object({
  start: z.number().min(0),
  end: z.number().positive(),
  voiceover: z.string(),
  visual: z.string(),
  footage: z.string(),
  motion: z.string(),
  overlay: z.string(),
  subtitle: z.string(),
  transition: z.string(),
  sound: z.string(),
  purpose: z.string(),
});
export const timelineOutput = z
  .object({ scenes: z.array(sceneSchema).min(1).max(30) })
  .superRefine((v, ctx) => {
    let end = 0;
    for (const s of v.scenes) {
      if (Math.abs(s.start - end) > 0.05 || s.end <= s.start || s.end > 120)
        ctx.addIssue({
          code: "custom",
          message: "Scene harus berurutan dan kontinu, maksimal 120 detik",
        });
      end = s.end;
    }
  });
export const reviewSchema = z.object({
  score: z.number().min(0).max(10),
  strengths: z.array(z.string()),
  findings: z.array(
    z.object({
      start: z.number().min(0),
      end: z.number().min(0),
      category: z.string(),
      severity: z.enum(["High", "Medium", "Low"]),
      observation: z.string(),
      evidence: z.string(),
      recommendation: z.string(),
      confidence: z.enum(["Low", "Medium", "High"]),
    }),
  ),
  summary: z.string(),
  ready: z.boolean(),
  limitations: z.string(),
});
export const comparisonSchema = z.object({
  changes: z.array(z.string()),
  improvements: z.array(z.string()),
  regressions: z.array(z.string()),
  unresolved: z.array(z.string()),
  newIssues: z.array(z.string()),
  recommendation: z.string(),
  limitations: z.string(),
});
export function validateReview(value: unknown, duration: number) {
  const r = reviewSchema.parse(value);
  for (const f of r.findings)
    if (f.end < f.start || f.end > duration)
      throw new Error("Timestamp review di luar durasi video.");
  return r;
}
export function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
export function estimateDuration(text: string, wpm = 150) {
  return Math.round((wordCount(text) / wpm) * 60 * 10) / 10;
}
export function requireGate(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
export function uploadCheck(name: string, type: string, size: number) {
  if (!name.toLowerCase().endsWith(".mp4") || type !== "video/mp4")
    throw new Error("Hanya MP4 dengan MIME video/mp4.");
  if (size <= 0 || size > 100 * 1024 * 1024)
    throw new Error("Ukuran MP4 harus 1 byte–100 MB.");
}
