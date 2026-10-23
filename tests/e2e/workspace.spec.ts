import { test, expect, type Page } from "@playwright/test";
import { outputs } from "../fixtures";
async function mock(page: Page, feature: keyof typeof outputs) {
  await page.route(`**/api/ai/${feature}`, (route) =>
    route.fulfill({ json: { output: outputs[feature] } }),
  );
}
test("dashboard and sidebar navigation", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Your space to do more/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Draft an email/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Smart Email", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Smart Email Generator/ }),
  ).toBeVisible();
});
test("email generates, edits, transfers and retains instructions", async ({
  page,
}) => {
  await mock(page, "email");
  await page.goto("/email");
  await page
    .getByLabel("What would you like to say?")
    .fill("Ask the team for feedback on our project proposal");
  await page.getByLabel("Subject or topic").fill("Proposal");
  await page.getByRole("button", { name: "Generate email" }).click();
  await expect(page.getByLabel("Generated subject")).toHaveValue(
    outputs.email.subject,
  );
  await page
    .getByRole("textbox", { name: "Email body", exact: true })
    .fill("My edited email draft");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy body", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("My edited email draft");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export text", exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toBe("email.txt");
  await page.getByRole("button", { name: "Send to Checkpoint" }).click();
  await expect(page.getByLabel("Content to review")).toContainText(
    "My edited email draft",
  );
  await page.getByRole("link", { name: "Smart Email", exact: true }).click();
  await expect(page.getByLabel("What would you like to say?")).toHaveValue(
    "Ask the team for feedback on our project proposal",
  );
  await page.getByRole("button", { name: "Regenerate", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Email body", exact: true }),
  ).toHaveValue(outputs.email.body);
});
test("meeting extracts editable actions and transfers selected items", async ({
  page,
}) => {
  await mock(page, "meetings");
  await page.goto("/meetings");
  await page
    .getByLabel("Upload transcript")
    .setInputFiles({
      name: "too-large.txt",
      mimeType: "text/plain",
      buffer: Buffer.alloc(100001),
    });
  await expect(
    page.getByRole("alert").filter({ hasText: "100 KB" }),
  ).toBeVisible();
  await page
    .getByLabel("Upload transcript")
    .setInputFiles({
      name: "meeting.vtt",
      mimeType: "text/vtt",
      buffer: Buffer.from(
        "WEBVTT\n\n1\n00:00:00.000 --> 00:00:04.000\nAlex will review the launch checklist. Review is a high priority.",
      ),
    });
  await expect(page.getByLabel("Notes or transcript")).toHaveValue(
    "Alex will review the launch checklist. Review is a high priority.",
  );
  await page.getByRole("button", { name: "Generate summary" }).click();
  await expect(page.getByLabel("Owner", { exact: true })).toHaveValue("Alex");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Review the full checklist");
  await page.getByRole("button", { name: "Plan selected actions" }).click();
  await expect(page.getByLabel("Tasks or requirements")).toHaveValue(
    /Review the full checklist/,
  );
});
test("planner supports editing, completion, schedule, save and reload", async ({
  page,
}) => {
  await mock(page, "planner");
  await page.goto("/settings");
  await page.getByRole("switch", { name: "Enable local history" }).check();
  await page.getByRole("link", { name: "Task Planner", exact: true }).click();
  await page.getByLabel("Project or goal").fill("Portfolio launch");
  await page
    .getByLabel("What do you want to achieve?")
    .fill("Build and launch a portfolio site in two weeks");
  await page.getByRole("button", { name: "Generate plan" }).click();
  await page
    .getByLabel("Task title", { exact: true })
    .first()
    .fill("Design the landing page");
  await page
    .getByRole("checkbox", { name: "Complete Design the landing page" })
    .check();
  await expect(page.getByText("50% complete")).toBeVisible();
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  await expect(page.getByText("Day 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save locally" }).click();
  await page.reload();
  await page.getByRole("link", { name: "History", exact: true }).click();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(
    page.getByLabel("Task title", { exact: true }).first(),
  ).toHaveValue("Design the landing page");
  await expect(page.getByText("50% complete")).toBeVisible();
});
test("research distinguishes knowledge from supplied evidence", async ({
  page,
}) => {
  await mock(page, "research");
  await page.goto("/research");
  await page
    .getByLabel("Research question")
    .fill("Responsible AI in small businesses");
  await page.getByRole("button", { name: "Generate research" }).click();
  await expect(
    page.getByText("General model knowledge", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("overview", { exact: true })).toHaveValue(
    outputs.research.overview,
  );
  await page.getByLabel("Research mode").selectOption("source");
  await page
    .getByLabel("Source material")
    .fill("A supplied source describes the value of human oversight in AI.");
  await page.route("**/api/ai/research", (route) =>
    route.fulfill({
      json: { output: { ...outputs.research, basis: "Supplied material" } },
    }),
  );
  await page.getByRole("button", { name: "Regenerate", exact: true }).click();
  await expect(
    page.getByText("Supplied material", { exact: true }),
  ).toBeVisible();
});
test("checkpoint preserves revisions and records human decisions", async ({
  page,
}) => {
  await mock(page, "checkpoint");
  await page.goto("/settings");
  await page.getByRole("switch", { name: "Enable local history" }).check();
  await page.getByRole("link", { name: "AI Checkpoint", exact: true }).click();
  await page.getByLabel("Content title").fill("Proposal review");
  await page
    .getByLabel("Content to review")
    .fill("Please review the proposal. This is the original version.");
  await page
    .getByLabel("Your feedback or rejection reason")
    .fill("Add a clear next step without inventing a deadline");
  await page.getByRole("button", { name: "Request AI revision" }).click();
  await expect(page.getByLabel("Content to review")).toHaveValue(
    outputs.checkpoint.revisedContent,
  );
  await page.getByText(/Version 1 ·/).click();
  await expect(page.locator("pre")).toContainText(
    "This is the original version",
  );
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reopen for editing" }).click();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(page.getByText("Rejected", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "History", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByText("Rejected", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Your feedback or rejection reason"),
  ).toHaveValue("Add a clear next step without inventing a deadline");
  await expect(page.getByText(/Version 1 ·/)).toBeVisible();
});
test("mobile drawer navigates and layouts do not overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Meeting Notes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Meeting Notes Summarizer/ }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("service errors preserve input and allow recovery", async ({ page }) => {
  await page.route("**/api/ai/email", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "AI is not configured yet." },
    }),
  );
  await page.goto("/email");
  await page
    .getByLabel("What would you like to say?")
    .fill("Ask for feedback on the proposal");
  await page.getByLabel("Subject or topic").fill("Proposal");
  await page.getByRole("button", { name: "Generate email" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "AI is not configured yet." }),
  ).toHaveText("AI is not configured yet.");
  await expect(page.getByLabel("Subject or topic")).toHaveValue("Proposal");
  await expect(
    page.getByRole("button", { name: "Generate email" }),
  ).toBeEnabled();
});
