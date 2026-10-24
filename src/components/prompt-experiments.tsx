"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Beaker,
  GitCompareArrows,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  compareExperimentVersions,
  experimentRequestSchema,
  experimentResponseSchema,
  promptExperimentSchema,
  type ExperimentVersion,
  type PromptExperiment,
} from "@/lib/experiments";
import { Button, ConfirmDialog, CopyButton, ExportButton } from "./ui";
import { useWorkspace } from "./workspace-provider";

export function PromptExperiments() {
  const {
    experiments,
    saveExperiment,
    removeExperiment,
    recordUsage,
    experimentDraft,
    setExperimentDraft,
  } = useWorkspace();
  const [id, setId] = useState<string | undefined>(experimentDraft?.id);
  const [createdAt, setCreatedAt] = useState<string | undefined>(
    experimentDraft?.createdAt,
  );
  const [title, setTitle] = useState(experimentDraft?.title ?? "");
  const [prompt, setPrompt] = useState(experimentDraft?.prompt ?? "");
  const [instruction, setInstruction] = useState(
    experimentDraft?.instruction ?? "",
  );
  const [versions, setVersions] = useState<ExperimentVersion[]>(
    experimentDraft?.versions ?? [],
  );
  const [activeId, setActiveId] = useState(experimentDraft?.activeId ?? "");
  const [compareId, setCompareId] = useState(experimentDraft?.compareId ?? "");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const active = versions.find((version) => version.id === activeId);
  const before = versions.find((version) => version.id === compareId);
  const comparison =
    before && active ? compareExperimentVersions(before, active) : null;

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    setExperimentDraft({
      id,
      createdAt,
      title,
      prompt,
      instruction,
      versions,
      activeId,
      compareId,
    });
  }, [
    id,
    createdAt,
    title,
    prompt,
    instruction,
    versions,
    activeId,
    compareId,
    setExperimentDraft,
  ]);

  function open(experiment: PromptExperiment) {
    if (busy || saving) return;
    setId(experiment.id);
    setCreatedAt(experiment.createdAt);
    setTitle(experiment.title);
    setPrompt(experiment.prompt);
    setVersions(experiment.versions);
    setActiveId(experiment.versions.at(-1)?.id ?? "");
    setCompareId(
      experiment.versions.length > 1 ? experiment.versions[0].id : "",
    );
    setInstruction("");
    setError("");
  }

  function reset() {
    setId(undefined);
    setCreatedAt(undefined);
    setTitle("");
    setPrompt("");
    setVersions([]);
    setActiveId("");
    setCompareId("");
    setInstruction("");
    setError("");
  }

  async function run(action: "generate" | "refine" | "refine-prompt") {
    if (controller.current || saving) return;
    setError("");
    if (versions.length >= 30) {
      setError(
        "This experiment has 30 versions. Save it, then start a new experiment to keep testing.",
      );
      return;
    }
    const request = experimentRequestSchema.safeParse({
      prompt,
      instruction,
      previousResponse: active?.response ?? "",
      action,
    });
    if (!request.success) {
      setError(request.error.issues[0]?.message ?? "Check your prompt.");
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    const timeout = setTimeout(() => abort.abort("timeout"), 55000);
    try {
      const response = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.data),
        signal: abort.signal,
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "The experiment failed. Please try again.",
        );
      const parsed = experimentResponseSchema.safeParse(body.output);
      if (!parsed.success)
        throw new Error(
          "The AI returned an invalid response. Your earlier versions are retained.",
        );
      if (action === "refine-prompt" && !parsed.data.refinedPrompt) {
        throw new Error(
          "The AI did not return an improved prompt. Your earlier versions are retained; try again.",
        );
      }
      const version: ExperimentVersion = {
        id: crypto.randomUUID(),
        prompt:
          action === "refine-prompt"
            ? (parsed.data.refinedPrompt ?? request.data.prompt)
            : request.data.prompt,
        instruction: action !== "generate" ? request.data.instruction : "",
        response: parsed.data.response,
        createdAt: new Date().toISOString(),
      };
      setVersions((previous) => [...previous, version]);
      setCompareId(activeId);
      setActiveId(version.id);
      if (action === "refine-prompt") setPrompt(version.prompt);
      await recordUsage("checkpoint", "success", "prompt-experiment");
    } catch (failure) {
      if (abort.signal.aborted) {
        setError(
          abort.signal.reason === "timeout"
            ? "The request timed out. Your prompt and versions are retained; try again."
            : "Experiment cancelled. Your prompt and versions are retained.",
        );
      } else {
        setError(
          failure instanceof Error
            ? failure.message
            : "The experiment failed. Try again.",
        );
        await recordUsage("checkpoint", "error", "prompt-experiment");
      }
    } finally {
      clearTimeout(timeout);
      controller.current = null;
      setBusy(false);
    }
  }

  async function save() {
    if (!active || saving) return;
    if (prompt.trim().length < 8 || !active.response.trim()) {
      setError(
        "Keep a prompt of at least 8 characters and a non-empty response before saving.",
      );
      return;
    }
    const now = new Date().toISOString();
    const nextId = id ?? crypto.randomUUID();
    const parsed = promptExperimentSchema.safeParse({
      id: nextId,
      title: title.trim() || prompt.trim().slice(0, 80),
      prompt: prompt.trim(),
      versions,
      createdAt: createdAt ?? now,
      updatedAt: now,
    });
    if (!parsed.success) {
      setError(
        "Every version needs a non-empty response before saving. Choose and complete any empty version, then try again.",
      );
      return;
    }
    setSaving(true);
    try {
      const success = await saveExperiment(parsed.data);
      if (success) {
        setId(nextId);
        setCreatedAt(createdAt ?? now);
        toast.success("Experiment saved on this browser");
      } else {
        setError(
          "This browser could not save the experiment. Your draft remains here; export a copy to keep it.",
        );
      }
    } catch {
      setError(
        "This browser could not save the experiment. Your draft remains here; export a copy to keep it.",
      );
    } finally {
      setSaving(false);
    }
  }

  const markdown = `# ${title.trim() || "Prompt experiment"}\n\n${versions.map((version, index) => `## Version ${index + 1}\n\n### Prompt\n${version.prompt}\n\n${version.instruction ? `### Refinement\n${version.instruction}\n\n` : ""}### Response\n${version.response}`).join("\n\n")}`;

  return (
    <section
      className="glass-panel experiment-lab"
      aria-labelledby="experiments-heading"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            <Beaker size={14} aria-hidden="true" /> Prompt lab
          </span>
          <h2 id="experiments-heading">Test an idea. Improve the response.</h2>
          <p>
            Run a prompt, refine the result, and compare real versions before
            you keep one.
          </p>
        </div>
        <Button onClick={reset} disabled={busy || saving}>
          <Plus size={15} /> New experiment
        </Button>
      </div>
      <div className="experiment-layout">
        <div className="experiment-editor">
          <label htmlFor="experiment-title">
            Experiment title <span className="muted">(optional)</span>
          </label>
          <input
            id="experiment-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            disabled={busy}
            placeholder="For example, a clearer project brief"
          />
          <label htmlFor="experiment-prompt">Prompt to test</label>
          <textarea
            id="experiment-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={12000}
            rows={5}
            disabled={busy}
            placeholder="Describe the response you want. Include context, an audience, and a useful format."
          />
          <div className="actions">
            <Button
              variant="primary"
              onClick={() => void run("generate")}
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <ArrowRight size={15} />
              )}{" "}
              {busy
                ? "Running experiment…"
                : versions.length
                  ? "Test prompt again"
                  : "Test prompt"}
            </Button>
            {busy && (
              <Button onClick={() => controller.current?.abort()}>
                Cancel experiment
              </Button>
            )}
          </div>
          {busy && (
            <p role="status" className="muted">
              Generating a response. Previous versions remain available.
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {active && (
            <>
              <label htmlFor="experiment-instruction">
                How should this response improve?
              </label>
              <textarea
                id="experiment-instruction"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                maxLength={4000}
                rows={3}
                disabled={busy}
                placeholder="For example: shorten the introduction and add three clear next steps."
              />
              <div className="actions">
                <Button
                  onClick={() => void run("refine")}
                  disabled={busy || instruction.trim().length < 3}
                >
                  Refine response <ArrowRight size={14} />
                </Button>
                <Button
                  onClick={() => void run("refine-prompt")}
                  disabled={busy || instruction.trim().length < 3}
                >
                  Improve prompt &amp; test <ArrowRight size={14} />
                </Button>
              </div>
            </>
          )}
        </div>
        <div className="experiment-result">
          {active ? (
            <>
              <div className="result-header">
                <h3>Response</h3>
                <label className="compact-field" htmlFor="experiment-version">
                  Active version
                  <select
                    id="experiment-version"
                    value={activeId}
                    onChange={(event) => setActiveId(event.target.value)}
                    disabled={busy}
                  >
                    {versions.map((version, index) => (
                      <option key={version.id} value={version.id}>
                        Version {index + 1}
                        {version.instruction ? " · refined" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="sr-only" htmlFor="experiment-response">
                Experiment response
              </label>
              <textarea
                id="experiment-response"
                value={active.response}
                rows={10}
                maxLength={20000}
                disabled={busy}
                onChange={(event) =>
                  setVersions((previous) =>
                    previous.map((version) =>
                      version.id === activeId
                        ? { ...version, response: event.target.value }
                        : version,
                    ),
                  )
                }
              />
              <p className="muted">
                You can edit this version. Each AI run adds a separate version.
              </p>
              <div className="actions">
                <CopyButton text={active.response} label="Copy response" />
                <Button onClick={() => void save()} disabled={busy || saving}>
                  <Save size={15} />
                  {saving ? "Saving…" : "Save experiment"}
                </Button>
                <ExportButton text={markdown} name="prompt-experiment.md" />
              </div>
              {versions.length > 1 && (
                <div className="experiment-comparison">
                  <label htmlFor="experiment-compare">
                    <GitCompareArrows size={15} aria-hidden="true" /> Compare
                    with
                    <select
                      id="experiment-compare"
                      value={compareId}
                      onChange={(event) => setCompareId(event.target.value)}
                    >
                      <option value="">Choose a version</option>
                      {versions
                        .filter((version) => version.id !== activeId)
                        .map((version) => (
                          <option key={version.id} value={version.id}>
                            Version {versions.indexOf(version) + 1}
                          </option>
                        ))}
                    </select>
                  </label>
                  {before && comparison && (
                    <>
                      <p className="muted">
                        {comparison.responseChanged
                          ? "The response changed"
                          : "The response is unchanged"}{" "}
                        · {comparison.beforeCharacters.toLocaleString()} →{" "}
                        {comparison.afterCharacters.toLocaleString()} characters
                        {comparison.promptChanged ? " · Prompt changed" : ""}
                      </p>
                      <div className="comparison-columns">
                        <div>
                          <h4>Earlier response</h4>
                          <p className="muted">Prompt: {before.prompt}</p>
                          <pre className="preserve-lines">
                            {before.response}
                          </pre>
                        </div>
                        <div>
                          <h4>Active response</h4>
                          <p className="muted">Prompt: {active.prompt}</p>
                          <pre className="preserve-lines">
                            {active.response}
                          </pre>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <Beaker size={30} aria-hidden="true" />
              <h3>Your next useful response starts here</h3>
              <p>
                Test a prompt to see its response. Refine it with specific
                feedback, then save the versions you want to keep.
              </p>
            </div>
          )}
        </div>
      </div>
      {!!experiments.length && (
        <div className="saved-experiments">
          <h3>Saved experiments</h3>
          <p className="muted">
            Stored on this browser. Export anything you want to keep elsewhere.
          </p>
          <div className="experiment-saved-grid">
            {experiments.map((experiment) => (
              <article className="mini-card" key={experiment.id}>
                <button
                  className="experiment-open"
                  onClick={() => open(experiment)}
                  disabled={busy}
                >
                  <strong>{experiment.title}</strong>
                  <span>
                    {experiment.versions.length} version
                    {experiment.versions.length === 1 ? "" : "s"} ·{" "}
                    {new Date(experiment.updatedAt).toLocaleDateString()}
                  </span>
                </button>
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="ghost"
                      aria-label={`Delete experiment ${experiment.title}`}
                      disabled={busy}
                    >
                      <Trash2 size={15} />
                    </Button>
                  }
                  title="Delete this experiment?"
                  description="This removes the saved experiment from this browser. Export a copy first if you need to keep it."
                  onConfirm={() => {
                    void removeExperiment(experiment.id).then((removed) => {
                      if (removed && id === experiment.id) reset();
                    });
                  }}
                />
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
