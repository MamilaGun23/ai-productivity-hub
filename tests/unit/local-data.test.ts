import { describe, expect, it, vi } from "vitest";
import {
  changeTask,
  emptyWorkspace,
  localDate,
  makeTask,
  summarizeUsage,
} from "../../src/lib/local-data";
import { migrateLegacyHistory } from "../../src/lib/indexeddb";
import { HISTORY_KEY } from "../../src/lib/storage";

const stamp = "2026-10-21T10:00:00.000Z";
describe("durable local workspace", () => {
  it("retains the only legacy copy when the migration transaction fails", async () => {
    const entry = {
      id: "saved",
      feature: "email",
      title: "Draft",
      input: {},
      output: null,
      createdAt: stamp,
      updatedAt: stamp,
    };
    const storage = {
      getItem: vi.fn(() => JSON.stringify({ version: 1, entries: [entry] })),
      removeItem: vi.fn(),
    };
    const persist = vi
      .fn()
      .mockRejectedValue(
        new DOMException("Quota reached", "QuotaExceededError"),
      );
    await expect(
      migrateLegacyHistory(storage, emptyWorkspace(), persist),
    ).rejects.toThrow("Quota reached");
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
  it("merges legacy records without replacing newer IDB copies and removes LS after commit", async () => {
    const entry = {
      id: "saved",
      feature: "email" as const,
      title: "Draft",
      input: {},
      output: null,
      createdAt: stamp,
      updatedAt: stamp,
    };
    const storage = {
      getItem: () => JSON.stringify({ version: 1, entries: [entry] }),
      removeItem: vi.fn(),
    };
    const persist = vi.fn(async () => {
      expect(storage.removeItem).not.toHaveBeenCalled();
    });
    const result = await migrateLegacyHistory(
      storage,
      { ...emptyWorkspace(), entries: [{ ...entry, title: "Newer draft" }] },
      persist,
    );
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].title).toBe("Newer draft");
    expect(storage.removeItem).toHaveBeenCalledWith(HISTORY_KEY);
  });
  it("does not erase corrupt legacy data during a migration", async () => {
    const storage = { getItem: () => "{broken", removeItem: vi.fn() };
    const persist = vi.fn();
    await expect(
      migrateLegacyHistory(storage, emptyWorkspace(), persist),
    ).rejects.toThrow();
    expect(persist).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
  it("records completion time once, then clears it when a task is reopened", () => {
    const task = makeTask({ title: "Review output" }, stamp, "task");
    const completed = changeTask(
      task,
      { status: "Completed" },
      "2026-10-22T10:00:00.000Z",
    );
    const edited = changeTask(
      completed,
      { title: "Reviewed output" },
      "2026-10-23T10:00:00.000Z",
    );
    expect(edited.completedAt).toBe(completed.completedAt);
    expect(changeTask(edited, { status: "To Do" }).completedAt).toBeUndefined();
    expect(() =>
      makeTask({ title: "Task", dueDate: "2026-02-30" }, stamp, "bad"),
    ).toThrow();
  });
  it("counts only recorded usage and completions within the local calendar week", () => {
    const now = new Date(2026, 9, 23, 12);
    const monday = new Date(2026, 9, 19, 9).toISOString();
    const previous = new Date(2026, 9, 12, 9).toISOString();
    const task = makeTask(
      { title: "Current", status: "Completed" },
      monday,
      "current",
    );
    const oldTask = makeTask(
      { title: "Previous", status: "Completed" },
      previous,
      "old",
    );
    const data = {
      ...emptyWorkspace(),
      tasks: [task, oldTask],
      usage: [
        {
          id: "1",
          feature: "email" as const,
          status: "success" as const,
          kind: "generation",
          createdAt: monday,
        },
        {
          id: "2",
          feature: "email" as const,
          status: "error" as const,
          kind: "generation",
          createdAt: monday,
        },
        {
          id: "3",
          feature: "research" as const,
          status: "success" as const,
          kind: "generation",
          createdAt: previous,
        },
      ],
    };
    const summary = summarizeUsage(data, now);
    expect(summary.requests).toBe(2);
    expect(summary.completed).toBe(1);
    expect(summary.saved).toBe(0);
    expect(summary.previousRequests).toBe(1);
    expect(summary.hasPrevious).toBe(true);
    expect(
      summary.daily.find((day) => day.date === localDate(new Date(monday)))
        ?.count,
    ).toBe(2);
    expect(summarizeUsage(emptyWorkspace(), now).hasPrevious).toBe(false);
  });
});
