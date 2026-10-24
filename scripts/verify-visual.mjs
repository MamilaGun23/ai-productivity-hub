import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { outputs } from "../tests/fixtures.ts";

const baseURL = process.env.QA_URL || "http://localhost:3001";
const browser = await chromium.launch();
const context = await browser.newContext({ reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const reports = [];
await mkdir("docs/screenshots", { recursive: true });
try {
  for (const route of [
    "/",
    "/email",
    "/meetings",
    "/planner",
    "/research",
    "/checkpoint",
    "/history",
    "/settings",
    "/about",
  ]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const response = await page.goto(`${baseURL}${route}`);
    if (response?.status() !== 200) throw new Error(`Route failed: ${route}`);
    await page.locator("main h1").waitFor();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    reports.push({
      route,
      violations: result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    });
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      if (overflow)
        throw new Error(`Horizontal overflow: ${route} at ${width}px`);
    }
    if (route === "/" || route === "/email")
      await page.screenshot({
        path: `docs/screenshots/${route === "/" ? "dashboard-desktop" : "email-workspace"}.png`,
        fullPage: true,
      });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL);
  await page.screenshot({
    path: "docs/screenshots/dashboard-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  const drawerAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  reports.push({
    route: "/ (mobile navigation open)",
    violations: drawerAudit.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  });
  await page.getByRole("button", { name: "Close navigation" }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const feature of [
    "email",
    "meetings",
    "planner",
    "research",
    "checkpoint",
  ]) {
    if (feature === "meetings")
      await page.route("**/api/transcripts/step", (route) => {
        const { phase } = route.request().postDataJSON();
        const summary =
          "The team reviewed the launch checklist and assigned a review to Alex.";
        return route.fulfill({
          json: {
            output:
              phase === "map"
                ? {
                    summary,
                    participants: ["Alex"],
                    decisions: outputs.meetings.decisions,
                    actionItems: outputs.meetings.actionItems,
                    risks: outputs.meetings.risks,
                    questions: outputs.meetings.questions,
                  }
                : phase === "reduce"
                  ? { summary }
                  : outputs.meetings,
          },
        });
      });
    await page.route(`**/api/ai/${feature}`, (route) =>
      route.fulfill({ json: { output: outputs[feature] } }),
    );
    await page.goto(`${baseURL}/${feature}`);
    if (feature === "email") {
      await page
        .getByLabel("What would you like to say?")
        .fill("Ask the team to review the project proposal.");
      await page.getByLabel("Subject or topic").fill("Project proposal");
    } else if (feature === "meetings")
      await page
        .getByLabel("Notes or transcript")
        .fill(
          "Alex will review the launch checklist. This is a high priority.",
        );
    else if (feature === "planner") {
      await page.getByLabel("Project or goal").fill("Portfolio launch");
      await page
        .getByLabel("What do you want to achieve?")
        .fill("Build and launch my personal portfolio website.");
    } else if (feature === "research")
      await page
        .getByLabel("Research question")
        .fill("How does responsible AI work?");
    else {
      await page.getByLabel("Content title").fill("Project review");
      await page
        .getByLabel("Content to review")
        .fill("Please review the project proposal and share feedback.");
    }
    if (feature === "meetings")
      await page
        .getByRole("button", { name: "Generate meeting summary", exact: true })
        .click();
    else await page.locator('.input-panel button[type="submit"]').click();
    await page.locator(".output-content").waitFor();
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    reports.push({
      route: `/${feature} (test fixture output)`,
      violations: audit.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    });
    if (feature === "planner") {
      const closeToast = page.locator(
        "[data-sonner-toast] [data-close-button]",
      );
      if (await closeToast.count()) await closeToast.first().click();
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
        window.scrollTo(0, 0);
      });
      await page.screenshot({
        path: "docs/screenshots/planner-test-fixture.png",
        fullPage: true,
      });
    }
    for (const width of [320, 768]) {
      await page.setViewportSize({ width, height: 1000 });
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        )
      )
        throw new Error(`Output overflow: ${feature} at ${width}px`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await writeFile(
    process.env.QA_REPORT_PATH || "docs/accessibility-results.json",
    JSON.stringify(
      {
        date: new Date().toISOString().slice(0, 10),
        base: process.env.QA_URL || "local production build",
        viewports: [320, 768, 1440],
        reports,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
  const violations = reports.reduce((sum, r) => sum + r.violations.length, 0);
  console.log(
    JSON.stringify({
      routes: reports.length,
      violations,
      pageErrors: errors,
      screenshots: "docs/screenshots/",
    }),
  );
  if (violations || errors.length) process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
