// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { ToolWorkspace } from "../../src/components/tool-workspace";
import { outputs } from "../fixtures";
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  setDraft: vi.fn(),
  push: vi.fn(),
  drafts: {},
  setExperimentDraft: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("../../src/components/workspace-provider", () => ({
  useWorkspace: () => ({
    drafts: mocks.drafts,
    draftLaunches: {},
    setExperimentDraft: mocks.setExperimentDraft,
    setDraft: mocks.setDraft,
    save: mocks.save,
    enabled: false,
    experiments: [],
    saveExperiment: vi.fn().mockResolvedValue(true),
    removeExperiment: vi.fn().mockResolvedValue(true),
    recordUsage: vi.fn().mockResolvedValue(true),
    tasks: [],
    addTask: vi.fn().mockResolvedValue("task-id"),
    addTasks: vi.fn().mockResolvedValue(["task-id"]),
  }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  mocks.drafts = {};
});
describe("editable AI workspace", () => {
  it("shows input validation without losing the prompt", async () => {
    render(<ToolWorkspace feature="email" />);
    fireEvent.change(screen.getByLabelText(/Subject or topic/), {
      target: { value: "Proposal" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Generate email/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("8 characters");
    expect(screen.getByLabelText(/Subject or topic/)).toHaveValue("Proposal");
  });
  it("prevents duplicate submissions and preserves input on service failure", async () => {
    let resolve!: (value: Response) => void;
    const fetch = vi.fn(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    render(<ToolWorkspace feature="email" />);
    fireEvent.change(screen.getByLabelText(/What would you like to say/), {
      target: { value: "Ask for feedback on our project" },
    });
    fireEvent.change(screen.getByLabelText(/Subject or topic/), {
      target: { value: "Proposal" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Generate email/ }));
    expect(
      screen.getByRole("button", { name: /Working on it/ }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toBeInTheDocument();
    resolve(Response.json({ error: "Quota reached" }, { status: 429 }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Quota reached");
    expect(screen.getByLabelText(/What would you like to say/)).toHaveValue(
      "Ask for feedback on our project",
    );
  });
  it("allows editing generated email fields", async () => {
    mocks.drafts = { email: { input: {}, output: outputs.email } };
    render(<ToolWorkspace feature="email" />);
    const body = screen.getByRole("textbox", { name: "Email body" });
    fireEvent.change(body, { target: { value: "Edited email" } });
    expect(body).toHaveValue("Edited email");
    await waitFor(() => expect(mocks.setDraft).toHaveBeenCalled());
  });
  it("tracks task completion from the real task list", () => {
    mocks.drafts = { planner: { input: {}, output: outputs.planner } };
    render(<ToolWorkspace feature="planner" />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Complete Design the homepage" }),
    );
    expect(screen.getByText("50% complete")).toBeInTheDocument();
  });
  it("supports approve and reopen with content retained", () => {
    mocks.drafts = {
      checkpoint: {
        input: {
          title: "Proposal",
          content: "A sufficiently detailed proposal to review.",
        },
        output: null,
      },
    };
    render(<ToolWorkspace feature="checkpoint" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByLabelText(/Content to review/)).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reopen for editing" }));
    expect(screen.getByLabelText(/Content to review/)).toBeEnabled();
  });
});
