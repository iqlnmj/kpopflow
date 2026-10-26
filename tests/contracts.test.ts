import { test } from "node:test";
import assert from "node:assert/strict";
import {
  projectInput,
  timelineOutput,
  scriptOutput,
  uploadCheck,
  validateReview,
  estimateDuration,
  wordCount,
} from "../src/lib/contracts";
import { sampleTimes, assetPath } from "../src/lib/media";
import { equal, sameOrigin } from "../src/lib/auth";
test("project creation rejects invalid targets and empty topic", () => {
  assert.throws(() =>
    projectInput.parse({
      title: "x",
      artist: "IVE",
      category: "Visual mystery",
      topic: "x",
      targetDuration: 0,
    }),
  );
  assert.equal(
    projectInput.parse({
      title: "Test story",
      artist: "IVE",
      category: "Visual mystery",
      topic: "A specific visual detail",
      targetDuration: 35,
    }).targetDuration,
    35,
  );
});
test("timelines require contiguous positive scenes", () => {
  const scene = {
    start: 0,
    end: 3,
    voiceover: "Hello.",
    visual: "Licensed frame",
    footage: "Owned",
    motion: "None",
    overlay: "Hi",
    subtitle: "Hello",
    transition: "Cut",
    sound: "None",
    purpose: "Hook",
  };
  assert.equal(
    timelineOutput.parse({ scenes: [scene, { ...scene, start: 3, end: 6 }] })
      .scenes.length,
    2,
  );
  assert.throws(() =>
    timelineOutput.parse({ scenes: [scene, { ...scene, start: 4, end: 3 }] }),
  );
});
test("upload validation rejects misleading names, MIME and oversized assets", () => {
  uploadCheck("video.MP4", "video/mp4", 100);
  for (const a of [
    ["v.exe", "video/mp4", 10],
    ["v.mp4", "text/plain", 10],
    ["v.mp4", "video/mp4", 101 * 1024 * 1024],
  ] as const)
    assert.throws(() => uploadCheck(a[0], a[1], a[2]));
});
test("review timestamps cannot escape video duration", () => {
  const review = {
    score: 7,
    summary: "review",
    ready: false,
    limitations: "frames only",
    strengths: [],
    findings: [
      {
        start: 2,
        end: 4,
        category: "Hook",
        severity: "High",
        observation: "Visible",
        evidence: "Frame",
        recommendation: "Fix",
        confidence: "Low",
      },
    ],
  };
  assert.equal(validateReview(review, 5).score, 7);
  assert.throws(() => validateReview(review, 3));
});
test("sampling prioritizes intro and includes ending within bounds", () => {
  const t = sampleTimes(35);
  assert.ok(t.includes(0.5) && t.includes(1) && t.includes(2) && t.includes(3));
  assert.ok(t.at(-1)! > 34 && t.every((n) => n >= 0 && n < 35));
  assert.ok(sampleTimes(0.2).every((n) => n < 0.2));
});
test("asset paths reject traversal and non-generated names", () => {
  assert.throws(() => assetPath("../secret"));
  assert.throws(() => assetPath("abc/../../.env"));
  assert.throws(() => assetPath("abc/test.js"));
  assert.ok(assetPath("abc/video.mp4").endsWith("/abc/video.mp4"));
});
test("script output and duration use words, not arbitrary seconds", () => {
  assert.throws(() => scriptOutput.parse({ text: "" }));
  assert.equal(wordCount(" one two three "), 3);
  assert.equal(estimateDuration(Array(75).fill("word").join(" ")), 30);
});
test("constant-time password comparison preserves exact input", () => {
  assert.ok(equal("password", "password"));
  assert.ok(!equal("password", "Password"));
});

test("CSRF accepts browser Host origin and rejects foreign or absent origins", () => {
  assert.ok(
    sameOrigin(
      new Request("http://0.0.0.0:3000/api/login", {
        headers: { host: "localhost:3000", origin: "http://localhost:3000" },
      }),
    ),
  );
  assert.ok(
    !sameOrigin(
      new Request("http://localhost:3000/api/login", {
        headers: { host: "localhost:3000", origin: "http://evil.invalid" },
      }),
    ),
  );
  assert.ok(!sameOrigin(new Request("http://localhost:3000/api/login")));
});
