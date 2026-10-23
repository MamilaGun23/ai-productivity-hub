import { it, expect } from "vitest";
import { z } from "zod";
import { providerSchema } from "../../src/lib/ai/provider-schema";
import { outputSchemas } from "../../src/lib/contracts";
it("keeps provider structure and enums while enforcing bounds in application validation", () => {
  const source = z.toJSONSchema(outputSchemas.meetings);
  const simplified = providerSchema(source) as typeof source;
  expect(JSON.stringify(simplified)).not.toContain('"maxItems"');
  expect(JSON.stringify(simplified)).not.toContain('"maxLength"');
  expect(simplified.required).toEqual(source.required);
  expect(JSON.stringify(simplified)).toContain('"Not specified"');
  expect(
    outputSchemas.meetings.safeParse({
      overview: "",
      discussion: Array(41).fill("item"),
      decisions: [],
      actionItems: [],
      risks: [],
      questions: [],
      assumptions: [],
    }).success,
  ).toBe(false);
});
it("preserves output property names that coincide with constraint keywords", () => {
  expect(
    providerSchema({
      type: "object",
      properties: { maximum: { type: "number", maximum: 4 } },
    }),
  ).toEqual({ type: "object", properties: { maximum: { type: "number" } } });
});
