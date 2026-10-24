import { dateSchema, type ActionItem, type Task } from "./contracts";
export function actionsToTasks(actions: ActionItem[]): Task[] {
  return actions.map((a, i) => ({
    id: `action-${i + 1}`,
    title: a.description.slice(0, 500),
    description: `${a.description}\nOwner: ${a.owner || "Not specified"}\nDeadline: ${a.deadline || "Not specified"}`,
    priority: a.priority === "Not specified" ? "Medium" : a.priority,
    status: a.completed ? "Completed" : "To Do",
    subtasks: [],
    dependencies: [],
    estimatedHours: 0,
    schedule: a.deadline || "Not specified",
    dueDate:
      a.deadline && dateSchema.safeParse(a.deadline).success ? a.deadline : "",
  }));
}
export function emailFromTask(task: Task) {
  return {
    purpose: `Draft a follow-up email asking for an update on ${task.title}.`,
    topic: task.title.slice(0, 300),
    context:
      `${task.description}\nStatus: ${task.status}\nDue: ${task.dueDate || "Not specified"}\nPriority: ${task.priority}`.slice(
        0,
        12000,
      ),
    tone: "Professional",
    length: "Medium",
  };
}

/** Stable local identifiers survive plan reordering; hashes are identifiers, not security tokens. */
export function prepareTaskImport(
  tasks: Task[],
  selectedIds: string[],
  planId: string,
  existingIds: string[],
): Task[] {
  const identifiers = new Map(
    tasks.map((task) => {
      let hash = BigInt("14695981039346656037");
      for (const character of task.id)
        hash =
          ((hash ^ BigInt(character.codePointAt(0)!)) *
            BigInt("1099511628211")) &
          BigInt("18446744073709551615");
      return [task.id, `plan-${planId}-${hash.toString(36)}`];
    }),
  );
  if (new Set(identifiers.values()).size !== tasks.length)
    throw new Error(
      "Task identifiers conflict. Generate a fresh plan before adding it.",
    );
  const selected = new Set(selectedIds),
    existing = new Set(existingIds);
  return tasks
    .filter((task) => selected.has(task.id))
    .map((task) => {
      for (const dependency of task.dependencies)
        if (
          !selected.has(dependency) &&
          !existing.has(identifiers.get(dependency)!)
        )
          throw new Error(
            `Include the prerequisite for “${task.title}”: ${tasks.find((candidate) => candidate.id === dependency)?.title || dependency}.`,
          );
      return {
        ...task,
        id: identifiers.get(task.id)!,
        dependencies: task.dependencies.map((id) => identifiers.get(id)!),
      };
    });
}
