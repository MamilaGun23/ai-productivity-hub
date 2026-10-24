import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  batchSummaries,
  chunkTranscript,
  estimateTokens,
  MAX_TRANSCRIPT_BYTES,
  sectionBudget,
  utf8Bytes,
} from "../src/lib/transcripts/chunking";
import {
  extractTranscript,
  normalizeTranscript,
  validateTranscriptUpload,
} from "../src/lib/transcripts/extraction";
import {
  clearTranscriptJobs,
  exportTranscriptJobs,
  getTranscriptJob,
  getTranscriptNodes,
  getTranscriptSource,
  listTranscriptJobs,
  removeTranscriptJob,
} from "../src/lib/transcripts/storage";
import {
  createTranscriptJob,
  requestTranscriptStep,
  runTranscriptJob,
  TranscriptRequestError,
} from "../src/lib/transcripts/runner";
import {
  transcriptStepSchema,
  type SectionNotes,
  type TranscriptStep,
} from "../src/lib/transcripts/contracts";
import { outputs } from "./fixtures";
const notes: SectionNotes = {
  summary:
    "Alex agreed to review the launch, while the deadline remains unspecified.",
  participants: ["Alex"],
  actionItems: outputs.meetings.actionItems,
  decisions: ["Review before launch"],
  risks: [],
  questions: [],
};
beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
});
describe("large transcript chunking and browser extraction", () => {
  it("accepts a short final section without dropping its tail", () => {
    const source = `${"A".repeat(256)}\nX`;
    const chunks = chunkTranscript(source, 256, 30);
    expect(chunks.map((chunk) => chunk.text).join("")).toBe(source);
    expect(chunks.at(-1)?.text).toBe("\nX");
    expect(
      transcriptStepSchema.safeParse({
        phase: "map",
        content: chunks.at(-1)!.text,
      }).success,
    ).toBe(true);
  });
  it("preserves every character, Unicode boundary, speaker label and timestamp across sections", () => {
    const source = Array.from(
      { length: 120 },
      (_, i) => `[00:${i}] Zoë: Review the plan 🇿🇦 before Friday.\n`,
    ).join("");
    const chunks = chunkTranscript(source, 1200, 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.text).join("")).toBe(source);
    expect(chunks.every((chunk) => utf8Bytes(chunk.text) <= 1200)).toBe(true);
    expect(chunks.every((chunk) => !chunk.text.includes("�"))).toBe(true);
    expect(chunks[1].context).not.toBe("");
    expect(chunks[1].text).toMatch(/^\[00:/);
    expect(chunks.at(-1)?.end).toBe(source.length);
  });
  it("processes the full 25 MB through extraction, bounded sections, recursive merging and durable final output", async () => {
    const line = "Alex: Review the project before Friday.\n";
    const source = line
      .repeat(Math.ceil(MAX_TRANSCRIPT_BYTES / line.length))
      .slice(0, MAX_TRANSCRIPT_BYTES);
    const chunks = chunkTranscript(source);
    expect(chunks.map((chunk) => chunk.text).join("")).toBe(source);
    expect(chunks.length).toBeGreaterThan(1000);
    expect(utf8Bytes(source)).toBe(MAX_TRANSCRIPT_BYTES);
    const extracted = await extractTranscript(
      new File([source], "capacity.txt"),
    );
    const job = await createTranscriptJob(extracted.text, {
      title: "Capacity verification",
      date: "",
      detail: "Standard",
    });
    let primaryLength = 0,
      maps = 0,
      reductions = 0;
    const output = await runTranscriptJob(job.id, {
      request: async (input) => {
        expect(utf8Bytes(JSON.stringify(input))).toBeLessThan(65000);
        if (input.phase === "map") {
          primaryLength += input.content.length;
          maps++;
          return notes;
        }
        if (input.phase === "reduce") {
          reductions++;
          return {
            summary: "All supplied meeting sections have been considered.",
          };
        }
        return outputs.meetings;
      },
    });
    expect(primaryLength).toBe(extracted.text.length);
    expect(maps).toBe(job.total);
    expect(reductions).toBeGreaterThan(1);
    expect(output.actionItems).toHaveLength(1);
    expect((await getTranscriptJob(job.id))?.status).toBe("complete");
    expect(await getTranscriptSource(job.id)).toBe(extracted.text);
  }, 60000);
  it("uses a conservative token budget and ordered recursive batches", () => {
    expect(estimateTokens("中文")).toBe(6);
    expect(sectionBudget(32768)).toBeLessThan(32768 - 8192);
    expect(() => sectionBudget(1000)).toThrow();
    const values = Array.from({ length: 20 }, (_, index) => `Section ${index}`);
    expect(batchSummaries(values).flat()).toEqual(values);
    expect(() => batchSummaries(["x".repeat(15000)])).toThrow(/budget/);
  });
  it("validates file types, empty files, exact 25 MB cap and readable text", () => {
    expect(() =>
      validateTranscriptUpload({
        name: "meeting.docx",
        size: MAX_TRANSCRIPT_BYTES,
      }),
    ).not.toThrow();
    expect(() =>
      validateTranscriptUpload({
        name: "meeting.pdf",
        size: MAX_TRANSCRIPT_BYTES + 1,
      }),
    ).toThrow(/25 MB/);
    expect(() =>
      validateTranscriptUpload({ name: "meeting.exe", size: 20 }),
    ).toThrow(/TXT/);
    expect(() =>
      validateTranscriptUpload({ name: "meeting.txt", size: 0 }),
    ).toThrow(/empty/);
    expect(() => normalizeTranscript("  ")).toThrow(/readable/);
    expect(normalizeTranscript("\uFEFFAlex:\r\nReview launch\u0000")).toBe(
      "Alex:\nReview launch",
    );
  });
  it("reads long text and preserves VTT timing; rejects a corrupt PDF before parser execution", async () => {
    const text =
      "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nAlex: Review the launch.";
    expect(
      (await extractTranscript(new File([text], "meeting.vtt"))).text,
    ).toBe(text);
    await expect(
      extractTranscript(new File(["broken pdf document"], "meeting.pdf")),
    ).rejects.toThrow(/corrupt/);
  });
});
describe("durable local transcript jobs and hierarchical processing", () => {
  const source =
    "Alex: We should review the launch and confirm the checklist before proceeding.\n".repeat(
      45,
    );
  function request() {
    return vi.fn(async (input: TranscriptStep) =>
      input.phase === "map"
        ? { ...notes, summary: `Section ${input.section}: ${notes.summary}` }
        : input.phase === "reduce"
          ? {
              summary:
                "The complete team discussed launch readiness. Alex will review the checklist.",
            }
          : outputs.meetings,
    );
  }
  it("stores source once, processes all sections recursively and merges actions without overlap duplicates", async () => {
    const job = await createTranscriptJob(source, {
      title: "Launch",
      date: "",
      detail: "Detailed",
      contextTokens: 12000,
    });
    const generate = request();
    const stages: string[] = [];
    const output = await runTranscriptJob(job.id, {
      request: generate,
      onProgress: (value) => stages.push(value.stage),
    });
    expect(
      generate.mock.calls.filter(([input]) => input.phase === "map"),
    ).toHaveLength(job.total);
    expect(
      generate.mock.calls.some(([input]) => input.phase === "reduce"),
    ).toBe(true);
    expect(output.actionItems).toHaveLength(1);
    expect(output.metadata?.date).toBe("Not specified");
    expect(await getTranscriptSource(job.id)).toBe(source.trim());
    expect((await getTranscriptJob(job.id))?.status).toBe("complete");
    expect(stages).toContain(
      `Summarizing section ${job.total} of ${job.total}`,
    );
    expect((await exportTranscriptJobs())[0].sections).toHaveLength(
      job.total + 1,
    );
  });
  it("cancels after a completed section and resumes without paying for it again", async () => {
    const job = await createTranscriptJob(source, {
      title: "Resume",
      date: "",
      detail: "Standard",
      contextTokens: 12000,
    });
    const controller = new AbortController();
    const first = vi.fn(async () => {
      controller.abort();
      return notes;
    });
    await expect(
      runTranscriptJob(job.id, { request: first, signal: controller.signal }),
    ).rejects.toThrow();
    expect((await getTranscriptJob(job.id))?.status).toBe("paused");
    expect(await getTranscriptNodes(job.id)).toHaveLength(1);
    const second = request();
    await runTranscriptJob(job.id, { request: second });
    expect(
      second.mock.calls.filter(([input]) => input.phase === "map"),
    ).toHaveLength(job.total - 1);
  });
  it("retains source/checkpoints on rate limits and refuses early resume", async () => {
    const job = await createTranscriptJob(source, {
      title: "Quota",
      date: "",
      detail: "Standard",
    });
    const retryAt = new Date(Date.now() + 600000).toISOString();
    const generate = vi
      .fn()
      .mockRejectedValue(
        new TranscriptRequestError("Wait for quota", 429, retryAt),
      );
    await expect(
      runTranscriptJob(job.id, { request: generate }),
    ).rejects.toThrow(/quota/);
    expect((await getTranscriptJob(job.id))?.retryAt).toBe(retryAt);
    expect(await getTranscriptSource(job.id)).toBe(source.trim());
    await expect(
      runTranscriptJob(job.id, { request: generate }),
    ).rejects.toThrow(/cooling/);
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("deletes individual records and all local jobs, and reports unavailable storage", async () => {
    const job = await createTranscriptJob(source, {
      title: "Delete",
      date: "",
      detail: "Standard",
    });
    await removeTranscriptJob(job.id);
    expect(await getTranscriptSource(job.id)).toBeUndefined();
    expect(await listTranscriptJobs()).toEqual([]);
    await createTranscriptJob(source, {
      title: "Clear",
      date: "",
      detail: "Standard",
    });
    await clearTranscriptJobs();
    expect(await listTranscriptJobs()).toEqual([]);
    vi.stubGlobal("indexedDB", undefined);
    await expect(listTranscriptJobs()).rejects.toThrow(/browser cannot save/);
  });
  it("validates network responses and preserves provider retry time", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Please wait" }), {
          status: 429,
          headers: { "Retry-After": "30" },
        }),
      ),
    );
    await expect(
      requestTranscriptStep({
        phase: "map",
        title: "",
        date: "",
        detail: "Standard",
        content: source,
        context: "",
        section: 1,
        total: 1,
      }),
    ).rejects.toMatchObject({ status: 429, retryAt: expect.any(String) });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ output: { wrong: true } })),
    );
    await expect(
      requestTranscriptStep({
        phase: "map",
        title: "",
        date: "",
        detail: "Standard",
        content: source,
        context: "",
        section: 1,
        total: 1,
      }),
    ).rejects.toThrow(/invalid section/);
  });
});
