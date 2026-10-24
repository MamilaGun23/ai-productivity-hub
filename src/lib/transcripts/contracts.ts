import { z } from "zod";
import { actionSchema, dateSchema, outputSchemas } from "../contracts";
export const sectionNotesSchema = z.object({
  summary: z.string().min(1).max(1400),
  participants: z.array(z.string().max(200)).max(100),
  decisions: z.array(z.string().max(1000)).max(100),
  actionItems: z.array(actionSchema).max(100),
  risks: z.array(z.string().max(1000)).max(60),
  questions: z.array(z.string().max(1000)).max(60),
});
export type SectionNotes = z.infer<typeof sectionNotesSchema>;
export const reductionSchema = z.object({
  summary: z.string().min(1).max(1400),
});
export const transcriptStepSchema = z.object({
  phase: z.enum(["map", "reduce", "final"]),
  title: z.string().max(300).default(""),
  date: dateSchema.default(""),
  detail: z.enum(["Brief", "Standard", "Detailed"]).default("Standard"),
  content: z.string().min(1).max(24000),
  context: z.string().max(1000).default(""),
  section: z.number().int().min(1).max(100000).default(1),
  total: z.number().int().min(1).max(100000).default(1),
});
export type TranscriptStep = z.infer<typeof transcriptStepSchema>;
export const resultSchemas = {
  map: sectionNotesSchema,
  reduce: reductionSchema,
  final: outputSchemas.meetings.required({
    metadata: true,
    executiveSummary: true,
    nextSteps: true,
  }),
};
export type TranscriptJob = {
  id: string;
  title: string;
  date: string;
  detail: "Brief" | "Standard" | "Detailed";
  filename: string;
  bytes: number;
  sourceLength: number;
  chunkBytes: number;
  total: number;
  completed: number;
  stage: string;
  status: "ready" | "running" | "paused" | "failed" | "complete";
  createdAt: string;
  updatedAt: string;
  error?: string;
  retryAt?: string;
  output?: z.infer<typeof outputSchemas.meetings>;
};
export type TranscriptNode = {
  id: string;
  jobId: string;
  key: string;
  result: SectionNotes | { summary: string };
};
