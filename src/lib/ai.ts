import { z } from "zod";
import { systemPrompt, prompts } from "./prompts";
export const isDemo = () => process.env.AI_MODE === "demo";
export type FrameInput = { label: string; url: string };
export async function ai<T>(
  kind: keyof typeof prompts,
  context: unknown,
  schema: z.ZodType<T>,
  fixture: () => T,
  images: FrameInput[] = [],
): Promise<{ data: T; demo: boolean }> {
  if (isDemo()) return { data: schema.parse(fixture()), demo: true };
  if (process.env.AI_MODE !== "live" || !process.env.OPENAI_API_KEY)
    throw new Error(
      "AI belum dikonfigurasi. Pilih AI_MODE=demo atau konfigurasikan OPENAI_API_KEY di server.",
    );
  const content: unknown[] = [
    {
      type: "text",
      text: prompts[kind] + "\nContext: " + JSON.stringify(context),
    },
  ];
  for (const img of images) {
    content.push(
      { type: "text", text: img.label },
      { type: "image_url", image_url: { url: img.url, detail: "low" } },
    );
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: kind,
          strict: true,
          schema: z.toJSONSchema(schema),
        },
      },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok)
    throw new Error(
      `Provider AI gagal (${res.status}). Tidak ada hasil simulasi pengganti. Periksa konfigurasi server.`,
    );
  const body = await res.json();
  const text = body.choices?.[0]?.message?.content;
  if (!text) throw new Error("Provider tidak mengembalikan hasil.");
  return { data: schema.parse(JSON.parse(text)), demo: false };
}
export function demoScript(language: string, topic: string) {
  return language === "id"
    ? `Pernahkah kamu memperhatikan detail kecil yang mengubah cara kita melihat K-pop? Ide kali ini adalah ${topic}. Sebelum menyimpulkan apa pun, kita perlu melihat cuplikan asli dan memeriksa konteksnya. Putar ulang momen itu, perhatikan apa yang terjadi sebelum dan sesudahnya, lalu bandingkan dengan sumber resmi. Satu detail bisa memunculkan cerita menarik, tetapi belum tentu membuktikan sebuah klaim. Menurutmu, konteks apa yang masih perlu kita cari?`
    : `Have you ever noticed a tiny detail that changes how you see K-pop? Before we jump to conclusions, let's check the original footage and its context. Watch the moment again, look at what happens before and after it, and compare it with an official source. One detail can make an interesting story, but it doesn't always prove a claim. What context do you think we're still missing?`;
}
