import { z } from "zod";

export const experimentVersionSchema = z.object({
  id: z.string().min(1).max(100),
  prompt: z.string().trim().min(8).max(12000),
  instruction: z.string().max(4000),
  response: z.string().min(1).max(20000),
  createdAt: z.iso.datetime(),
});

export const promptExperimentSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  prompt: z.string().trim().min(8).max(12000),
  versions: z
    .array(experimentVersionSchema)
    .min(1)
    .max(30)
    .refine(
      (versions) =>
        new Set(versions.map((version) => version.id)).size === versions.length,
      "Version IDs must be unique.",
    ),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const experimentRequestSchema = z
  .object({
    prompt: z
      .string()
      .trim()
      .min(8, "Write a prompt of at least 8 characters.")
      .max(12000),
    action: z.enum(["generate", "refine", "refine-prompt"]),
    instruction: z.string().trim().max(4000).default(""),
    previousResponse: z.string().max(20000).default(""),
  })
  .superRefine((value, context) => {
    if (
      value.action === "refine" &&
      (!value.previousResponse.trim() || value.instruction.length < 3)
    ) {
      context.addIssue({
        code: "custom",
        path: ["instruction"],
        message: "Generate a response and describe the refinement first.",
      });
    }
    if (value.action === "refine-prompt" && value.instruction.length < 3) {
      context.addIssue({
        code: "custom",
        path: ["instruction"],
        message: "Describe how the prompt should improve first.",
      });
    }
  });

export const experimentResponseSchema = z.object({
  response: z.string().trim().min(1).max(20000),
  refinedPrompt: z.string().trim().min(8).max(12000).optional(),
});

export type PromptExperiment = z.infer<typeof promptExperimentSchema>;
export type ExperimentVersion = z.infer<typeof experimentVersionSchema>;
export type ExperimentRequest = z.infer<typeof experimentRequestSchema>;
/** Unsaved editor state stays in memory across internal navigation. */
export type ExperimentDraft = {
  id?: string;
  createdAt?: string;
  title: string;
  prompt: string;
  instruction: string;
  versions: ExperimentVersion[];
  activeId: string;
  compareId: string;
};

/** A comparison is literal text, so edits and regenerated answers stay inspectable. */
export function compareExperimentVersions(
  before: ExperimentVersion,
  after: ExperimentVersion,
) {
  return {
    promptChanged: before.prompt !== after.prompt,
    responseChanged: before.response !== after.response,
    beforeCharacters: before.response.length,
    afterCharacters: after.response.length,
  };
}
