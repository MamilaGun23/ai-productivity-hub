import { beforeEach, describe, expect, it, vi } from "vitest";
import { outputs } from "./fixtures";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), limit: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mocks.generate };
  },
}));
vi.mock("../src/lib/security", () => ({ enforceLimit: mocks.limit }));
import { handleTranscriptStep } from "../src/lib/transcripts/handler";
import { generateStructured } from "../src/lib/ai/gemini";
import { outputSchemas } from "../src/lib/contracts";
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/transcripts/step", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
const input = {
  phase: "map",
  content: "Alex: Please review the launch checklist before Friday.",
};
beforeEach(() => {
  mocks.generate.mockReset();
  mocks.limit.mockReset();
  vi.stubEnv("GEMINI_API_KEY", "private-test-secret");
});
describe("bounded transcript API and provider recovery", () => {
  it("runs validated map, reduce and final phases behind the same managed limiter", async () => {
    const responses = {
      map: {
        summary: "Alex will review the checklist.",
        participants: ["Alex"],
        decisions: [],
        actionItems: outputs.meetings.actionItems,
        risks: [],
        questions: [],
      },
      reduce: { summary: "The team reviewed the launch checklist." },
      final: outputs.meetings,
    };
    for (const phase of ["map", "reduce", "final"] as const) {
      mocks.generate.mockResolvedValue({
        text: JSON.stringify(responses[phase]),
      });
      const response = await handleTranscriptStep(request({ ...input, phase }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ output: responses[phase] });
    }
    expect(mocks.limit).toHaveBeenCalledTimes(3);
  });
  it("rejects oversized streamed bodies and cross-origin input without a provider call", async () => {
    expect(
      (await handleTranscriptStep(request({ content: "x".repeat(65001) })))
        .status,
    ).toBe(413);
    expect(
      (
        await handleTranscriptStep(
          request(input, { origin: "https://untrusted.example" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await handleTranscriptStep(request({ ...input, phase: "invalid" })))
        .status,
    ).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("retries transient provider failures with backoff and validates recovered output", async () => {
    vi.useFakeTimers();
    try {
      mocks.generate
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue({ text: JSON.stringify(outputs.email) });
      const pending = generateStructured(
        outputSchemas.email,
        "Compose an email",
        { topic: "Review" },
      );
      await vi.advanceTimersByTimeAsync(1000);
      await expect(pending).resolves.toEqual(outputs.email);
      expect(mocks.generate).toHaveBeenCalledTimes(2);
      expect(
        mocks.generate.mock.calls[0][0].config.httpOptions.retryOptions
          .attempts,
      ).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
  it("does not retry quota/auth/schema failures or leak private provider messages", async () => {
    mocks.generate.mockRejectedValue({
      status: 429,
      message: "private-test-secret",
    });
    const response = await handleTranscriptStep(request(input));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("600");
    expect(await response.text()).not.toContain("private-test-secret");
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    mocks.generate.mockReset().mockResolvedValue({ text: "{}" });
    expect((await handleTranscriptStep(request(input))).status).toBe(502);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
  it("bounds timeout retries while treating an explicit cancellation separately", async () => {
    vi.useFakeTimers();
    try {
      mocks.generate.mockRejectedValue(
        new DOMException("The operation was aborted", "AbortError"),
      );
      const pending = generateStructured(
        outputSchemas.email,
        "Compose an email",
        {},
      );
      const assertion = expect(pending).rejects.toMatchObject({ status: 504 });
      await vi.advanceTimersByTimeAsync(3000);
      await assertion;
      expect(mocks.generate).toHaveBeenCalledTimes(3);
      mocks.generate.mockClear();
      const controller = new AbortController();
      controller.abort();
      await expect(
        generateStructured(
          outputSchemas.email,
          "Compose an email",
          {},
          { signal: controller.signal },
        ),
      ).rejects.toMatchObject({ name: "AbortError" });
      expect(mocks.generate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
