import { describe, expect, it } from "vitest";
import {
  compareExperimentVersions,
  experimentRequestSchema,
  promptExperimentSchema,
  type ExperimentVersion,
} from "../../src/lib/experiments";

const version: ExperimentVersion = {
  id: "v1",
  prompt: "Explain responsible AI to a new student.",
  instruction: "",
  response: "Keep people involved in important decisions.",
  createdAt: "2026-10-23T10:00:00.000Z",
};

describe("prompt experiment contracts", () => {
  it("requires a real response and feedback before refining", () => {
    expect(
      experimentRequestSchema.safeParse({
        prompt: version.prompt,
        action: "refine",
        instruction: "Improve",
      }).success,
    ).toBe(false);
    expect(
      experimentRequestSchema.safeParse({
        prompt: version.prompt,
        action: "refine",
        previousResponse: version.response,
        instruction: "Use simpler words",
      }).success,
    ).toBe(true);
  });
  it("bounds saved versions and validates timestamps", () => {
    const experiment = {
      id: "e1",
      title: "Student explanation",
      prompt: version.prompt,
      versions: [version],
      createdAt: version.createdAt,
      updatedAt: version.createdAt,
    };
    expect(promptExperimentSchema.safeParse(experiment).success).toBe(true);
    expect(
      promptExperimentSchema.safeParse({
        ...experiment,
        versions: Array.from({ length: 31 }, () => version),
      }).success,
    ).toBe(false);
    expect(
      promptExperimentSchema.safeParse({
        ...experiment,
        updatedAt: "yesterday",
      }).success,
    ).toBe(false);
  });
  it("compares actual responses without inventing quality scores", () => {
    expect(
      compareExperimentVersions(version, {
        ...version,
        response: "People review decisions.",
      }),
    ).toEqual({
      promptChanged: false,
      responseChanged: true,
      beforeCharacters: version.response.length,
      afterCharacters: 24,
    });
  });
});
