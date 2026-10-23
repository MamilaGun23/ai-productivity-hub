import { beforeEach, describe, it, expect, vi } from "vitest";
import { outputs, emailInput } from "../fixtures";
const mock = vi.hoisted(() => ({ generate: vi.fn(), limit: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mock.generate };
  },
}));
vi.mock("../../src/lib/security", () => ({ enforceLimit: mock.limit }));
import { handleAI } from "../../src/lib/ai/handler";
import { ServiceError } from "../../src/lib/ai/gemini";
function request(body: unknown, extra: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/ai/email", {
    method: "POST",
    headers: { "content-type": "application/json", ...extra },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  mock.generate.mockReset();
  mock.limit.mockReset();
  vi.stubEnv("GEMINI_API_KEY", "test-secret-never-return");
  mock.generate.mockResolvedValue({ text: JSON.stringify(outputs.email) });
});
describe("validated AI route with mocked Gemini SDK", () => {
  it("executes structured generation for every tool schema", async () => {
    const inputs = {
      email: emailInput,
      meetings: {
        transcript: "Alex will review the launch checklist.",
        detail: "Standard",
      },
      planner: {
        title: "Portfolio launch",
        description: "Build and launch my portfolio website.",
        priority: "High",
      },
      research: {
        topic: "Responsible AI",
        depth: "Standard",
        mode: "knowledge",
      },
      checkpoint: {
        title: "Review draft",
        content: "Please review the project proposal with the team.",
        action: "review",
      },
    };
    for (const feature of Object.keys(inputs) as (keyof typeof inputs)[]) {
      mock.generate.mockResolvedValue({
        text: JSON.stringify(outputs[feature]),
      });
      const res = await handleAI(request(inputs[feature]), feature);
      expect(res.status, feature).toBe(200);
      expect(await res.json()).toEqual({ output: outputs[feature] });
    }
  });
  it("returns a validated response and passes structured output config", async () => {
    const res = await handleAI(request(emailInput), "email");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ output: outputs.email });
    expect(mock.generate.mock.calls[0][0].config.responseMimeType).toBe(
      "application/json",
    );
  });
  it("rejects invalid input without calling Gemini", async () => {
    expect(
      (await handleAI(request({ ...emailInput, purpose: "" }), "email")).status,
    ).toBe(400);
    expect(mock.generate).not.toHaveBeenCalled();
  });
  it("reports missing API configuration", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = await handleAI(request(emailInput), "email");
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("GEMINI_API_KEY");
  });
  it("maps quota errors without exposing provider messages", async () => {
    mock.generate.mockRejectedValue({
      status: 429,
      message: "test-secret-never-return",
    });
    const res = await handleAI(request(emailInput), "email");
    expect(res.status).toBe(429);
    expect(await res.text()).not.toContain("test-secret-never-return");
  });
  it("rejects malformed and schema-invalid AI output", async () => {
    for (const text of ["invalid", JSON.stringify({ subject: 2, body: "" })]) {
      mock.generate.mockResolvedValue({ text });
      expect((await handleAI(request(emailInput), "email")).status).toBe(502);
    }
  });
  it("rejects untrusted origins and oversized streamed bodies", async () => {
    expect(
      (
        await handleAI(
          request(emailInput, { origin: "https://evil.example" }),
          "email",
        )
      ).status,
    ).toBe(403);
    expect(
      (await handleAI(request({ data: "x".repeat(65001) }), "email")).status,
    ).toBe(413);
  });
  it("enforces the managed limiter before calling the provider", async () => {
    mock.limit.mockRejectedValue(new ServiceError(429, "Please wait."));
    expect((await handleAI(request(emailInput), "email")).status).toBe(429);
    expect(mock.generate).not.toHaveBeenCalled();
  });
  it("returns controlled network, timeout and unexpected failures", async () => {
    mock.generate.mockRejectedValue(
      new Error("Network test-secret-never-return"),
    );
    let res = await handleAI(request(emailInput), "email");
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("test-secret");
    mock.generate.mockRejectedValue(new Error("timeout"));
    res = await handleAI(request(emailInput), "email");
    expect(res.status).toBe(504);
  });
  it("rejects malformed JSON, wrong media type and unknown tools", async () => {
    expect(
      (
        await handleAI(
          new Request("http://localhost/api/ai/email", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{",
          }),
          "email",
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handleAI(
          new Request("http://localhost", { method: "POST", body: "text" }),
          "email",
        )
      ).status,
    ).toBe(415);
    expect((await handleAI(request(emailInput), "unknown")).status).toBe(404);
  });
  it("rejects research output with the wrong evidence basis", async () => {
    mock.generate.mockResolvedValue({ text: JSON.stringify(outputs.research) });
    const body = {
      topic: "Review this article",
      depth: "Standard",
      mode: "source",
      source: "This article discusses human oversight of AI.",
    };
    expect((await handleAI(request(body), "research")).status).toBe(502);
  });
});
