import { describe, it, expect } from "vitest";
import {
  completion,
  normalizeInput,
  parseTranscript,
  formatOutput,
  tasksCsv,
  isOverdue,
} from "../../src/lib/utils";
import { outputs } from "../fixtures";
describe("workspace utilities", () => {
  it("calculates progress from task status", () => {
    expect(completion([])).toBe(0);
    expect(
      completion([
        { ...outputs.planner.tasks[0], status: "Completed" },
        outputs.planner.tasks[1],
      ]),
    ).toBe(50);
  });
  it("normalizes pasted input", () => {
    expect(normalizeInput("  Hello\r\nworld\u0000  ")).toBe("Hello\nworld");
  });
  it("parses VTT into transcript text", () => {
    expect(
      parseTranscript(
        "notes.vtt",
        100,
        "WEBVTT\n\n1\n00:00:00.000 --> 00:00:04.000\nAlex: Review the launch.",
      ),
    ).toBe("Alex: Review the launch.");
  });
  it("rejects unsafe and oversized uploads", () => {
    expect(() => parseTranscript("file.html", 1, "Hi")).toThrow();
    expect(() => parseTranscript("file.txt", 100001, "Hi")).toThrow();
    expect(() => parseTranscript("file.txt", 100, "a".repeat(12001))).toThrow();
  });
  it("preserves numeric notes and arrows in plain text and numeric VTT speech", () => {
    expect(
      parseTranscript("notes.txt", 50, "Budget\n1000\nPlan --> Review"),
    ).toBe("Budget\n1000\nPlan --> Review");
    expect(
      parseTranscript(
        "notes.vtt",
        100,
        "WEBVTT\n\n1\n00:00:00.000 --> 00:00:04.000\n1000",
      ),
    ).toBe("1000");
  });
  it("exports readable Markdown", () => {
    expect(formatOutput(outputs.email)).toContain(
      "## Subject\nProject follow-up",
    );
    expect(formatOutput({ items: ["one", "two"] })).toContain("- one\n- two");
  });
  it("escapes CSV quotes, newlines and spreadsheet formulas", () => {
    const csv = tasksCsv([
      {
        ...outputs.planner.tasks[0],
        title: '=HYPERLINK("test")',
        description: "first\nsecond",
      },
    ]);
    expect(csv).toContain('"\'=HYPERLINK(""test"")"');
    expect(csv).toContain('"first\nsecond"');
  });
  it("compares due dates using an explicit local date", () => {
    expect(isOverdue("2026-10-22", "2026-10-23")).toBe(true);
    expect(isOverdue("", "2026-10-23")).toBe(false);
    expect(isOverdue("2026-10-23", "2026-10-23")).toBe(false);
  });
});
