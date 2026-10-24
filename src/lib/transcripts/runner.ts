import { outputSchemas } from "../contracts";
import {
  batchSummaries,
  chunkTranscript,
  sectionBudget,
  utf8Bytes,
} from "./chunking";
import { normalizeTranscript } from "./extraction";
import {
  resultSchemas,
  type SectionNotes,
  type TranscriptJob,
  type TranscriptStep,
} from "./contracts";
import {
  getTranscriptJob,
  getTranscriptNodes,
  getTranscriptSource,
  saveTranscriptJob,
  saveTranscriptNode,
  saveTranscriptSource,
} from "./storage";

export class TranscriptRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAt?: string,
  ) {
    super(message);
  }
}
export async function requestTranscriptStep(
  input: TranscriptStep,
  signal?: AbortSignal,
) {
  let response: Response;
  try {
    response = await fetch("/api/transcripts/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(55000)])
        : AbortSignal.timeout(55000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new TranscriptRequestError(
      error instanceof DOMException && error.name === "TimeoutError"
        ? "This section timed out. Resume to retry; completed sections are saved."
        : "The network connection was interrupted. Resume to retry; completed sections are saved.",
      502,
    );
  }
  let json: { output?: unknown; error?: string };
  try {
    json = await response.json();
  } catch {
    throw new TranscriptRequestError(
      "The server returned an unreadable response. Resume to retry this section.",
      response.status,
    );
  }
  if (!response.ok) {
    const retry = response.headers.get("Retry-After");
    const retryAt =
      response.status === 429
        ? new Date(Date.now() + (Number(retry) || 600) * 1000).toISOString()
        : undefined;
    throw new TranscriptRequestError(
      json.error || "This section could not be processed. Resume to retry.",
      response.status,
      retryAt,
    );
  }
  const parsed = resultSchemas[input.phase].safeParse(json.output);
  if (!parsed.success)
    throw new TranscriptRequestError(
      "The AI returned an invalid section. Your source and completed sections are saved; resume to retry.",
      502,
    );
  return parsed.data;
}
export async function createTranscriptJob(
  source: string,
  options: {
    title: string;
    date: string;
    detail: TranscriptJob["detail"];
    filename?: string;
    bytes?: number;
    contextTokens?: number;
  },
) {
  const text = normalizeTranscript(source);
  const chunkBytes = sectionBudget(options.contextTokens);
  const chunks = chunkTranscript(text, chunkBytes);
  const now = new Date().toISOString();
  const job: TranscriptJob = {
    id: crypto.randomUUID(),
    title: options.title || "Meeting summary",
    date: options.date,
    detail: options.detail,
    filename: options.filename || "Pasted transcript",
    bytes: options.bytes ?? utf8Bytes(text),
    sourceLength: text.length,
    chunkBytes,
    total: chunks.length,
    completed: 0,
    stage: "Ready to summarize",
    status: "ready",
    createdAt: now,
    updatedAt: now,
  };
  await saveTranscriptSource(job.id, text);
  await saveTranscriptJob(job);
  return job;
}
type RunOptions = {
  signal?: AbortSignal;
  onProgress?: (job: TranscriptJob) => void;
  onRequestCompleted?: (status: "success" | "error") => void;
  request?: (input: TranscriptStep, signal?: AbortSignal) => Promise<unknown>;
};
export async function runTranscriptJob(id: string, options: RunOptions = {}) {
  const execute = async () => {
    let job = await getTranscriptJob(id);
    if (!job) throw new Error("This saved transcript job could not be found.");
    const source = await getTranscriptSource(id);
    if (!source)
      throw new Error(
        "The saved transcript source is unavailable. Upload it again to start a new job.",
      );
    if (job.status === "complete" && job.output) {
      options.onProgress?.(job);
      return job.output;
    }
    if (job.retryAt && new Date(job.retryAt).getTime() > Date.now())
      throw new TranscriptRequestError(
        "The public request allowance is still cooling down. Resume after the shown time.",
        429,
        job.retryAt,
      );
    const nodes = new Map(
      (await getTranscriptNodes(id)).map((node) => [node.key, node.result]),
    );
    const chunks = chunkTranscript(source, job.chunkBytes);
    const request = options.request ?? requestTranscriptStep;
    const update = async (patch: Partial<TranscriptJob>) => {
      job = { ...job!, ...patch, updatedAt: new Date().toISOString() };
      await saveTranscriptJob(job);
      options.onProgress?.(job);
    };
    const step = async (
      phase: TranscriptStep["phase"],
      content: string,
      section: number,
      total: number,
      context = "",
    ) => {
      options.signal?.throwIfAborted();
      try {
        const result = await request(
          {
            phase,
            content,
            context,
            section,
            total,
            title: job!.title,
            date: job!.date,
            detail: job!.detail,
          },
          options.signal,
        );
        options.onRequestCompleted?.("success");
        return result;
      } catch (error) {
        options.onRequestCompleted?.("error");
        throw error;
      }
    };
    try {
      await update({ status: "running", error: undefined, retryAt: undefined });
      const notes: SectionNotes[] = [];
      for (const chunk of chunks) {
        options.signal?.throwIfAborted();
        const key = `map:${chunk.index}`;
        let note = nodes.get(key) as SectionNotes | undefined;
        if (!note) {
          await update({
            stage: `Summarizing section ${chunk.index + 1} of ${chunks.length}`,
            completed: chunk.index,
          });
          note = resultSchemas.map.parse(
            await step(
              "map",
              chunk.text,
              chunk.index + 1,
              chunks.length,
              chunk.context,
            ),
          );
          await saveTranscriptNode({
            id: `${id}:${key}`,
            jobId: id,
            key,
            result: note,
          });
        }
        notes.push(note);
        await update({ completed: chunk.index + 1 });
      }
      let summaries = notes.map((note) => note.summary);
      let level = 0;
      while (summaries.length > 1) {
        const batches = batchSummaries(summaries);
        const next: string[] = [];
        for (let index = 0; index < batches.length; index++) {
          options.signal?.throwIfAborted();
          const key = `reduce:${level}:${index}`;
          let result = nodes.get(key) as { summary: string } | undefined;
          if (!result) {
            await update({
              stage: `Combining summaries · level ${level + 1}, group ${index + 1} of ${batches.length}`,
            });
            result = resultSchemas.reduce.parse(
              await step(
                "reduce",
                batches[index].join("\n\n"),
                index + 1,
                batches.length,
              ),
            );
            await saveTranscriptNode({
              id: `${id}:${key}`,
              jobId: id,
              key,
              result,
            });
          }
          next.push(result.summary);
        }
        if (next.length >= summaries.length)
          throw new Error(
            "Summary reduction did not make progress. Your completed sections remain saved.",
          );
        summaries = next;
        level++;
      }
      await update({ stage: "Preparing the final meeting report" });
      const final = resultSchemas.final.parse(
        await step(
          "final",
          `Complete meeting synthesis:\n${summaries[0]}`,
          1,
          1,
        ),
      );
      const actions = new Map<string, SectionNotes["actionItems"][number]>();
      for (const note of notes)
        for (const action of note.actionItems) {
          const key = [action.description, action.owner, action.deadline]
            .map((value) => value.trim().toLowerCase())
            .join("|");
          const prior = actions.get(key);
          actions.set(
            key,
            prior
              ? { ...prior, completed: prior.completed || action.completed }
              : action,
          );
        }
      const unique = (values: string[]) => [
        ...new Map(
          values
            .filter((value) => value.trim())
            .map((value) => [value.trim().toLowerCase(), value]),
        ).values(),
      ];
      const output = outputSchemas.meetings.parse({
        ...final,
        actionItems: [...actions.values()],
        decisions: unique(notes.flatMap((note) => note.decisions)),
        risks: unique(notes.flatMap((note) => note.risks)),
        questions: unique(notes.flatMap((note) => note.questions)),
        metadata: {
          title: job.title,
          date: job.date || "Not specified",
          purpose: final.metadata?.purpose || "Not specified",
          participants: unique(notes.flatMap((note) => note.participants)),
        },
      });
      await update({
        output,
        status: "complete",
        stage: "Summary complete · review before using",
        completed: chunks.length,
      });
      return output;
    } catch (error) {
      const cancelled =
        options.signal?.aborted ||
        (error instanceof DOMException && error.name === "AbortError");
      await update({
        status:
          cancelled ||
          (error instanceof TranscriptRequestError && error.status === 429)
            ? "paused"
            : "failed",
        stage: cancelled
          ? "Paused · resume saved sections anytime"
          : "Processing paused · completed sections saved",
        error: cancelled
          ? undefined
          : error instanceof Error
            ? error.message
            : "Processing failed. Resume to retry.",
        retryAt:
          error instanceof TranscriptRequestError ? error.retryAt : undefined,
      });
      throw error;
    }
  };
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request(
      `aph-transcript:${id}`,
      { ifAvailable: true },
      (lock) => {
        if (!lock)
          throw new Error(
            "This transcript is already processing in another tab.",
          );
        return execute();
      },
    );
  return execute();
}
