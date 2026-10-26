import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
const exec = promisify(execFile);
export const storage = () =>
  path.resolve(
    /* turbopackIgnore: true */ process.env.STORAGE_DIR || "./storage",
  );
export function assetPath(key: string) {
  if (!/^[a-zA-Z0-9_-]+(?:\/(?:video\.mp4|frame-\d+\.jpg))?$/.test(key))
    throw new Error("Asset path tidak valid");
  const p = path.resolve(storage(), key);
  if (!p.startsWith(storage() + path.sep)) throw new Error("Path tidak valid");
  return p;
}
export type Metadata = {
  duration: number;
  width: number;
  height: number;
  fps: number;
  videoCodec: string;
  audioCodec: string | null;
  hasAudio: boolean;
  bytes: number;
  sha256?: string;
};
export async function probe(file: string): Promise<Metadata> {
  const { stdout } = await exec(
    "ffprobe",
    [
      "-v",
      "error",
      "-protocol_whitelist",
      "file,pipe",
      "-show_format",
      "-show_streams",
      "-of",
      "json",
      file,
    ],
    { timeout: 30000, maxBuffer: 2 * 1024 * 1024 },
  );
  const p = JSON.parse(stdout);
  const v = p.streams.find(
    (s: { codec_type: string }) => s.codec_type === "video",
  );
  const a = p.streams.find(
    (s: { codec_type: string }) => s.codec_type === "audio",
  );
  if (!v || !String(p.format.format_name).includes("mp4"))
    throw new Error("File bukan MP4 video yang valid.");
  const d = Number(p.format.duration);
  if (!Number.isFinite(d) || d <= 0 || d > 120)
    throw new Error("Durasi video harus >0 dan maksimal 120 detik.");
  if (v.width > 3840 || v.height > 3840 || v.width < 1 || v.height < 1)
    throw new Error("Resolusi tidak didukung (maksimal 3840px).");
  if (v.width >= v.height) throw new Error("Unggah video vertikal (portrait).");
  const [n, den] = String(v.avg_frame_rate).split("/").map(Number);
  return {
    duration: d,
    width: v.width,
    height: v.height,
    fps: den ? n / den : 0,
    videoCodec: v.codec_name,
    audioCodec: a?.codec_name || null,
    hasAudio: !!a,
    bytes: (await stat(file)).size,
  };
}
export type Frame = { time: number; key: string };
export function sampleTimes(duration: number) {
  return [
    ...new Set(
      [
        0,
        0.5,
        1,
        2,
        3,
        ...Array.from({ length: 7 }, (_, i) => (duration * (i + 1)) / 8),
        Math.max(0, duration - 0.2),
      ]
        .filter((t) => t < duration)
        .map((t) => Math.round(t * 100) / 100),
    ),
  ].sort((a, b) => a - b);
}
export async function frames(key: string, duration: number): Promise<Frame[]> {
  const dir = assetPath(key);
  await mkdir(dir, { recursive: true });
  const times = sampleTimes(duration);
  const result: Frame[] = [];
  for (let i = 0; i < times.length; i++) {
    const frameKey = `${key}/frame-${i}.jpg`;
    await exec(
      "ffmpeg",
      [
        "-v",
        "error",
        "-nostdin",
        "-threads",
        "1",
        "-ss",
        String(times[i]),
        "-protocol_whitelist",
        "file,pipe",
        "-i",
        assetPath(`${key}/video.mp4`),
        "-frames:v",
        "1",
        "-vf",
        "scale=480:-2",
        "-threads",
        "1",
        "-y",
        assetPath(frameKey),
      ],
      { timeout: 30000, maxBuffer: 1024 * 1024 },
    );
    await stat(assetPath(frameKey));
    result.push({ time: times[i], key: frameKey });
  }
  return result;
}
export async function imageInputs(list: Frame[], prefix: string) {
  return Promise.all(
    list.map(async (f) => ({
      label: `${prefix}: frame at ${f.time}s`,
      url: `data:image/jpeg;base64,${(await readFile(/* turbopackIgnore: true */ assetPath(f.key))).toString("base64")}`,
    })),
  );
}
