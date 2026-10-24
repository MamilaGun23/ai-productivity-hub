"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Mail,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button, ConfirmDialog } from "@/components/ui";
import {
  localDate,
  type CalendarEvent,
  type LocalTask,
} from "@/lib/local-data";
import type { Task } from "@/lib/contracts";

type Editor =
  | { kind: "task"; record?: LocalTask }
  | { kind: "event"; record?: CalendarEvent };
export function FocusCalendar() {
  const workspace = useWorkspace();
  const router = useRouter();
  const today = localDate();
  const [selectedDate, setSelectedDate] = useState(today);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [showAll, setShowAll] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const focus = workspace.tasks.filter(
    (task) => showAll || !task.dueDate || task.dueDate <= today,
  );
  const complete = focus.filter((task) => task.status === "Completed").length;
  const progress = focus.length
    ? Math.round((complete / focus.length) * 100)
    : 0;
  const selectedTasks = workspace.tasks.filter(
    (task) => task.dueDate === selectedDate,
  );
  const selectedEvents = workspace.events
    .filter((event) => event.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));
  const start = (month.getDay() + 6) % 7;
  const numberOfDays = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const monthLabel = month.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  function followUp(task: LocalTask) {
    workspace.setDraft({
      feature: "email",
      title: `Follow up: ${task.title}`,
      input: {
        purpose: `Write a follow-up email about this task: ${task.title}. Ask for a progress update and confirm the next step.`,
        topic: task.title.slice(0, 300),
        recipient: "",
        tone: "Professional",
        length: "Medium",
        context: [
          task.description,
          `Status: ${task.status}`,
          task.dueDate ? `Due: ${task.dueDate}` : "No deadline supplied",
        ]
          .join("\n")
          .slice(0, 12000),
      },
      output: null,
    });
    router.push("/email");
  }
  // Calendar dates belong to the browser timezone/locale. Keep SSR and the first
  // client render identical; render dates once local workspace restoration finishes.
  if (!workspace.ready)
    return (
      <div className="focus-calendar">
        <section className="panel glass-card focus-panel">
          <h2>Today’s focus</h2>
          <p role="status">Restoring your local tasks and calendar…</p>
        </section>
      </div>
    );
  return (
    <div className="focus-calendar">
      <section
        className="panel glass-card focus-panel"
        aria-labelledby="focus-title"
      >
        <div className="widget-heading">
          <div>
            <span className="eyebrow">ONE STEP AT A TIME</span>
            <h2 id="focus-title">Today’s focus</h2>
          </div>
          <Button
            variant="ghost"
            aria-label="Add task"
            disabled={!workspace.ready}
            onClick={() => setEditor({ kind: "task" })}
          >
            <Plus size={18} />
          </Button>
        </div>
        <div className="focus-summary">
          <div
            className="focus-ring"
            role="img"
            aria-label={`${complete} of ${focus.length} tasks completed, ${progress}%`}
          >
            <svg viewBox="0 0 80 80" aria-hidden="true">
              <circle cx="40" cy="40" r="33" className="ring-track" />
              <circle
                cx="40"
                cy="40"
                r="33"
                className="ring-fill"
                pathLength="100"
                strokeDasharray={`${progress} 100`}
              />
            </svg>
            <strong>
              {progress}
              <small>%</small>
            </strong>
          </div>
          <div>
            <strong>
              {complete} of {focus.length} complete
            </strong>
            <p>
              {focus.length
                ? "A little progress adds up."
                : "Your next step starts here."}
            </p>
          </div>
        </div>
        <div
          className="focus-filters"
          role="group"
          aria-label="Filter focus tasks"
        >
          <button
            type="button"
            className={!showAll ? "active" : ""}
            aria-pressed={!showAll}
            onClick={() => setShowAll(false)}
          >
            Today & overdue
          </button>
          <button
            type="button"
            className={showAll ? "active" : ""}
            aria-pressed={showAll}
            onClick={() => setShowAll(true)}
          >
            All tasks ({workspace.tasks.length})
          </button>
        </div>
        {!workspace.ready ? (
          <p role="status">Restoring your tasks…</p>
        ) : !focus.length ? (
          <div className="widget-empty">
            <CircleCheck size={27} />
            <p>
              No tasks here yet. Add a task or review a generated plan to bring
              it into your workspace.
            </p>
            <Button onClick={() => setEditor({ kind: "task" })}>
              <Plus size={15} />
              Add your first task
            </Button>
          </div>
        ) : (
          <ul className="focus-list">
            {focus.map((task) => (
              <li
                key={task.id}
                className={task.status === "Completed" ? "completed" : ""}
              >
                <label className="focus-check">
                  <input
                    type="checkbox"
                    checked={task.status === "Completed"}
                    aria-label={`${task.status === "Completed" ? "Reopen" : "Complete"} ${task.title}`}
                    onChange={(event) =>
                      void workspace.updateTask(task.id, {
                        status: event.target.checked ? "Completed" : "To Do",
                      })
                    }
                  />
                  <span>
                    <strong>{task.title}</strong>
                    <small>
                      <span
                        className={`priority-dot ${task.priority.toLowerCase()}`}
                      />
                      {task.priority}
                      {task.dueDate ? ` · ${task.dueDate}` : " · No date"}
                    </small>
                  </span>
                </label>
                <div className="row-actions">
                  <button
                    type="button"
                    title="Draft a follow-up email"
                    aria-label={`Email about ${task.title}`}
                    onClick={() => followUp(task)}
                  >
                    <Mail size={14} />
                  </button>
                  <button
                    type="button"
                    title="Edit task"
                    aria-label={`Edit ${task.title}`}
                    onClick={() => setEditor({ kind: "task", record: task })}
                  >
                    <Pencil size={14} />
                  </button>
                  <ConfirmDialog
                    title="Delete this task?"
                    description="This removes the task and its linked calendar events from this browser."
                    trigger={
                      <button
                        type="button"
                        aria-label={`Delete ${task.title}`}
                        title="Delete task"
                      >
                        <Trash2 size={14} />
                      </button>
                    }
                    onConfirm={() => void workspace.removeTask(task.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section
        className="panel glass-card calendar-panel"
        aria-labelledby="calendar-title"
      >
        <div className="widget-heading">
          <h2 id="calendar-title">
            <CalendarDays size={18} />
            Your calendar
          </h2>
          <Button
            variant="ghost"
            aria-label="Add calendar event"
            disabled={!workspace.ready}
            onClick={() => setEditor({ kind: "event" })}
          >
            <Plus size={18} />
          </Button>
        </div>
        <div className="calendar-nav">
          <strong aria-live="polite">{monthLabel}</strong>
          <div>
            <button
              type="button"
              aria-label="Previous month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              aria-label="Go to today"
              onClick={() => {
                setSelectedDate(today);
                setMonth(
                  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                );
              }}
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
        <div className="calendar-grid" role="group" aria-label={monthLabel}>
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
            <span
              key={`header-${index}`}
              className="calendar-weekday"
              aria-hidden="true"
            >
              {day}
            </span>
          ))}
          {Array.from({ length: start }, (_, index) => (
            <span key={`blank-${index}`} />
          ))}
          {Array.from({ length: numberOfDays }, (_, index) => {
            const date = localDate(
              new Date(month.getFullYear(), month.getMonth(), index + 1),
            );
            const count =
              workspace.tasks.filter((task) => task.dueDate === date).length +
              workspace.events.filter((event) => event.date === date).length;
            return (
              <button
                type="button"
                key={date}
                className={`${date === selectedDate ? "selected" : ""} ${date === today ? "today" : ""}`}
                aria-label={`${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { dateStyle: "full" })}${count ? `, ${count} scheduled items` : ""}`}
                aria-pressed={date === selectedDate}
                onClick={() => setSelectedDate(date)}
              >
                {index + 1}
                {count > 0 && <i aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <div className="calendar-agenda">
          <h3>
            {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
              undefined,
              { weekday: "long", month: "short", day: "numeric" },
            )}
          </h3>
          {!selectedTasks.length && !selectedEvents.length ? (
            <p className="muted">
              A little room to plan your day. No scheduled items.
            </p>
          ) : (
            <ul>
              {selectedTasks.map((task) => (
                <li key={task.id}>
                  <span
                    className={`agenda-dot ${task.status === "Completed" ? "done" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setEditor({ kind: "task", record: task })}
                  >
                    <strong>{task.title}</strong>
                    <small>Task · {task.status}</small>
                  </button>
                </li>
              ))}
              {selectedEvents.map((event) => (
                <li key={event.id}>
                  <span className="agenda-dot event" />
                  <button
                    type="button"
                    onClick={() => setEditor({ kind: "event", record: event })}
                  >
                    <strong>{event.title}</strong>
                    <small>{event.time || "All day"} · Event</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="ghost"
            onClick={() => setEditor({ kind: "event" })}
            disabled={!workspace.ready}
          >
            <Plus size={14} />
            Schedule something
          </Button>
        </div>
      </section>
      {editor && (
        <WorkspaceEditor
          key={`${editor.kind}-${editor.record?.id ?? selectedDate}`}
          editor={editor}
          defaultDate={selectedDate}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}

function WorkspaceEditor({
  editor,
  defaultDate,
  onClose,
}: {
  editor: Editor;
  defaultDate: string;
  onClose: () => void;
}) {
  const workspace = useWorkspace();
  const [newId] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState(editor.record?.title ?? "");
  const [description, setDescription] = useState(
    editor.record?.description ?? "",
  );
  const [date, setDate] = useState(
    editor.kind === "task"
      ? (editor.record?.dueDate ?? defaultDate)
      : (editor.record?.date ?? defaultDate),
  );
  const [priority, setPriority] = useState<Task["priority"]>(
    editor.kind === "task" ? (editor.record?.priority ?? "Medium") : "Medium",
  );
  const [status, setStatus] = useState<Task["status"]>(
    editor.kind === "task" ? (editor.record?.status ?? "To Do") : "To Do",
  );
  const [time, setTime] = useState(
    editor.kind === "event" ? (editor.record?.time ?? "") : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const kind = editor.kind === "task" ? "task" : "event";
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Add a title.");
      return;
    }
    if (editor.kind === "event" && !date) {
      setError("Choose an event date.");
      return;
    }
    setBusy(true);
    let saved: boolean | string | undefined;
    if (editor.kind === "task")
      saved = editor.record
        ? await workspace.updateTask(editor.record.id, {
            title: title.trim(),
            description,
            dueDate: date,
            priority,
            status,
          })
        : await workspace.addTask({
            id: newId,
            title: title.trim(),
            description,
            dueDate: date,
            priority,
            status,
          });
    else
      saved = editor.record
        ? await workspace.updateEvent(editor.record.id, {
            title: title.trim(),
            description,
            date,
            time,
          })
        : await workspace.addEvent({
            id: newId,
            title: title.trim(),
            description,
            date,
            time,
          });
    setBusy(false);
    if (saved) onClose();
    else
      setError(
        "Your changes are still in memory. Browser storage could not confirm this save. Export your data in Settings before closing this tab.",
      );
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content workspace-editor">
          <Dialog.Title>
            {editor.record ? "Edit" : "Add"} {kind}
          </Dialog.Title>
          <Dialog.Description>
            {editor.kind === "task"
              ? "Choose one clear step. Tasks stay on this browser and appear on your calendar when dated."
              : "Keep your upcoming plans close. Events stay on this browser."}
          </Dialog.Description>
          <form onSubmit={(event) => void submit(event)}>
            <label>
              Title
              <input
                autoFocus
                value={title}
                maxLength={500}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </label>
            <label>
              Description
              <textarea
                value={description}
                maxLength={editor.kind === "task" ? 30000 : 10000}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </label>
            <div className="form-grid">
              <label>
                {editor.kind === "task" ? "Due date (optional)" : "Date"}
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  required={editor.kind === "event"}
                />
              </label>
              {editor.kind === "event" ? (
                <label>
                  Time (optional)
                  <input
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                  />
                </label>
              ) : (
                <label>
                  Priority
                  <select
                    value={priority}
                    onChange={(event) =>
                      setPriority(event.target.value as Task["priority"])
                    }
                  >
                    {["Low", "Medium", "High"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {editor.kind === "task" && (
              <label>
                Status
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as Task["status"])
                  }
                >
                  {["To Do", "In Progress", "Completed"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            )}
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <div className="actions">
              <Button onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              {editor.kind === "event" && editor.record && (
                <ConfirmDialog
                  title="Delete this event?"
                  description="This permanently removes this event from this browser."
                  trigger={
                    <Button variant="danger" disabled={busy}>
                      <Trash2 size={14} />
                      Delete
                    </Button>
                  }
                  onConfirm={() => {
                    void workspace
                      .removeEvent(editor.record!.id)
                      .then((saved) => {
                        if (saved) onClose();
                      });
                  }}
                />
              )}
              <Button variant="primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : `Save ${kind}`}
              </Button>
            </div>
          </form>
          <Dialog.Close
            className="dialog-close"
            aria-label="Close editor"
            disabled={busy}
          >
            <X size={18} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
