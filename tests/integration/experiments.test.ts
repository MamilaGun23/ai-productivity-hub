import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), limit: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mocks.generate };
  },
}));
vi.mock("../../src/lib/security", () => ({ enforceLimit: mocks.limit }));
import { handleExperiment } from "../../src/lib/ai/experiments";
import { ServiceError } from "../../src/lib/ai/gemini";

const input = {
  prompt: "Explain responsible AI to a new student.",
  action: "generate",
};
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/experiments", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.generate.mockReset().mockResolvedValue({
    text: JSON.stringify({
      response: "Keep a person involved in important decisions.",
    }),
  });
  mocks.limit.mockReset();
  vi.stubEnv("GEMINI_API_KEY", "private-test-value");
});

describe("prompt experiment API", () => {
  it("requires the improved prompt when testing prompt refinement", async () => {
    const body = {
      ...input,
      action: "refine-prompt",
      instruction: "Specify an audience and use simple terms",
    };
    expect((await handleExperiment(request(body))).status).toBe(502);
    mocks.generate.mockResolvedValue({
      text: JSON.stringify({
        refinedPrompt:
          "Explain responsible AI using simple terms for a new student.",
        response: "People should review important AI decisions.",
      }),
    });
    const response = await handleExperiment(request(body));
    expect(response.status).toBe(200);
    expect((await response.json()).output.refinedPrompt).toContain(
      "simple terms",
    );
  });
  it("generates and refines text through the shared structured provider", async () => {
    for (const body of [
      input,
      {
        ...input,
        action: "refine",
        instruction: "Make it shorter",
        previousResponse: "Keep a person involved in important decisions.",
      },
    ]) {
      const response = await handleExperiment(request(body));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        output: { response: "Keep a person involved in important decisions." },
      });
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(mocks.generate).toHaveBeenCalledTimes(2);
    expect(mocks.generate.mock.calls[0][0].config.systemInstruction).toContain(
      "untrusted",
    );
  });
  it("rejects bad input and cross-origin requests before calling Gemini", async () => {
    expect(
      (await handleExperiment(request({ ...input, action: "refine" }))).status,
    ).toBe(400);
    expect(
      (
        await handleExperiment(
          request(input, { origin: "https://other.example" }),
        )
      ).status,
    ).toBe(403);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("enforces streamed body bounds even without Content-Length", async () => {
    expect(
      (
        await handleExperiment(
          request({ ...input, ignored: "x".repeat(65001) }),
        )
      ).status,
    ).toBe(413);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("honors managed rate limiting and supplies retry guidance", async () => {
    mocks.limit.mockRejectedValue(
      new ServiceError(429, "Please wait before retrying."),
    );
    const response = await handleExperiment(request(input));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("600");
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejects malformed provider output without exposing credentials", async () => {
    mocks.generate.mockResolvedValue({
      text: JSON.stringify({ response: "" }),
    });
    const response = await handleExperiment(request(input));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private-test-value");
  });
  it("reports JSON and media errors without provider work", async () => {
    expect(
      (
        await handleExperiment(
          new Request("http://localhost/api/experiments", {
            method: "POST",
            body: "{}",
          }),
        )
      ).status,
    ).toBe(415);
    expect(
      (
        await handleExperiment(
          new Request("http://localhost/api/experiments", {
            method: "POST",
            body: "{",
            headers: { "content-type": "application/json" },
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
