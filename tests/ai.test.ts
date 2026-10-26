import { test } from "node:test";
import assert from "node:assert/strict";
import { ai } from "../src/lib/ai";
import { scriptOutput } from "../src/lib/contracts";
test("live provider uses strict structured output, frame timestamps and never silently falls back", async () => {
  const originalFetch = globalThis.fetch;
  const original = {
    mode: process.env.AI_MODE,
    key: process.env.OPENAI_API_KEY,
  };
  process.env.AI_MODE = "live";
  process.env.OPENAI_API_KEY = "test-fixture-key";
  let fixtureCalled = false;
  try {
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.response_format.type, "json_schema");
      assert.equal(body.response_format.json_schema.strict, true);
      assert.equal(
        body.response_format.json_schema.schema.additionalProperties,
        false,
      );
      assert.ok(
        body.messages[1].content.some(
          (c: { text?: string }) => c.text === "frame at 1s",
        ),
      );
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  text: "A natural American English narration.",
                }),
              },
            },
          ],
        }),
        { status: 200 },
      );
    };
    const out = await ai(
      "en",
      { approvedIndonesian: "Narasi yang telah disetujui." },
      scriptOutput,
      () => {
        fixtureCalled = true;
        return { text: "A demo narration." };
      },
      [{ label: "frame at 1s", url: "data:image/jpeg;base64,fixture" }],
    );
    assert.equal(out.demo, false);
    assert.equal(out.data.text, "A natural American English narration.");
    assert.equal(fixtureCalled, false);
    globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
    await assert.rejects(
      ai("en", {}, scriptOutput, () => {
        fixtureCalled = true;
        return { text: "A demo narration." };
      }),
      /Provider AI gagal/,
    );
    assert.equal(fixtureCalled, false);
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(
      ai("en", {}, scriptOutput, () => ({ text: "A demo narration." })),
      /belum dikonfigurasi/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (original.mode === undefined) delete process.env.AI_MODE;
    else process.env.AI_MODE = original.mode;
    if (original.key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original.key;
  }
});
