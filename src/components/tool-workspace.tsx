"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Sparkles,
  Save,
  RotateCcw,
  ShieldCheck,
  FileText,
  Upload,
  Trash2,
  ArrowUp,
  ArrowDown,
  List,
  CalendarDays,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getFeature } from "@/lib/config";
import {
  outputSchemas,
  requestSchemas,
  type Feature,
  type Outputs,
  type Draft,
  type Task,
  type Review,
} from "@/lib/contracts";
import {
  normalizeInput,
  formatOutput,
  completion,
  isOverdue,
  parseTranscript,
  validateTranscriptFile,
  tasksCsv,
} from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";
import {
  Button,
  CopyButton,
  ExportButton,
  Loading,
  ResponsibleReminder,
  ConfirmDialog,
} from "./ui";

type Field = {
  key: string;
  label: string;
  placeholder?: string;
  options?: string[];
  type?: string;
  required?: boolean;
  wide?: boolean;
  hint?: string;
  max?: number;
};
const fieldConfigs: Record<Feature, Field[]> = {
  email: [
    {
      key: "purpose",
      label: "What would you like to say?",
      type: "textarea",
      required: true,
      placeholder:
        "e.g. Follow up after a project meeting and ask for feedback on the proposal.",
      wide: true,
    },
    {
      key: "topic",
      label: "Subject or topic",
      required: true,
      placeholder: "Project proposal follow-up",
      max: 300,
    },
    {
      key: "recipient",
      label: "Recipient",
      placeholder: "Name or role (optional)",
      max: 300,
    },
    {
      key: "tone",
      label: "Tone",
      options: [
        "Professional",
        "Formal",
        "Friendly",
        "Persuasive",
        "Concise",
        "Apologetic",
      ],
    },
    {
      key: "length",
      label: "Length",
      options: ["Medium", "Short", "Detailed"],
    },
    {
      key: "context",
      label: "Additional context",
      type: "textarea",
      placeholder: "Anything else the email should include?",
      wide: true,
    },
  ],
  meetings: [
    {
      key: "title",
      label: "Meeting title",
      placeholder: "Weekly team check-in",
      max: 300,
    },
    { key: "date", label: "Meeting date", type: "date" },
    {
      key: "transcript",
      label: "Notes or transcript",
      type: "textarea",
      required: true,
      wide: true,
      placeholder:
        "Paste the conversation here. Include owners and deadlines when known.",
    },
    {
      key: "detail",
      label: "Summary detail",
      options: ["Standard", "Brief", "Detailed"],
      wide: true,
    },
  ],
  planner: [
    {
      key: "title",
      label: "Project or goal",
      required: true,
      placeholder: "Launch my portfolio",
      max: 300,
    },
    { key: "deadline", label: "Target completion date", type: "date" },
    {
      key: "description",
      label: "What do you want to achieve?",
      type: "textarea",
      required: true,
      wide: true,
      placeholder: "Describe your goal and what success looks like.",
    },
    {
      key: "requirements",
      label: "Tasks or requirements",
      type: "textarea",
      wide: true,
      placeholder: "Add known tasks, or import meeting actions.",
    },
    { key: "priority", label: "Priority", options: ["Medium", "High", "Low"] },
    {
      key: "hours",
      label: "Working hours per day",
      type: "number",
      placeholder: "e.g. 4",
      hint: "Optional, between 0.5 and 16.",
    },
    {
      key: "constraints",
      label: "Constraints",
      type: "textarea",
      wide: true,
      placeholder: "Budget, availability, dependencies…",
    },
  ],
  research: [
    {
      key: "topic",
      label: "Research question",
      required: true,
      wide: true,
      placeholder: "What would you like to understand?",
      max: 300,
    },
    { key: "mode", label: "Research mode", options: ["knowledge", "source"] },
    {
      key: "depth",
      label: "Explanation depth",
      options: ["Standard", "Overview", "Detailed"],
    },
    {
      key: "objective",
      label: "Research objective",
      type: "textarea",
      wide: true,
      placeholder: "What will you use this research for?",
    },
    {
      key: "source",
      label: "Source material",
      type: "textarea",
      wide: true,
      placeholder: "Paste the article or material you want to analyze.",
    },
    {
      key: "context",
      label: "Additional context",
      type: "textarea",
      wide: true,
      placeholder: "Audience, background or specific questions…",
    },
  ],
  checkpoint: [
    {
      key: "title",
      label: "Content title",
      required: true,
      wide: true,
      placeholder: "Name this draft",
      max: 300,
    },
    {
      key: "content",
      label: "Content to review",
      type: "textarea",
      required: true,
      wide: true,
      placeholder: "Paste a draft, or send one here from another tool.",
    },
    {
      key: "feedback",
      label: "Your feedback or rejection reason",
      type: "textarea",
      wide: true,
      placeholder:
        "What needs to change? Required when requesting an AI revision.",
    },
  ],
};
function initialInput(feature: Feature) {
  return Object.fromEntries(
    fieldConfigs[feature].map((f) => [f.key, f.options?.[0] ?? ""]),
  );
}
function newReview(type = "Manual content"): Review {
  return {
    status: "Pending",
    feedback: "",
    reviewedAt: "",
    contentType: type,
    versions: [],
  };
}
export function ToolWorkspace({ feature }: { feature: Feature }) {
  const f = getFeature(feature);
  const workspace = useWorkspace();
  const router = useRouter();
  const [input, setInput] = useState<Record<string, string>>(() => ({
    ...initialInput(feature),
    ...workspace.drafts[feature]?.input,
  }));
  const [output, setOutput] = useState<Outputs[Feature] | null>(
    () => workspace.drafts[feature]?.output ?? null,
  );
  const [review, setReview] = useState<Review>(
    () => workspace.drafts[feature]?.review ?? newReview(),
  );
  const [savedId, setSavedId] = useState<string | undefined>(
    () => workspace.drafts[feature]?.savedId,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"list" | "schedule">("list");
  const [selected, setSelected] = useState<number[]>(() =>
    feature === "meetings" && workspace.drafts.meetings?.output
      ? (
          workspace.drafts.meetings.output as Outputs["meetings"]
        ).actionItems.map((_, i) => i)
      : [],
  );
  const outputRef = useRef<HTMLElement>(null);
  const locked =
    feature === "checkpoint" &&
    (review.status === "Approved" || review.status === "Rejected");
  const title = input.title || input.topic || f.fullName;
  const { setDraft } = workspace;
  useEffect(() => {
    setDraft({
      savedId,
      feature,
      title,
      input,
      output,
      ...(feature === "checkpoint" ? { review } : {}),
    });
  }, [feature, title, input, output, review, savedId, setDraft]);
  function updateInput(key: string, value: string) {
    setInput((previous) => ({ ...previous, [key]: value }));
    if (feature === "checkpoint" && key === "content")
      setReview((previous) => ({
        ...previous,
        status: "Pending",
        reviewedAt: "",
      }));
  }
  function makeDraft(nextReview = review): Draft {
    return {
      feature,
      title,
      input,
      output,
      ...(feature === "checkpoint" ? { review: nextReview } : {}),
    };
  }
  function save(nextReview = review) {
    const id = workspace.save(makeDraft(nextReview), savedId);
    if (id) setSavedId(id);
  }
  async function generate(action = "review") {
    if (busy) return;
    const normalized = Object.fromEntries(
      Object.entries(input).map(([k, v]) => [k, normalizeInput(v)]),
    );
    const data = {
      ...normalized,
      ...(feature === "planner"
        ? { hours: input.hours ? Number(input.hours) : undefined }
        : {}),
      ...(feature === "checkpoint" ? { action } : {}),
    };
    const validated = requestSchemas[feature].safeParse(data);
    if (!validated.success) {
      setError(validated.error.issues[0]?.message ?? "Check your input.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/api/ai/${feature}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated.data),
        signal: AbortSignal.timeout(55000),
      });
      const result = (await response.json()) as {
        output?: unknown;
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Generation failed. Please try again.");
      const parsed = outputSchemas[feature].safeParse(result.output);
      if (!parsed.success)
        throw new Error(
          "The server returned an invalid response. Please try again.",
        );
      setOutput(parsed.data);
      if (feature === "meetings")
        setSelected(
          (parsed.data as Outputs["meetings"]).actionItems.map((_, i) => i),
        );
      if (feature === "checkpoint" && action === "revise") {
        const revised = (parsed.data as Outputs["checkpoint"]).revisedContent;
        if (!revised.trim())
          throw new Error(
            "The AI did not return a revision. Your original content is preserved.",
          );
        setReview((previous) => ({
          ...previous,
          status: "Revision requested",
          feedback: input.feedback,
          reviewedAt: new Date().toISOString(),
          versions: [
            ...previous.versions,
            {
              content: input.content,
              timestamp: new Date().toISOString(),
              feedback: input.feedback,
            },
          ].slice(-30),
        }));
        setInput((previous) => ({ ...previous, content: revised }));
      }
      toast.success(
        action === "revise"
          ? "Revision ready for your review"
          : "Your response is ready",
      );
      setTimeout(
        () =>
          outputRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          }),
        100,
      );
    } catch (err) {
      setError(
        err instanceof Error && /timeout|abort/i.test(err.name)
          ? "The request timed out. Your input is preserved; please try again."
          : err instanceof Error
            ? err.message
            : "Network unavailable. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function toCheckpoint() {
    const content = formatOutput(output);
    workspace.setDraft({
      feature: "checkpoint",
      title,
      input: { title, content, feedback: "" },
      output: null,
      review: newReview(f.fullName),
    });
    router.push("/checkpoint");
  }
  function toPlanner() {
    const meeting = output as Outputs["meetings"];
    const items = meeting.actionItems.filter((_, i) => selected.includes(i));
    if (!items.length) {
      toast.error("Select at least one action item.");
      return;
    }
    workspace.setDraft({
      feature: "planner",
      title: input.title || "Meeting action plan",
      input: {
        title: input.title || "Meeting action plan",
        description: `Create a plan for these meeting actions. Meeting date: ${input.date || "Not specified"}.`,
        requirements: items
          .map(
            (a) =>
              `${a.description} | Owner: ${a.owner} | Deadline: ${a.deadline} | Priority: ${a.priority}`,
          )
          .join("\n"),
      },
      output: null,
    });
    router.push("/planner");
  }
  function decide(status: Review["status"]) {
    if (!input.content?.trim()) {
      setError("Add content before recording a decision.");
      return;
    }
    const next = {
      ...review,
      status,
      feedback: input.feedback ?? "",
      reviewedAt: new Date().toISOString(),
    };
    setReview(next);
    if (workspace.enabled) save(next);
    else
      toast.success(
        `${status}. Enable local history to preserve this decision after closing the browser.`,
      );
  }
  function updateTask(index: number, patch: Partial<Task>) {
    setOutput((previous) => {
      const p = previous as Outputs["planner"];
      return {
        ...p,
        tasks: p.tasks.map((t, i) => (i === index ? { ...t, ...patch } : t)),
      };
    });
  }
  function reorder(index: number, delta: number) {
    setOutput((previous) => {
      const p = previous as Outputs["planner"];
      const tasks = [...p.tasks];
      [tasks[index], tasks[index + delta]] = [
        tasks[index + delta],
        tasks[index],
      ];
      return { ...p, tasks };
    });
  }
  const exportText =
    feature === "checkpoint"
      ? `${input.content}\n\nReview status: ${review.status}\nReviewed at: ${review.reviewedAt || "Not reviewed"}\nFeedback: ${review.feedback}`
      : formatOutput(output);
  return (
    <div className="page-wrap tool-page">
      <div className="page-heading">
        <div>
          <div className={`tool-eyebrow ${f.color}`}>
            <f.icon size={16} />
            {f.tag}
          </div>
          <h1>
            {f.fullName}
            <span className="accent">.</span>
          </h1>
          <p>{f.description}</p>
        </div>
        <span className="pill">
          <Sparkles size={13} />
          GEMINI POWERED
        </span>
      </div>
      <div className="workspace-grid">
        <section className="panel input-panel">
          <div className="panel-header">
            <div>
              <span className="panel-step">01</span>
              <h2>
                {feature === "checkpoint"
                  ? "Your review desk"
                  : "Start with the details"}
              </h2>
            </div>
            <span className="muted">
              {feature === "checkpoint"
                ? "Human in the loop"
                : "A good prompt goes a long way"}
            </span>
          </div>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void generate();
            }}
            noValidate
          >
            <div className="fields-grid">
              {fieldConfigs[feature]
                .filter(
                  (field) =>
                    !(
                      feature === "research" &&
                      field.key === "source" &&
                      input.mode !== "source"
                    ),
                )
                .map((field) => (
                  <label
                    className={`field ${field.wide ? "wide" : ""}`}
                    key={field.key}
                  >
                    <span>
                      {field.label}
                      {field.required && <span className="required"> *</span>}
                    </span>
                    {field.options ? (
                      <select
                        value={input[field.key]}
                        onChange={(e) => updateInput(field.key, e.target.value)}
                        disabled={busy}
                      >
                        <>
                          {field.options.map((option) => (
                            <option key={option} value={option}>
                              {option === "knowledge"
                                ? "General AI knowledge"
                                : option === "source"
                                  ? "Analyze supplied material"
                                  : option}
                            </option>
                          ))}
                        </>
                      </select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        disabled={busy || (locked && field.key === "content")}
                        value={input[field.key] || ""}
                        onChange={(e) => updateInput(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        rows={
                          field.key === "content" || field.key === "transcript"
                            ? 11
                            : 4
                        }
                        maxLength={field.key === "content" ? 60000 : 12000}
                        required={field.required}
                      />
                    ) : (
                      <input
                        value={input[field.key] || ""}
                        onChange={(e) => updateInput(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        type={field.type ?? "text"}
                        maxLength={field.max ?? 12000}
                        min={field.type === "number" ? 0.5 : undefined}
                        max={field.type === "number" ? 16 : undefined}
                        step={field.type === "number" ? 0.5 : undefined}
                        disabled={busy}
                        required={field.required}
                      />
                    )}
                    <small>
                      {field.hint ||
                        (field.key === "transcript" || field.key === "content"
                          ? `${(input[field.key] || "").length.toLocaleString()} / ${field.key === "content" ? "60,000" : "12,000"} characters`
                          : "")}
                    </small>
                  </label>
                ))}
            </div>
            {feature === "meetings" && (
              <label className="upload-control">
                <Upload size={16} />
                Import transcript (.txt, .md, .vtt)
                <input
                  aria-label="Upload transcript"
                  type="file"
                  accept=".txt,.md,.vtt"
                  disabled={busy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      validateTranscriptFile(file.name, file.size);
                      updateInput(
                        "transcript",
                        parseTranscript(
                          file.name,
                          file.size,
                          await file.text(),
                        ),
                      );
                      setError("");
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "File could not be read.",
                      );
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            {feature === "research" && (
              <div className="info-note">
                {input.mode === "source"
                  ? "Grounded in the material you provide. No live browsing or independent source verification."
                  : "Uses model knowledge, which may be outdated. No live web search or verified citations."}
              </div>
            )}
            {feature === "checkpoint" && (
              <div className="review-state">
                <span
                  className={`status-badge status-${review.status.toLowerCase().replaceAll(" ", "-")}`}
                >
                  {review.status}
                </span>
                <span>{review.contentType}</span>
                {review.reviewedAt && (
                  <small>{new Date(review.reviewedAt).toLocaleString()}</small>
                )}
              </div>
            )}
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <div className="form-footer">
              <Button type="submit" variant="primary" disabled={busy || locked}>
                <Sparkles size={16} />
                {busy
                  ? "Working on it…"
                  : feature === "checkpoint"
                    ? "AI-assisted review"
                    : output
                      ? "Regenerate"
                      : `Generate ${feature === "email" ? "email" : feature === "meetings" ? "summary" : feature === "planner" ? "plan" : "research"}`}
                <ArrowRight size={16} />
              </Button>
              <span>Inputs are sent to Google Gemini.</span>
            </div>
            {feature === "checkpoint" && (
              <>
                <div className="decision-actions">
                  {locked ? (
                    <Button type="button" onClick={() => decide("Pending")}>
                      <RotateCcw size={15} />
                      Reopen for editing
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() => decide("Approved")}
                      >
                        <Check size={15} />
                        Approve
                      </Button>
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() => void generate("revise")}
                      >
                        <RotateCcw size={15} />
                        Request AI revision
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        disabled={busy}
                        onClick={() => decide("Rejected")}
                      >
                        <X size={15} />
                        Reject
                      </Button>
                    </>
                  )}
                </div>
                <div className="actions">
                  <Button type="button" onClick={() => save()}>
                    <Save size={15} />
                    Save review
                  </Button>
                  <CopyButton text={exportText} />
                  <ExportButton text={exportText} name="review.md" />
                  <ConfirmDialog
                    title="Delete this review?"
                    description="This clears the open review and its saved copy, if present. Other saved history is preserved."
                    trigger={
                      <Button type="button" variant="danger">
                        <Trash2 size={15} />
                        Delete review
                      </Button>
                    }
                    onConfirm={() => {
                      if (savedId) workspace.remove(savedId);
                      setInput(initialInput(feature));
                      setOutput(null);
                      setReview(newReview());
                      setSavedId(undefined);
                    }}
                  />
                </div>
              </>
            )}
            <ResponsibleReminder />
          </form>
        </section>
        <section
          ref={outputRef}
          className="panel output-panel"
          aria-label="Generated output"
          aria-busy={busy}
        >
          <div className="panel-header">
            <div>
              <span className="panel-step">02</span>
              <h2>
                {feature === "checkpoint"
                  ? "A second perspective"
                  : "Make it yours"}
              </h2>
            </div>
            <span className="muted">
              {output ? "Editable AI output" : "Your output lives here"}
            </span>
          </div>
          {busy ? (
            <Loading />
          ) : !output ? (
            <div className="output-empty">
              <div className={`output-empty-icon ${f.color}`}>
                <f.icon size={34} />
              </div>
              <h3>
                {feature === "checkpoint"
                  ? "Thoughtful review starts here"
                  : "Good work starts with a little spark"}
              </h3>
              <p>
                {feature === "checkpoint"
                  ? "Review manually or ask Gemini for suggestions. You make the final decision."
                  : "Add a few details, hit generate, and turn a blank page into something you can work with."}
              </p>
              <span>
                <Sparkles size={13} />
                AI helps. You decide.
              </span>
            </div>
          ) : (
            <div className="output-content">
              {feature === "email" ? (
                <>
                  <label className="field">
                    <span>Suggested subject</span>
                    <input
                      aria-label="Generated subject"
                      value={(output as Outputs["email"]).subject}
                      maxLength={500}
                      onChange={(e) =>
                        setOutput({
                          ...(output as Outputs["email"]),
                          subject: e.target.value,
                        })
                      }
                    />
                  </label>
                  <CopyButton
                    label="Copy subject"
                    text={(output as Outputs["email"]).subject}
                  />
                  <label className="field output-body">
                    <span>Email body</span>
                    <textarea
                      aria-label="Email body"
                      rows={17}
                      value={(output as Outputs["email"]).body}
                      maxLength={30000}
                      onChange={(e) =>
                        setOutput({
                          ...(output as Outputs["email"]),
                          body: e.target.value,
                        })
                      }
                    />
                  </label>
                  <CopyButton
                    label="Copy body"
                    text={(output as Outputs["email"]).body}
                  />
                </>
              ) : feature === "planner" ? (
                <>
                  <StructuredEditor
                    value={Object.fromEntries(
                      Object.entries(output).filter(([key]) => key !== "tasks"),
                    )}
                    onChange={(v) =>
                      setOutput({ ...output, ...v } as Outputs["planner"])
                    }
                  />
                  <div className="plan-progress">
                    <div>
                      <strong>
                        {completion((output as Outputs["planner"]).tasks)}%
                        complete
                      </strong>
                      <span>
                        {
                          (output as Outputs["planner"]).tasks.filter(
                            (t) => t.status === "Completed",
                          ).length
                        }{" "}
                        of {(output as Outputs["planner"]).tasks.length} tasks
                      </span>
                    </div>
                    <progress
                      max={100}
                      value={completion((output as Outputs["planner"]).tasks)}
                    />
                  </div>
                  <div className="view-switch">
                    <Button
                      onClick={() => setView("list")}
                      aria-pressed={view === "list"}
                    >
                      <List size={15} />
                      List
                    </Button>
                    <Button
                      onClick={() => setView("schedule")}
                      aria-pressed={view === "schedule"}
                    >
                      <CalendarDays size={15} />
                      Schedule
                    </Button>
                  </div>
                  {(output as Outputs["planner"]).tasks.map((task, i) =>
                    view === "schedule" ? (
                      <div className="timeline-item" key={task.id}>
                        <span>{i + 1}</span>
                        <div>
                          <strong>{task.title}</strong>
                          <p>{task.schedule || "Schedule not specified"}</p>
                          <small>
                            {task.estimatedHours} estimated hours ·{" "}
                            {task.dueDate || "Relative schedule"} ·{" "}
                            {task.status}
                          </small>
                        </div>
                      </div>
                    ) : (
                      <article className="task-card" key={task.id}>
                        <div className="task-top">
                          <label className="task-check">
                            <input
                              aria-label={`Complete ${task.title}`}
                              type="checkbox"
                              checked={task.status === "Completed"}
                              onChange={(e) =>
                                updateTask(i, {
                                  status: e.target.checked
                                    ? "Completed"
                                    : "To Do",
                                })
                              }
                            />
                            <span>Task {i + 1}</span>
                          </label>
                          <div className="actions">
                            <Button
                              aria-label={`Move task ${i + 1} up`}
                              disabled={i === 0}
                              onClick={() => reorder(i, -1)}
                            >
                              <ArrowUp size={13} />
                            </Button>
                            <Button
                              aria-label={`Move task ${i + 1} down`}
                              disabled={
                                i ===
                                (output as Outputs["planner"]).tasks.length - 1
                              }
                              onClick={() => reorder(i, 1)}
                            >
                              <ArrowDown size={13} />
                            </Button>
                            <Button
                              aria-label={`Delete task ${i + 1}`}
                              variant="danger"
                              onClick={() =>
                                setOutput((p) => {
                                  const plan = p as Outputs["planner"];
                                  return {
                                    ...plan,
                                    tasks: plan.tasks
                                      .filter((t) => t.id !== task.id)
                                      .map((t) => ({
                                        ...t,
                                        dependencies: t.dependencies.filter(
                                          (id) => id !== task.id,
                                        ),
                                      })),
                                  };
                                })
                              }
                              disabled={
                                (output as Outputs["planner"]).tasks.length ===
                                1
                              }
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </div>
                        <label className="field">
                          <span>Task title</span>
                          <input
                            value={task.title}
                            maxLength={500}
                            onChange={(e) =>
                              updateTask(i, { title: e.target.value })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Description</span>
                          <textarea
                            value={task.description}
                            maxLength={30000}
                            onChange={(e) =>
                              updateTask(i, { description: e.target.value })
                            }
                          />
                        </label>
                        <div className="fields-grid">
                          <label className="field">
                            <span>Priority</span>
                            <select
                              value={task.priority}
                              onChange={(e) =>
                                updateTask(i, {
                                  priority: e.target.value as Task["priority"],
                                })
                              }
                            >
                              {["Low", "Medium", "High"].map((p) => (
                                <option key={p}>{p}</option>
                              ))}
                            </select>
                          </label>
                          <label className="field">
                            <span>Status</span>
                            <select
                              value={task.status}
                              onChange={(e) =>
                                updateTask(i, {
                                  status: e.target.value as Task["status"],
                                })
                              }
                            >
                              {["To Do", "In Progress", "Completed"].map(
                                (p) => (
                                  <option key={p}>{p}</option>
                                ),
                              )}
                            </select>
                          </label>
                          <label className="field">
                            <span>Due date</span>
                            <input
                              type="date"
                              value={task.dueDate}
                              onChange={(e) =>
                                updateTask(i, { dueDate: e.target.value })
                              }
                            />
                            {isOverdue(task.dueDate) &&
                              task.status !== "Completed" && (
                                <small className="overdue">Past due</small>
                              )}
                          </label>
                          <label className="field">
                            <span>Estimated hours</span>
                            <input
                              type="number"
                              min={0}
                              max={10000}
                              value={task.estimatedHours}
                              onChange={(e) =>
                                updateTask(i, {
                                  estimatedHours: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                        </div>
                        <label className="field">
                          <span>Suggested schedule</span>
                          <input
                            value={task.schedule}
                            maxLength={1000}
                            onChange={(e) =>
                              updateTask(i, { schedule: e.target.value })
                            }
                          />
                        </label>
                        <p className="task-meta">
                          Dependencies:{" "}
                          {task.dependencies.length
                            ? task.dependencies
                                .map(
                                  (id) =>
                                    (output as Outputs["planner"]).tasks.find(
                                      (t) => t.id === id,
                                    )?.title || id,
                                )
                                .join(", ")
                            : "None"}
                        </p>
                        {task.subtasks.length > 0 && (
                          <ul className="subtasks">
                            {task.subtasks.map((s, j) => (
                              <li key={j}>{s}</li>
                            ))}
                          </ul>
                        )}
                      </article>
                    ),
                  )}
                </>
              ) : feature === "meetings" ? (
                <>
                  <StructuredEditor
                    value={Object.fromEntries(
                      Object.entries(output).filter(
                        ([key]) => key !== "actionItems",
                      ),
                    )}
                    onChange={(v) =>
                      setOutput({ ...output, ...v } as Outputs["meetings"])
                    }
                  />
                  <h3>Action items</h3>
                  {(output as Outputs["meetings"]).actionItems.length === 0 && (
                    <p className="muted">
                      No action items were identified in the notes.
                    </p>
                  )}
                  {(output as Outputs["meetings"]).actionItems.map(
                    (item, i) => (
                      <div className="task-card" key={i}>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            aria-label={`Select action ${i + 1} for planner`}
                            checked={selected.includes(i)}
                            onChange={(e) =>
                              setSelected((prev) =>
                                e.target.checked
                                  ? [...prev, i]
                                  : prev.filter((n) => n !== i),
                              )
                            }
                          />
                          Include in task plan
                        </label>
                        {(
                          [
                            "description",
                            "owner",
                            "deadline",
                            "priority",
                          ] as const
                        ).map((key) => (
                          <label className="field" key={key}>
                            <span>{key[0].toUpperCase() + key.slice(1)}</span>
                            {key === "priority" ? (
                              <select
                                value={item.priority}
                                onChange={(e) =>
                                  setOutput((p) => {
                                    const m = p as Outputs["meetings"];
                                    return {
                                      ...m,
                                      actionItems: m.actionItems.map((a, j) =>
                                        j === i
                                          ? {
                                              ...a,
                                              priority: e.target
                                                .value as typeof item.priority,
                                            }
                                          : a,
                                      ),
                                    };
                                  })
                                }
                              >
                                {["Low", "Medium", "High", "Not specified"].map(
                                  (p) => (
                                    <option key={p}>{p}</option>
                                  ),
                                )}
                              </select>
                            ) : (
                              <input
                                value={item[key]}
                                maxLength={key === "description" ? 3000 : 300}
                                onChange={(e) =>
                                  setOutput((p) => {
                                    const m = p as Outputs["meetings"];
                                    return {
                                      ...m,
                                      actionItems: m.actionItems.map((a, j) =>
                                        j === i
                                          ? { ...a, [key]: e.target.value }
                                          : a,
                                      ),
                                    };
                                  })
                                }
                              />
                            )}
                          </label>
                        ))}
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={(e) =>
                              setOutput((p) => {
                                const m = p as Outputs["meetings"];
                                return {
                                  ...m,
                                  actionItems: m.actionItems.map((a, j) =>
                                    j === i
                                      ? { ...a, completed: e.target.checked }
                                      : a,
                                  ),
                                };
                              })
                            }
                          />
                          Completed
                        </label>
                      </div>
                    ),
                  )}
                  <Button onClick={toPlanner}>
                    <ArrowRight size={15} />
                    Plan selected actions
                  </Button>
                </>
              ) : (
                <>
                  <StructuredEditor
                    value={output as Record<string, unknown>}
                    readOnlyKeys={
                      feature === "research" ? ["basis"] : ["revisedContent"]
                    }
                    onChange={(v) =>
                      setOutput({ ...output, ...v } as Outputs[Feature])
                    }
                  />
                </>
              )}
              <div className="output-actions">
                <Button onClick={() => save()}>
                  <Save size={15} />
                  Save locally
                </Button>
                <CopyButton text={exportText} />
                <ExportButton
                  text={exportText}
                  name={feature === "email" ? "email.txt" : `${feature}.md`}
                  mime={feature === "email" ? "text/plain" : undefined}
                />
                {feature === "planner" && (
                  <ExportButton
                    text={tasksCsv((output as Outputs["planner"]).tasks)}
                    name="plan.csv"
                    mime="text/csv"
                  />
                )}
                {feature !== "checkpoint" && (
                  <Button onClick={toCheckpoint}>
                    <ShieldCheck size={15} />
                    Send to Checkpoint
                  </Button>
                )}
              </div>
              <ResponsibleReminder />
            </div>
          )}
          {feature === "checkpoint" && review.versions.length > 0 && (
            <section className="version-history">
              <h3>Previous versions</h3>
              <p className="muted">
                Compare with the editable current version on the left.
              </p>
              {review.versions.map((version, i) => (
                <details key={i}>
                  <summary>
                    Version {i + 1} ·{" "}
                    {new Date(version.timestamp).toLocaleString()}
                  </summary>
                  <p className="muted">Feedback: {version.feedback}</p>
                  <pre>{version.content}</pre>
                </details>
              ))}
            </section>
          )}
        </section>
      </div>
      <div className="tool-bottom-note">
        <FileText size={15} />
        {workspace.enabled
          ? "History is enabled. Use Save locally to keep a copy on this browser."
          : "Local history is off. Your open drafts stay in memory until you refresh or close the page."}
      </div>
    </div>
  );
}
function StructuredEditor({
  value,
  onChange,
  readOnlyKeys = [],
}: {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  readOnlyKeys?: string[];
}) {
  return (
    <div className="structured-editor">
      {Object.entries(value)
        .filter(([key]) => key !== "revisedContent")
        .map(([key, v]) => (
          <label className="field" key={key}>
            <span>
              {key
                .replace(/([A-Z])/g, " $1")
                .replace(/^./, (c) => c.toUpperCase())}
            </span>
            {readOnlyKeys.includes(key) ? (
              <span className="basis-label">{String(v)}</span>
            ) : (
              <>
                <textarea
                  aria-label={key.replace(/([A-Z])/g, " $1")}
                  rows={
                    Array.isArray(v)
                      ? Math.max(2, Math.min(v.length + 1, 7))
                      : key === "explanation" || key === "analysis"
                        ? 8
                        : 4
                  }
                  value={Array.isArray(v) ? v.join("\n") : String(v)}
                  maxLength={Array.isArray(v) ? 30000 : 30000}
                  onChange={(e) =>
                    onChange({
                      [key]: Array.isArray(v)
                        ? e.target.value.split("\n")
                        : e.target.value,
                    })
                  }
                />
                {Array.isArray(v) && <small>One item per line</small>}
              </>
            )}
          </label>
        ))}
    </div>
  );
}
