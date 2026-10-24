import { describe, expect, it } from "vitest";
import {
  actionsToTasks,
  emailFromTask,
  prepareTaskImport,
} from "@/lib/workflows";
import { outputs } from "../fixtures";
import { commandInput, commandIntent } from "@/lib/command";
describe("explicit cross-tool flows", () => {
  it("keeps task identifiers and dependencies stable after reordering, and requires selected prerequisites", () => {
    const tasks = outputs.planner.tasks;
    const imported = prepareTaskImport(
      tasks,
      tasks.map((task) => task.id),
      "plan-one",
      [],
    );
    const reordered = prepareTaskImport(
      [...tasks].reverse(),
      tasks.map((task) => task.id),
      "plan-one",
      [],
    );
    expect(imported[1].dependencies).toEqual([imported[0].id]);
    expect(reordered.find((task) => task.title === imported[0].title)?.id).toBe(
      imported[0].id,
    );
    expect(() =>
      prepareTaskImport(tasks, [tasks[1].id], "plan-one", []),
    ).toThrow(/prerequisite/);
    expect(
      prepareTaskImport(tasks, [tasks[1].id], "plan-one", [imported[0].id])[0]
        .dependencies,
    ).toEqual([imported[0].id]);
  });
  it("routes only unambiguous intent and leaves ambiguity for user choice", () => {
    expect(commandIntent("Write a follow-up email")).toBe("email");
    expect(commandIntent("Summarize my meeting")).toBe("meetings");
    expect(commandIntent("Plan my week")).toBe("planner");
    expect(commandIntent("Research cloud computing")).toBe("research");
    expect(commandIntent("Help me be productive")).toBeNull();
    expect(commandIntent("Email the meeting notes")).toBeNull();
    expect(commandInput("email", "Write an email").purpose).toBe(
      "Write an email",
    );
  });
  it("preserves every selected action without inventing absolute dates", () => {
    const tasks = actionsToTasks([
      {
        description: "Send the report",
        owner: "Alex",
        deadline: "next Friday",
        priority: "Not specified",
        completed: false,
      },
      {
        description: "Review feedback",
        owner: "Not specified",
        deadline: "2026-10-30",
        priority: "High",
        completed: false,
      },
    ]);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].dueDate).toBe("");
    expect(tasks[0].description).toContain("next Friday");
    expect(tasks[1].dueDate).toBe("2026-10-30");
    expect(emailFromTask(tasks[0]).context).toContain("Alex");
  });
});
