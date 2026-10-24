import { z } from "zod";

const text = z.string().trim().max(12000);
const meaningful = text
  .min(8, "Please provide at least 8 characters of useful detail.")
  .refine(
    (v) => /[\p{L}\p{N}].*[\p{L}\p{N}]/u.test(v),
    "Please provide meaningful instructions.",
  );
const short = z.string().trim().max(300);
const optional = text.default("");
export const prioritySchema = z.enum(["Low", "Medium", "High"]);
export const statusSchema = z.enum(["To Do", "In Progress", "Completed"]);
export const featureSchema = z.enum([
  "email",
  "meetings",
  "planner",
  "research",
  "checkpoint",
]);
export type Feature = z.infer<typeof featureSchema>;
export const dateSchema = z
  .string()
  .refine(
    (v) =>
      v === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        !Number.isNaN(new Date(v).getTime()) &&
        new Date(v).toISOString().slice(0, 10) === v),
    "Use a valid date.",
  );
export const requestSchemas = {
  email: z.object({
    purpose: meaningful,
    recipient: short.default(""),
    topic: short.min(2, "Add an email topic."),
    tone: z.enum([
      "Formal",
      "Professional",
      "Friendly",
      "Persuasive",
      "Concise",
      "Apologetic",
    ]),
    length: z.enum(["Short", "Medium", "Detailed"]),
    context: optional,
  }),
  meetings: z.object({
    title: short.default(""),
    date: dateSchema.default(""),
    transcript: meaningful,
    detail: z.enum(["Brief", "Standard", "Detailed"]),
  }),
  planner: z.object({
    title: short.min(2, "Add a project name."),
    description: meaningful,
    deadline: dateSchema.default(""),
    requirements: optional,
    priority: prioritySchema,
    hours: z.coerce.number().min(0.5).max(16).optional(),
    constraints: optional,
  }),
  research: z
    .object({
      topic: short.min(3, "Add a research question."),
      objective: optional,
      context: optional,
      depth: z.enum(["Overview", "Standard", "Detailed"]),
      mode: z.enum(["knowledge", "source"]),
      source: optional,
    })
    .refine((v) => v.mode !== "source" || v.source.length >= 20, {
      message: "Paste at least 20 characters of source material.",
      path: ["source"],
    }),
  checkpoint: z
    .object({
      title: short.min(2),
      content: z
        .string()
        .trim()
        .min(8, "Add at least 8 characters of content.")
        .max(60000),
      feedback: optional,
      action: z.enum(["review", "revise"]),
    })
    .refine((v) => v.action !== "revise" || v.feedback.length >= 3, {
      message: "Add revision feedback.",
      path: ["feedback"],
    }),
};
const outputText = z.string().max(30000);
const strings = z.array(z.string().max(5000)).max(40);
export const taskSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  description: outputText,
  subtasks: strings,
  priority: prioritySchema,
  status: statusSchema,
  estimatedHours: z.number().min(0).max(10000),
  dependencies: strings,
  schedule: z.string().max(1000),
  dueDate: dateSchema,
});
export type Task = z.infer<typeof taskSchema>;
export const actionSchema = z.object({
  description: z.string().min(1).max(3000),
  owner: z.string().max(300),
  deadline: z.string().max(300),
  priority: z.enum(["Low", "Medium", "High", "Not specified"]),
  completed: z.boolean(),
});
export type ActionItem = z.infer<typeof actionSchema>;
const planTasksSchema = z
  .array(taskSchema)
  .min(1)
  .max(5000)
  .refine(
    (tasks) => new Set(tasks.map((task) => task.id)).size === tasks.length,
    "Task identifiers must be unique.",
  )
  .refine(
    (tasks) =>
      tasks.every((task) =>
        task.dependencies.every(
          (id) =>
            id !== task.id && tasks.some((candidate) => candidate.id === id),
        ),
      ),
    "Dependencies must reference other tasks in the plan.",
  );
export const outputSchemas = {
  email: z.object({
    subject: z.string().min(1).max(500),
    body: outputText.min(1),
  }),
  meetings: z.object({
    overview: outputText,
    metadata: z
      .object({
        title: z.string().max(500),
        date: z.string().max(300),
        participants: z.array(z.string().max(5000)).max(5000),
        purpose: outputText,
      })
      .optional(),
    executiveSummary: outputText.optional(),
    nextSteps: strings.optional(),
    discussion: strings,
    decisions: z.array(z.string().max(5000)).max(5000),
    actionItems: z.array(actionSchema).max(5000),
    risks: z.array(z.string().max(5000)).max(5000),
    questions: z.array(z.string().max(5000)).max(5000),
    assumptions: strings,
  }),
  planner: z.object({
    overview: outputText,
    tasks: planTasksSchema,
    blockers: strings,
    recommendations: strings,
    assumptions: strings,
  }),
  research: z.object({
    overview: outputText,
    concepts: strings,
    explanation: outputText,
    examples: strings,
    insights: strings,
    recommendations: strings,
    limitations: strings,
    arguments: strings,
    facts: strings,
    questions: strings,
    basis: z.enum(["General model knowledge", "Supplied material"]),
  }),
  checkpoint: z.object({
    analysis: outputText,
    concerns: strings,
    suggestions: strings,
    revisedContent: outputText,
  }),
};
export type Outputs = { [K in Feature]: z.infer<(typeof outputSchemas)[K]> };
export const reviewSchema = z.object({
  status: z.enum(["Pending", "Approved", "Revision requested", "Rejected"]),
  feedback: z.string().max(12000),
  reviewedAt: z.string(),
  contentType: z.string().max(100),
  versions: z
    .array(
      z.object({
        content: z.string().max(60000),
        timestamp: z.string(),
        feedback: z.string().max(12000),
      }),
    )
    .max(30),
});
export type Review = z.infer<typeof reviewSchema>;
export type Draft = {
  savedId?: string;
  feature: Feature;
  title: string;
  input: Record<string, string>;
  output: Outputs[Feature] | null;
  review?: Review;
};
export const historyEntrySchema = z
  .object({
    id: z.string(),
    feature: featureSchema,
    title: z.string().max(300),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    input: z.record(z.string(), z.string().max(60000)),
    output: z.unknown(),
    review: reviewSchema.optional(),
  })
  .superRefine((entry, ctx) => {
    if (
      entry.output !== null &&
      !outputSchemas[entry.feature].safeParse(entry.output).success
    )
      ctx.addIssue({ code: "custom", message: "Invalid saved output" });
  });
export type HistoryEntry = z.infer<typeof historyEntrySchema>;
export const historySchema = z.object({
  version: z.literal(1),
  entries: z.array(historyEntrySchema).max(50),
});
