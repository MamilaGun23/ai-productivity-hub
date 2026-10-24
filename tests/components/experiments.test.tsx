// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { PromptExperiments } from "../../src/components/prompt-experiments";
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  remove: vi.fn(),
  usage: vi.fn(),
  experiments: [],
  setDraft: vi.fn(),
}));
vi.mock("../../src/components/workspace-provider", () => ({
  useWorkspace: () => ({
    experiments: mocks.experiments,
    saveExperiment: mocks.save,
    removeExperiment: mocks.remove,
    recordUsage: mocks.usage,
    setExperimentDraft: mocks.setDraft,
  }),
}));

beforeEach(() => {
  mocks.save.mockReset().mockResolvedValue(true);
  mocks.remove.mockReset().mockResolvedValue(true);
  mocks.usage.mockReset().mockResolvedValue(true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("prompt experiment workspace", () => {
  it("improves the prompt and keeps both actual prompt versions", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ output: { response: "An initial explanation." } }),
      )
      .mockResolvedValueOnce(
        Response.json({
          output: {
            response: "A student-friendly explanation.",
            refinedPrompt:
              "Explain responsible AI with three simple examples for a student.",
          },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    render(<PromptExperiments />);
    fireEvent.change(screen.getByLabelText("Prompt to test"), {
      target: { value: "Explain responsible AI." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Test prompt" }));
    await screen.findByLabelText("Experiment response");
    fireEvent.change(
      screen.getByLabelText("How should this response improve?"),
      {
        target: {
          value: "Give three examples and specify a student audience.",
        },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Improve prompt & test" }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Prompt to test")).toHaveValue(
        "Explain responsible AI with three simple examples for a student.",
      ),
    );
    expect(
      screen.getByText("Prompt: Explain responsible AI."),
    ).toBeInTheDocument();
    expect(JSON.parse(fetch.mock.calls[1][1].body).action).toBe(
      "refine-prompt",
    );
  });
  it("tests, edits, refines, compares and explicitly saves versions", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          output: { response: "First response with a long introduction." },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ output: { response: "A shorter response." } }),
      );
    vi.stubGlobal("fetch", fetch);
    render(<PromptExperiments />);
    fireEvent.change(screen.getByLabelText("Prompt to test"), {
      target: { value: "Explain responsible AI to a new student." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Test prompt" }));
    const result = await screen.findByLabelText("Experiment response");
    fireEvent.change(result, { target: { value: "First response, edited." } });
    fireEvent.change(
      screen.getByLabelText("How should this response improve?"),
      { target: { value: "Make it shorter" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Refine response" }));
    await waitFor(() => expect(result).toHaveValue("A shorter response."));
    expect(screen.getByText("Earlier response")).toBeInTheDocument();
    expect(screen.getByText("First response, edited.")).toBeInTheDocument();
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
      action: "refine",
      previousResponse: "First response, edited.",
      instruction: "Make it shorter",
    });
    expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save experiment" }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({
          versions: [
            expect.objectContaining({ response: "First response, edited." }),
            expect.objectContaining({ response: "A shorter response." }),
          ],
        }),
      ),
    );
    expect(mocks.usage).toHaveBeenCalledWith(
      "checkpoint",
      "success",
      "prompt-experiment",
    );
  });
  it("preserves the prompt and earlier response when a refinement fails", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ output: { response: "An earlier useful response." } }),
      )
      .mockResolvedValueOnce(
        Response.json(
          { error: "Rate limit reached. Try later." },
          { status: 429 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    render(<PromptExperiments />);
    fireEvent.change(screen.getByLabelText("Prompt to test"), {
      target: { value: "Write a project brief with next steps." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Test prompt" }));
    await screen.findByLabelText("Experiment response");
    fireEvent.change(
      screen.getByLabelText("How should this response improve?"),
      { target: { value: "Use simpler words" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Refine response" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Rate limit reached",
    );
    expect(screen.getByLabelText("Experiment response")).toHaveValue(
      "An earlier useful response.",
    );
    expect(screen.getByLabelText("Prompt to test")).toHaveValue(
      "Write a project brief with next steps.",
    );
  });
  it("rejects a short prompt without spending a provider request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<PromptExperiments />);
    fireEvent.click(screen.getByRole("button", { name: "Test prompt" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "at least 8 characters",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("prevents duplicate runs while a request is pending", async () => {
    let resolve!: (response: Response) => void;
    const fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    render(<PromptExperiments />);
    fireEvent.change(screen.getByLabelText("Prompt to test"), {
      target: { value: "Write a clear explanation of AI." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Test prompt" }));
    expect(
      screen.getByRole("button", { name: /Running experiment/ }),
    ).toBeDisabled();
    expect(fetch).toHaveBeenCalledTimes(1);
    resolve(Response.json({ output: { response: "A clear explanation." } }));
    await screen.findByLabelText("Experiment response");
  });
});
