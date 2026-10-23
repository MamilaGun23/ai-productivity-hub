import type { Task } from "./contracts";
export function completion(tasks: Task[]) {
  return tasks.length
    ? Math.round(
        (tasks.filter((t) => t.status === "Completed").length / tasks.length) *
          100,
      )
    : 0;
}
export function isOverdue(
  date: string,
  today = new Date().toLocaleDateString("en-CA"),
) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date < today;
}
export function normalizeInput(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .trim();
}
export function validateTranscriptFile(name: string, size: number) {
  if (!/\.(txt|md|vtt)$/i.test(name))
    throw new Error("Choose a .txt, .md, or .vtt file.");
  if (size > 100000) throw new Error("Files must be smaller than 100 KB.");
}
export function parseTranscript(name: string, size: number, value: string) {
  validateTranscriptFile(name, size);
  let result = normalizeInput(value);
  if (/\.vtt$/i.test(name))
    result = normalizeInput(
      result
        .replace(/^WEBVTT[^\n]*\n/i, "")
        .replace(/^\d+[ \t]*\n(?=[^\n]*-->)/gm, "")
        .replace(/^[^\n]*-->[^\n]*$/gm, ""),
    );
  if (result.length > 12000)
    throw new Error("Transcript must be 12,000 characters or fewer.");
  return result;
}
export function formatOutput(value: unknown, level = 2): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value
      .map((v) =>
        typeof v === "string" ? `- ${v}` : formatOutput(v, level + 1),
      )
      .join("\n");
  if (value && typeof value === "object")
    return Object.entries(value)
      .map(
        ([key, v]) =>
          `${"#".repeat(Math.min(level, 5))} ${key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}\n${formatOutput(v, level + 1)}`,
      )
      .join("\n\n");
  return String(value ?? "");
}
function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@\-\t\r]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
export function tasksCsv(tasks: Task[]) {
  return [
    "Title,Description,Priority,Status,Estimated hours,Due date,Schedule,Dependencies",
    ...tasks.map((t) =>
      [
        t.title,
        t.description,
        t.priority,
        t.status,
        t.estimatedHours,
        t.dueDate,
        t.schedule,
        t.dependencies.join("; "),
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\r\n");
}
export function download(
  content: string,
  filename: string,
  mime = "text/markdown",
) {
  const url = URL.createObjectURL(
    new Blob([content], { type: `${mime};charset=utf-8` }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.replace(/[^a-z0-9._-]/gi, "-");
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
