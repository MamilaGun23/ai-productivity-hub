import { z } from "zod";
import {
  dateSchema,
  featureSchema,
  historyEntrySchema,
  taskSchema,
  type Task,
} from "./contracts";
import { promptExperimentSchema } from "./experiments";

export const localTaskSchema = taskSchema.extend({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type LocalTask = z.infer<typeof localTaskSchema>;
export type NewTask = Pick<Task, "title"> & Partial<Omit<Task, "title">>;
export const calendarEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(500),
  description: z.string().max(10000).default(""),
  date: dateSchema.refine(Boolean, "Choose an event date."),
  time: z
    .string()
    .regex(/^$|^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .default(""),
  taskId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type NewCalendarEvent = Pick<CalendarEvent, "title" | "date"> &
  Partial<Pick<CalendarEvent, "id" | "description" | "time" | "taskId">>;
export const usageEventSchema = z.object({
  id: z.string(),
  feature: featureSchema,
  status: z.enum(["success", "error"]),
  kind: z.string().max(100).default("generation"),
  createdAt: z.string().datetime(),
});
export type UsageEvent = z.infer<typeof usageEventSchema>;
export const localWorkspaceSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative().default(0),
  entries: z.array(historyEntrySchema),
  tasks: z.array(localTaskSchema),
  events: z.array(calendarEventSchema),
  usage: z.array(usageEventSchema),
  experiments: z.array(promptExperimentSchema),
});
export type LocalWorkspace = z.infer<typeof localWorkspaceSchema>;
export const emptyWorkspace = (): LocalWorkspace => ({
  version: 1,
  revision: 0,
  entries: [],
  tasks: [],
  events: [],
  usage: [],
  experiments: [],
});

export function makeTask(
  input: NewTask,
  now = new Date().toISOString(),
  id = crypto.randomUUID(),
): LocalTask {
  return localTaskSchema.parse({
    id,
    description: "",
    subtasks: [],
    priority: "Medium",
    status: "To Do",
    estimatedHours: 0,
    dependencies: [],
    schedule: "",
    dueDate: "",
    ...input,
    title: input.title.trim(),
    createdAt: now,
    updatedAt: now,
    completedAt: input.status === "Completed" ? now : undefined,
  });
}
export function changeTask(
  task: LocalTask,
  patch: Partial<Task>,
  now = new Date().toISOString(),
): LocalTask {
  const status = patch.status ?? task.status;
  return localTaskSchema.parse({
    ...task,
    ...patch,
    id: task.id,
    createdAt: task.createdAt,
    updatedAt: now,
    completedAt: status === "Completed" ? (task.completedAt ?? now) : undefined,
  });
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function weekStart(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}
export function summarizeUsage(
  workspace: Pick<LocalWorkspace, "usage" | "tasks" | "entries">,
  now = new Date(),
) {
  const start = weekStart(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const previous = new Date(start);
  previous.setDate(previous.getDate() - 7);
  const current = workspace.usage.filter(
    (e) => new Date(e.createdAt) >= start && new Date(e.createdAt) < end,
  );
  const prior = workspace.usage.filter(
    (e) => new Date(e.createdAt) >= previous && new Date(e.createdAt) < start,
  );
  return {
    requests: current.length,
    completed: workspace.tasks.filter(
      (t) =>
        t.status === "Completed" &&
        t.completedAt &&
        new Date(t.completedAt) >= start &&
        new Date(t.completedAt) < end,
    ).length,
    saved: workspace.entries.length,
    previousRequests: prior.length,
    hasPrevious: workspace.usage.some((e) => new Date(e.createdAt) < start),
    daily: Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      return {
        date: localDate(day),
        label: day.toLocaleDateString(undefined, { weekday: "short" }),
        count: current.filter(
          (e) => localDate(new Date(e.createdAt)) === localDate(day),
        ).length,
      };
    }),
    breakdown: ["email", "meetings", "planner", "research", "checkpoint"].map(
      (feature) => ({
        feature,
        count: current.filter((e) => e.feature === feature).length,
      }),
    ),
  };
}
