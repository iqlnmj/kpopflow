import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { command, include } from "../src/lib/workflow";
process.env.AI_MODE = "demo";
const ids: string[] = [];
after(async () => {
  for (const projectId of ids) {
    await db.backgroundJob.deleteMany({ where: { projectId } });
    await db.approvalEvent.deleteMany({ where: { projectId } });
    await db.auditEvent.deleteMany({ where: { projectId } });
    await db.researchSource.deleteMany({ where: { projectId } });
    await db.editingTimeline.deleteMany({ where: { projectId } });
    await db.scriptVersion.deleteMany({ where: { projectId } });
    await db.reviewReport.deleteMany({ where: { revision: { projectId } } });
    await db.videoRevision.deleteMany({ where: { projectId } });
    await db.project.delete({ where: { id: projectId } });
  }
  await db.$disconnect();
});
test("PostgreSQL workflow: gates, persisted versions, approval invalidation, final guard", async () => {
  const p = await db.project.create({
    data: {
      title: "Integration approval test",
      artist: "IVE",
      category: "Visual mystery",
      topic: "Test fictional visual detail, not factual.",
    },
  });
  ids.push(p.id);
  await assert.rejects(command(p.id, "generate-en", {}), /Setujui/);
  await assert.rejects(command(p.id, "timeline", {}), /Setujui/);
  await assert.rejects(
    command(p.id, "final", { revisionId: "missing" }),
    /Final memerlukan/,
  );
  let state = await command(p.id, "generate-id", {});
  assert.equal(state.status, "INDONESIAN_DRAFT");
  const id = state.scripts[0];
  assert.ok(id.demo);
  await assert.rejects(
    command(p.id, "approve-id", { scriptId: "wrong" }),
    /terbaru/,
  );
  state = await command(p.id, "approve-id", { scriptId: id.id });
  assert.equal(state.idApproved, id.id);
  state = await command(p.id, "generate-en", {});
  const en = state.scripts.at(-1)!;
  assert.equal(en.basedOn, id.id);
  assert.ok(!en.text.includes("\n"));
  await assert.rejects(
    command(p.id, "save-script", {
      language: "en",
      text: "Invalid\nmultiple paragraphs.",
    }),
    /satu paragraf/,
  );
  state = await command(p.id, "approve-en", { scriptId: en.id });
  assert.equal(state.enApproved, en.id);
  state = await command(p.id, "timeline", {});
  assert.equal(state.timelines[0].scriptId, en.id);
  assert.equal(state.status, "EDITING_PLAN_READY");
  await assert.rejects(
    command(p.id, "compare", { revisionId: "no", previousId: "none" }),
    /tidak ditemukan/,
  );
  state = await command(p.id, "save-script", {
    language: "id",
    text: id.text + " Perlu konteks tambahan.",
  });
  assert.equal(state.scripts.length, 3);
  assert.equal(state.idApproved, null);
  assert.equal(state.enApproved, null);
  assert.equal(state.timelines.length, 1);
  assert.equal(state.scripts[0].text, id.text);
  await assert.rejects(
    command(p.id, "approve-en", { scriptId: en.id }),
    /tidak sinkron/,
  );
  const persisted = await db.project.findUniqueOrThrow({
    where: { id: p.id },
    include,
  });
  assert.equal(persisted.approvals.length, 2);
  assert.deepEqual(
    persisted.events.map((e) => e.action).sort(),
    [
      "generate-id",
      "approve-id",
      "generate-en",
      "approve-en",
      "timeline",
      "save-script",
    ].sort(),
  );
});
