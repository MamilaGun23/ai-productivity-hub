import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
if (process.env.RUN_LIVE_AI_TESTS !== "1")
  throw new Error(
    "Set RUN_LIVE_AI_TESTS=1 explicitly. This check consumes Gemini quota.",
  );
const baseURL = new URL(process.env.LIVE_AI_URL || "http://127.0.0.1:3000")
  .origin;
const report = {
  baseURL,
  checkedAt: new Date().toISOString(),
  requests: [],
  checks: {},
};
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(60000);
page.on("response", (response) => {
  const path = new URL(response.url()).pathname;
  if (!path.startsWith("/api/")) return;
  let phase;
  try {
    phase = response.request().postDataJSON()?.phase;
  } catch {
    /* GET/static response. */
  }
  report.requests.push({ path, phase, status: response.status() });
});
try {
  const initial = await page.goto(`${baseURL}/meetings`);
  assert.equal(initial.status(), 200);
  await expect(
    page.getByRole("heading", { name: /Meeting Notes Summarizer/ }),
  ).toBeVisible();
  report.checks.anonymousAccess = true;
  await page.getByLabel(/Meeting title/i).fill("Synthetic launch review");
  let source =
    "[00:00] Alex: This meeting reviews the launch checklist. I will send the checklist to Sam. No deadline was supplied.\n";
  for (let index = 0; source.length < 16000; index++)
    source += `[00:${index}] Alex: We examined documentation quality and the need for human review. This discussion assigns no additional work or dates.\n`;
  source +=
    "[01:00] Sam: I will review the checklist after Alex sends it. The team decided to review the checklist before launch. No date was specified.\n";
  await page
    .getByLabel("Upload meeting transcript")
    .setInputFiles({
      name: "synthetic-transcript.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(source),
    });
  await expect(page.getByLabel("Notes or transcript")).toHaveValue(
    source.trim(),
  );
  await page
    .getByRole("button", { name: "Generate meeting summary", exact: true })
    .click();
  await Promise.race([
    page
      .locator(".output-content")
      .waitFor({ state: "visible", timeout: 240000 }),
    page
      .locator(".large-transcript-workspace [role=alert]")
      .first()
      .waitFor({ state: "visible", timeout: 240000 })
      .then(async () => {
        throw new Error(
          `Meeting pipeline stopped: ${await page.locator(".large-transcript-workspace [role=alert]").first().innerText()}`,
        );
      }),
  ]);
  const owners = await page
    .getByLabel("Owner", { exact: true })
    .evaluateAll((nodes) => nodes.map((node) => node.value));
  assert(
    owners.some((owner) => /alex/i.test(owner)) &&
      owners.some((owner) => /sam/i.test(owner)),
    "Both explicitly assigned owners must survive section merging.",
  );
  assert.equal(
    await page.getByLabel("date", { exact: true }).inputValue(),
    "Not specified",
  );
  await expect(page.getByLabel(/executive summary/i)).not.toHaveValue("");
  assert(
    report.requests.filter(
      (request) => request.phase === "map" && request.status === 200,
    ).length >= 2,
  );
  assert(
    report.requests.some(
      (request) => request.phase === "reduce" && request.status === 200,
    ),
  );
  assert(
    report.requests.some(
      (request) => request.phase === "final" && request.status === 200,
    ),
  );
  report.checks.liveHierarchicalMeeting = true;
  report.checks.explicitOwnersRetained = true;
  report.checks.unspecifiedDatePreserved = true;
  await page
    .getByRole("button", { name: "Plan selected actions", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Add selected tasks to workspace",
      exact: true,
    })
    .click();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.locator(".focus-list input[type=checkbox]")).toHaveCount(
    owners.length,
  );
  report.checks.liveActionsTransferred = true;
  await page.getByRole("link", { name: "AI Checkpoint", exact: true }).click();
  const lab = page.getByRole("region", {
    name: "Test an idea. Improve the response.",
  });
  const original =
    "Explain why humans should check AI generated meeting actions.";
  await lab.getByLabel("Prompt to test").fill(original);
  const generated = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/experiments",
  );
  await lab.getByRole("button", { name: "Test prompt", exact: true }).click();
  assert.equal((await generated).status(), 200);
  await expect(lab.getByLabel("Experiment response")).not.toHaveValue("", {
    timeout: 30000,
  });
  await lab
    .getByLabel("How should this response improve?")
    .fill(
      "Improve the prompt to request exactly three short bullet points for a beginner, then answer the improved prompt.",
    );
  const refined = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/experiments",
  );
  await lab
    .getByRole("button", { name: "Improve prompt & test", exact: true })
    .click();
  assert.equal((await refined).status(), 200);
  await expect(lab.getByLabel("Active version").locator("option")).toHaveCount(
    2,
    { timeout: 30000 },
  );
  assert.notEqual(
    await lab.getByLabel("Prompt to test").inputValue(),
    original,
  );
  report.checks.livePromptGenerationAndRefinement = true;
  report.checks.passed = true;
} catch (error) {
  report.checks.passed = false;
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(
    process.env.LIVE_WORKFLOW_REPORT_PATH ||
      "docs/redesign-live-workflows.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
