import env from "@next/env";
import { writeFile } from "node:fs/promises";
import { outputSchemas } from "../src/lib/contracts.ts";

// Deliberately separate from routine tests: this consumes real provider quota.
if (process.env.RUN_LIVE_AI_TESTS !== "1") {
  throw new Error(
    "Set RUN_LIVE_AI_TESTS=1 to explicitly enable real AI requests.",
  );
}
env.loadEnvConfig(process.cwd());
const base = process.env.LIVE_AI_URL || "http://127.0.0.1:3000";
const original =
  "Hello team, please review the project proposal and share your feedback. Thank you.";
const cases = [
  {
    name: "email",
    feature: "email",
    input: {
      purpose:
        "Ask the team to review the project proposal and suggest improvements.",
      topic: "Project proposal review",
      tone: "Professional",
      length: "Short",
    },
  },
  {
    name: "meeting-summary",
    feature: "meetings",
    input: {
      title: "Portfolio launch",
      transcript:
        "The team decided to use a simple single-page portfolio. Alex will review the homepage design. No deadline was agreed. The team needs the project screenshots before launch.",
      detail: "Brief",
    },
  },
  {
    name: "task-plan",
    feature: "planner",
    input: {
      title: "Portfolio launch",
      description:
        "Create a small single-page portfolio and review it before publishing. Keep the plan to three tasks.",
      priority: "Medium",
      hours: 2,
      requirements:
        "Design the homepage, implement it, then review accessibility.",
      constraints:
        "Use a relative schedule. No absolute deadline has been set.",
    },
  },
  {
    name: "research-knowledge",
    feature: "research",
    input: {
      topic: "How can human review improve AI-generated email drafts?",
      depth: "Overview",
      mode: "knowledge",
    },
  },
  {
    name: "research-source",
    feature: "research",
    input: {
      topic: "Summarize the team's portfolio launch decision",
      depth: "Overview",
      mode: "source",
      source:
        "The team chose a single-page portfolio. Alex will review its design. Screenshots are still needed before launch. No launch deadline was agreed.",
    },
  },
  {
    name: "checkpoint-review",
    feature: "checkpoint",
    input: { title: "Proposal review", content: original, action: "review" },
  },
  {
    name: "checkpoint-revise",
    feature: "checkpoint",
    input: {
      title: "Proposal review",
      content: original,
      action: "revise",
      feedback:
        "Make the tone friendlier and add a clear request to suggest a suitable feedback date. Do not invent a deadline.",
    },
  },
];
const results = [];
for (const item of cases) {
  const started = Date.now();
  try {
    const response = await fetch(`${base}/api/ai/${item.feature}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item.input),
      signal: AbortSignal.timeout(60000),
    });
    const data = await response.json();
    if (!response.ok) {
      // Only application-controlled messages; never log provider errors or credentials.
      results.push({
        name: item.name,
        status: response.status,
        passed: false,
        durationMs: Date.now() - started,
      });
      console.log(JSON.stringify(results.at(-1)));
      break;
    }
    const output = outputSchemas[item.feature].parse(data.output);
    if (
      item.feature === "research" &&
      output.basis !==
        (item.input.mode === "source"
          ? "Supplied material"
          : "General model knowledge")
    )
      throw new Error("Evidence basis mismatch");
    if (item.feature === "planner" && output.tasks.some((task) => task.dueDate))
      throw new Error("Absolute date invented without a deadline");
    if (
      item.name === "checkpoint-revise" &&
      (!output.revisedContent.trim() || output.revisedContent === original)
    )
      throw new Error("Revision was not generated");
    results.push({
      name: item.name,
      status: response.status,
      passed: true,
      schemaValidated: true,
      durationMs: Date.now() - started,
    });
  } catch {
    results.push({
      name: item.name,
      passed: false,
      durationMs: Date.now() - started,
    });
    console.log(JSON.stringify(results.at(-1)));
    break;
  }
  console.log(JSON.stringify(results.at(-1)));
}
const passed =
  results.length === cases.length && results.every((result) => result.passed);
await writeFile(
  process.env.LIVE_AI_REPORT_PATH || "docs/live-ai-results.json",
  JSON.stringify(
    {
      date: "2026-10-23",
      environment: ["localhost", "127.0.0.1"].includes(new URL(base).hostname)
        ? "local development server"
        : "public production deployment",
      url: ["localhost", "127.0.0.1"].includes(new URL(base).hostname)
        ? undefined
        : base,
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
      mocked: false,
      passed,
      results,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({ passed, requests: results.length, expected: cases.length }),
);
if (!passed) process.exitCode = 1;
