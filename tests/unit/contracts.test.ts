import { describe, it, expect } from "vitest";
import {
  requestSchemas,
  outputSchemas,
  dateSchema,
} from "../../src/lib/contracts";
import { outputs, emailInput } from "../fixtures";
describe("request and output contracts", () => {
  it("accepts a complete email request and trims inputs", () => {
    expect(
      requestSchemas.email.parse({ ...emailInput, topic: "  Proposal  " })
        .topic,
    ).toBe("Proposal");
  });
  it("rejects meaningless, empty and oversized instructions", () => {
    for (const purpose of ["", "!!!!!!!!!!!!", "a".repeat(12001)])
      expect(
        requestSchemas.email.safeParse({ ...emailInput, purpose }).success,
      ).toBe(false);
  });
  it("requires evidence for supplied-material mode", () => {
    expect(
      requestSchemas.research.safeParse({
        topic: "AI risks",
        depth: "Standard",
        mode: "source",
        source: "",
      }).success,
    ).toBe(false);
  });
  it("requires feedback when requesting a revision", () => {
    expect(
      requestSchemas.checkpoint.safeParse({
        title: "Draft",
        content: "A sufficiently long draft",
        action: "revise",
        feedback: "",
      }).success,
    ).toBe(false);
  });
  it("rejects invalid dates without throwing", () => {
    for (const date of ["2026-99-99", "2026-02-30", "tomorrow"])
      expect(dateSchema.safeParse(date).success).toBe(false);
    expect(dateSchema.safeParse("2028-02-29").success).toBe(true);
  });
  it("enforces working-hour constraints", () => {
    expect(
      requestSchemas.planner.safeParse({
        title: "Launch",
        description: "Launch a portfolio site",
        priority: "High",
        hours: 24,
      }).success,
    ).toBe(false);
  });
  it("validates all five output fixtures", () => {
    for (const key of Object.keys(outputs) as (keyof OutputsFixture)[])
      expect(outputSchemas[key].safeParse(outputs[key]).success).toBe(true);
  });
  it("rejects invalid model task statuses", () => {
    expect(
      outputSchemas.planner.safeParse({
        ...outputs.planner,
        tasks: [{ ...outputs.planner.tasks[0], status: "Guaranteed" }],
      }).success,
    ).toBe(false);
  });
  it("rejects duplicate task ids and missing dependencies", () => {
    expect(
      outputSchemas.planner.safeParse({
        ...outputs.planner,
        tasks: [outputs.planner.tasks[0], outputs.planner.tasks[0]],
      }).success,
    ).toBe(false);
    expect(
      outputSchemas.planner.safeParse({
        ...outputs.planner,
        tasks: [{ ...outputs.planner.tasks[0], dependencies: ["missing"] }],
      }).success,
    ).toBe(false);
  });
});
type OutputsFixture = typeof outputs;
