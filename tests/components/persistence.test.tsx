// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  WorkspaceProvider,
  useWorkspace,
} from "../../src/components/workspace-provider";
import { emptyWorkspace } from "../../src/lib/local-data";
import { PREF_KEY } from "../../src/lib/storage";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  write: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("../../src/lib/indexeddb", () => ({
  readWorkspace: mocks.read,
  writeWorkspace: mocks.write,
  migrateLegacyHistory: async (_: unknown, value: unknown) => value,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
function Harness() {
  const workspace = useWorkspace();
  return (
    <>
      <span>{workspace.ready ? "Ready" : "Loading"}</span>
      <span data-testid="tasks">{workspace.tasks.length}</span>
      <span data-testid="error">{workspace.storageError}</span>
      <button
        onClick={() =>
          void workspace.addTask({ title: "Review source material" })
        }
      >
        Add task
      </button>
      <button
        onClick={() =>
          workspace.save({
            feature: "meetings",
            title: "Meeting",
            input: {
              transcript: "Large transcript contents",
              transcriptJobId: "job-1",
            },
            output: null,
          })
        }
      >
        Save transcript
      </button>
    </>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.read.mockResolvedValue(emptyWorkspace());
  mocks.write.mockResolvedValue(undefined);
});
afterEach(cleanup);
describe("workspace persistence feedback", () => {
  it("does not overwrite unreadable saved data with an empty restored workspace", async () => {
    mocks.read.mockRejectedValue(new Error("Corrupt stored record"));
    render(
      <WorkspaceProvider>
        <Harness />
      </WorkspaceProvider>,
    );
    await screen.findByText("Ready");
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    await waitFor(() =>
      expect(screen.getByTestId("tasks")).toHaveTextContent("1"),
    );
    expect(mocks.write).not.toHaveBeenCalled();
    expect(screen.getByTestId("error")).toHaveTextContent(
      "unavailable or damaged",
    );
  });
  it("blocks repeated stale-tab writes after a conflict so later retries cannot erase another tab", async () => {
    const conflict = new Error("Another tab changed this workspace.");
    conflict.name = "WorkspaceConflictError";
    mocks.write.mockRejectedValue(conflict);
    render(
      <WorkspaceProvider>
        <Harness />
      </WorkspaceProvider>,
    );
    await screen.findByText("Ready");
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("Another tab"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    await waitFor(() =>
      expect(screen.getByTestId("tasks")).toHaveTextContent("2"),
    );
    expect(mocks.write).toHaveBeenCalledTimes(1);
  });
  it("keeps work available in memory when storage is full without reporting success", async () => {
    mocks.write.mockRejectedValue(
      new DOMException("Full", "QuotaExceededError"),
    );
    render(
      <WorkspaceProvider>
        <Harness />
      </WorkspaceProvider>,
    );
    await screen.findByText("Ready");
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent(
        "could not be saved",
      ),
    );
    expect(screen.getByTestId("tasks")).toHaveTextContent("1");
    expect(mocks.success).not.toHaveBeenCalled();
    mocks.write.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    await waitFor(() =>
      expect(screen.getByTestId("error")).toBeEmptyDOMElement(),
    );
    expect(mocks.write.mock.lastCall?.[0].tasks).toHaveLength(2);
  });
  it("stores the transcript job reference without duplicating its large source", async () => {
    localStorage.setItem(PREF_KEY, "true");
    render(
      <WorkspaceProvider>
        <Harness />
      </WorkspaceProvider>,
    );
    await screen.findByText("Ready");
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Save transcript" })),
    );
    const entry = mocks.write.mock.lastCall?.[0].entries[0];
    expect(entry.input).toEqual({ transcriptJobId: "job-1" });
    expect(mocks.success).toHaveBeenCalledWith("Saved on this browser");
  });
});
