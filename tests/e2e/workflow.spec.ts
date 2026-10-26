import "dotenv/config";
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { db } from "../../src/lib/db";
let projectId = "";
const fixture = "/tmp/kshorts-e2e.mp4";
test.beforeAll(() => {
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x645080:s=360x640:d=4:r=24",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=4",
    "-vf",
    "drawbox=x=90:y=180:w=180:h=180:color=0xb9a0e5:t=fill",
    "-c:v",
    "libx264",
    "-threads",
    "1",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    "-y",
    fixture,
  ]);
});
test.afterAll(async () => {
  if (projectId) {
    await db.reviewReport.deleteMany({ where: { revision: { projectId } } });
    await db.backgroundJob.deleteMany({ where: { projectId } });
    await db.approvalEvent.deleteMany({ where: { projectId } });
    await db.auditEvent.deleteMany({ where: { projectId } });
    await db.researchSource.deleteMany({ where: { projectId } });
    await db.editingTimeline.deleteMany({ where: { projectId } });
    await db.scriptVersion.deleteMany({ where: { projectId } });
    const r = await db.videoRevision.findMany({ where: { projectId } });
    await db.videoRevision.deleteMany({ where: { projectId } });
    await db.project.delete({ where: { id: projectId } });
    const { rm } = await import("node:fs/promises");
    const { assetPath } = await import("../../src/lib/media");
    for (const v of r)
      await rm(assetPath(v.storageKey), { recursive: true, force: true });
  }
  await db.$disconnect();
});
test("private routes reject anonymous requests", async ({ request }) => {
  expect((await request.get("/api/projects")).status()).toBe(401);
  expect((await request.get("/api/status")).status()).toBe(401);
  expect((await request.get("/api/media/random/video.mp4")).status()).toBe(401);
});
test("human-approved production workflow with real FFmpeg and persisted demo reviews", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Password studio").fill(process.env.APP_PASSWORD!);
  await page.getByRole("button", { name: "Masuk ke studio" }).click();
  await expect(
    page.getByText("Let’s make something worth watching."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Project baru", exact: true }).click();
  await page.getByLabel("Judul project").fill("E2E synthetic production");
  await page.getByLabel("Idol / grup").fill("DEMO artist");
  await page
    .getByLabel("Topik & storytelling angle")
    .fill("A synthetic licensed demo clip, not an actual idol event.");
  await page.getByRole("button", { name: "Buat project", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "E2E synthetic production" }),
  ).toBeVisible();
  projectId = (
    await db.project.findFirstOrThrow({
      where: { title: "E2E synthetic production" },
      orderBy: { createdAt: "desc" },
    })
  ).id;
  await page.getByRole("button", { name: "Lanjut ke script studio" }).click();
  await expect(
    page.getByRole("button", {
      name: "Generate Final English Script",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Generate Indonesian Script", exact: true })
    .click();
  await expect(
    page.getByLabel("Script Indonesia", { exact: true }),
  ).not.toBeEmpty();
  await page
    .getByRole("button", { name: "Approve Indonesian Script", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Generate Final English Script",
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Generate Final English Script", exact: true })
    .click();
  await expect(
    page.getByLabel("Script English", { exact: true }),
  ).not.toBeEmpty();
  await page
    .getByRole("button", { name: "Approve Final English Script", exact: true })
    .click();
  await page.getByRole("button", { name: "Lanjut ke editing plan" }).click();
  await page
    .getByRole("button", { name: "Generate Editing Timeline", exact: true })
    .click();
  await page.getByRole("button", { name: "Lanjut ke upload & review" }).click();
  await page.getByLabel("File MP4").setInputFiles(fixture);
  await page
    .getByRole("button", { name: "Upload & antrekan review", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "DEMO — contoh laporan" }),
  ).toBeVisible({ timeout: 90000 });
  await expect(page.locator(".frame-grid img").first()).toBeVisible();
  let state = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { revisions: true },
  });
  expect((state.revisions[0].metadata as { width: number }).width).toBe(360);
  expect((state.revisions[0].frames as unknown[]).length).toBeGreaterThan(5);
  await page.getByLabel("File MP4").setInputFiles(fixture);
  await page
    .getByRole("button", { name: "Upload & antrekan review", exact: true })
    .click();
  await expect(page.getByLabel("Video revision")).toHaveValue(/.+/);
  await expect(
    page.locator(".job").filter({ hasText: "COMPLETED" }),
  ).toHaveCount(2, { timeout: 90000 });
  state = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { revisions: { orderBy: { number: "asc" } } },
  });
  expect(state.revisions.length).toBe(2);
  await page
    .getByLabel("Previous revision")
    .selectOption(state.revisions[0].id);
  await page
    .getByRole("button", {
      name: "Compare With Previous Revision",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("• File identik berdasarkan SHA-256."),
  ).toBeVisible({ timeout: 90000 });
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Approve Final Video", exact: true })
    .click();
  await expect(
    page.getByText("Final disetujui. Semua artifact dan riwayat tersimpan."),
  ).toBeVisible();
  const final = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { approvals: true, revisions: { include: { reports: true } } },
  });
  expect(final.status).toBe("FINAL_APPROVED");
  expect(final.approvals.length).toBe(3);
  expect(final.revisions[1].reports.length).toBe(2);
  const session = page.context().request;
  const denied = await session.post(`/api/projects/${projectId}/action`, {
    headers: { Origin: "http://evil.invalid" },
    data: { action: "reopen" },
  });
  expect(denied.status()).toBe(403);
  await page.reload();
  await page.getByRole("button", { name: /^Projects/ }).click();
  await expect(page.getByText("E2E synthetic production")).toBeVisible();
});
test("responsive dashboard has no horizontal overflow", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Password studio").fill(process.env.APP_PASSWORD!);
  await page.getByRole("button", { name: "Masuk ke studio" }).click();
  await expect(
    page.getByText("Let’s make something worth watching."),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1050 });
  mkdirSync("/tmp/kshorts-artifacts", { recursive: true });
  await page.screenshot({
    path: "/tmp/kshorts-artifacts/dashboard.png",
    fullPage: true,
  });
});
