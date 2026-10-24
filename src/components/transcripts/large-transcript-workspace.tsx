"use client";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  FileText,
  FolderOpen,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import type { Outputs } from "@/lib/contracts";
import { MAX_TRANSCRIPT_BYTES, utf8Bytes } from "@/lib/transcripts/chunking";
import { extractTranscript } from "@/lib/transcripts/extraction";
import type { TranscriptJob } from "@/lib/transcripts/contracts";
import {
  createTranscriptJob,
  runTranscriptJob,
} from "@/lib/transcripts/runner";
import {
  getTranscriptJob,
  getTranscriptNodes,
  getTranscriptSource,
  listTranscriptJobs,
  removeTranscriptJob,
} from "@/lib/transcripts/storage";
import { download } from "@/lib/utils";
import { Button } from "../ui";
import "./transcripts.css";

export type LargeTranscriptWorkspaceProps = {
  title: string;
  date: string;
  detail: string;
  value: string;
  jobId?: string;
  onChange: (value: string) => void;
  onOutput: (output: Outputs["meetings"]) => void;
  onRestoreMetadata?: (metadata: {
    title: string;
    date: string;
    detail: string;
  }) => void;
  onJobChange?: (id: string) => void;
  onBusyChange?: (busy: boolean) => void;
  onRequestCompleted?: (status: "success" | "error") => void;
};
export function LargeTranscriptWorkspace({
  title,
  date,
  detail,
  value,
  jobId,
  onChange,
  onOutput,
  onJobChange,
  onBusyChange,
  onRequestCompleted,
  onRestoreMetadata,
}: LargeTranscriptWorkspaceProps) {
  const [job, setJob] = useState<TranscriptJob>();
  const [jobs, setJobs] = useState<TranscriptJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [filename, setFilename] = useState("");
  const [fileBytes, setFileBytes] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const controller = useRef<AbortController | null>(null);
  const loaded = useRef("");
  const upload = useRef<HTMLInputElement>(null);
  const change = useRef(onChange);
  const restoreMetadata = useRef(onRestoreMetadata);
  useEffect(() => {
    restoreMetadata.current = onRestoreMetadata;
  }, [onRestoreMetadata]);
  useEffect(() => {
    change.current = onChange;
  }, [onChange]);
  const bytes = useMemo(() => utf8Bytes(value), [value]);
  const large = value.length > 120000 && !showFull;
  const refresh = async () => {
    try {
      setJobs(
        (await listTranscriptJobs()).sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Browser storage is unavailable.",
      );
    }
  };
  useEffect(() => {
    void listTranscriptJobs()
      .then((value) =>
        setJobs(value.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
      )
      .catch(() => {});
    return () => {
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!jobId || loaded.current === jobId) return;
    loaded.current = jobId;
    let active = true;
    void Promise.all([getTranscriptJob(jobId), getTranscriptSource(jobId)])
      .then(([saved, source]) => {
        if (!active) return;
        if (!saved || !source) {
          setError(
            "The saved transcript source is unavailable. Your saved report can still be edited or exported; import the transcript again to regenerate.",
          );
          return;
        }
        setJob(saved);
        setFilename(saved.filename);
        setFileBytes(saved.bytes);
        restoreMetadata.current?.({
          title: saved.title,
          date: saved.date,
          detail: saved.detail,
        });
        if (source) change.current(source);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Saved transcript could not be restored.",
          );
      });
    return () => {
      active = false;
      loaded.current = "";
    };
  }, [jobId]);
  useEffect(() => {
    if (!job?.retryAt) return;
    const delay = Math.max(0, new Date(job.retryAt).getTime() - Date.now());
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(delay + 10, 2147483647),
    );
    return () => clearTimeout(timer);
  }, [job?.retryAt]);
  const startBusy = (status: boolean) => {
    setBusy(status);
    onBusyChange?.(status);
  };
  const clearJobReference = () => {
    setJob(undefined);
    loaded.current = "";
    onJobChange?.("");
  };
  async function readFile(file?: File) {
    if (!file || busy) return;
    const previousJob = job;
    setJob(undefined);
    controller.current = new AbortController();
    startBusy(true);
    setError("");
    setStage("Validating document…");
    try {
      const result = await extractTranscript(file, {
        signal: controller.current.signal,
        onProgress: setStage,
      });
      onChange(result.text);
      setFilename(result.filename);
      setFileBytes(result.bytes);
      clearJobReference();
      setShowFull(false);
      for (const warning of result.warnings) toast.warning(warning);
      setStage("Text extracted · ready to summarize");
    } catch (cause) {
      if (!controller.current.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "This file could not be read.",
        );
      setJob(previousJob);
      setStage(
        controller.current.signal.aborted
          ? "Import cancelled · existing text kept"
          : "Import failed · existing text kept",
      );
    } finally {
      startBusy(false);
      if (upload.current) upload.current.value = "";
    }
  }
  async function process(saved?: TranscriptJob) {
    if (busy) return;
    controller.current = new AbortController();
    startBusy(true);
    setError("");
    setJob(saved);
    setStage(
      saved ? "Restoring saved sections…" : "Preparing transcript sections…",
    );
    try {
      const current =
        saved ??
        (await createTranscriptJob(value, {
          title,
          date,
          detail:
            detail === "Brief" || detail === "Detailed" ? detail : "Standard",
          filename: filename || undefined,
          bytes: fileBytes || bytes,
        }));
      setJob(current);
      loaded.current = current.id;
      onJobChange?.(current.id);
      const output = await runTranscriptJob(current.id, {
        signal: controller.current.signal,
        onProgress: (next) => {
          setJob(next);
          setStage(next.stage);
        },
        onRequestCompleted,
      });
      onOutput(output);
      toast.success("Meeting summary ready for review");
    } catch (cause) {
      if (!controller.current.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Processing stopped. Resume your saved job to retry.",
        );
    } finally {
      startBusy(false);
      await refresh();
    }
  }
  async function restore(saved: TranscriptJob) {
    try {
      const source = await getTranscriptSource(saved.id);
      if (!source)
        throw new Error(
          "The source for this job is unavailable. Upload it again.",
        );
      onChange(source);
      setJob(saved);
      setFilename(saved.filename);
      setFileBytes(saved.bytes);
      loaded.current = saved.id;
      onJobChange?.(saved.id);
      setError("");
      setStage(saved.stage);
      onRestoreMetadata?.({
        title: saved.title,
        date: saved.date,
        detail: saved.detail,
      });
      if (saved.output) onOutput(saved.output);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This job could not be opened.",
      );
    }
  }
  function dropped(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 1) {
      setError("Choose one transcript at a time.");
      return;
    }
    void readFile(event.dataTransfer.files[0]);
  }
  const cooling = Boolean(
    job?.retryAt && new Date(job.retryAt).getTime() > now,
  );
  const percent = job
    ? Math.round((job.completed / Math.max(1, job.total)) * 100)
    : 0;
  return (
    <div className="large-transcript-workspace">
      <div
        className={`transcript-dropzone ${dragging ? "is-dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={dropped}
      >
        <div className="transcript-upload-icon">
          <Upload size={21} />
        </div>
        <div>
          <strong>{filename || "Drop your transcript here"}</strong>
          <p>
            {filename
              ? `${(fileBytes / 1024 / 1024).toFixed(2)} MB · ${value.length.toLocaleString()} extracted characters`
              : "TXT, Markdown, VTT, DOCX, or text-based PDF · up to 25 MB"}
          </p>
        </div>
        <Button disabled={busy} onClick={() => upload.current?.click()}>
          <FolderOpen size={15} />
          {filename ? "Replace file" : "Browse files"}
        </Button>
        {filename && (
          <Button
            disabled={busy}
            variant="ghost"
            aria-label="Remove transcript file"
            onClick={() => {
              onChange("");
              setFilename("");
              setFileBytes(0);
              setStage("");
              clearJobReference();
            }}
          >
            <Trash2 size={16} />
          </Button>
        )}
        <input
          ref={upload}
          type="file"
          hidden
          accept=".txt,.md,.vtt,.docx,.pdf"
          aria-label="Upload meeting transcript"
          onChange={(event) => {
            void readFile(event.target.files?.[0]);
          }}
        />
      </div>
      <label className="field transcript-text-field">
        <span>Notes or transcript</span>
        <textarea
          aria-label="Notes or transcript"
          placeholder="Paste the conversation here. Speaker names and timestamps are preserved."
          value={large ? value.slice(0, 6000) : value}
          readOnly={large || busy}
          onChange={(event) => {
            onChange(event.target.value);
            setFilename("");
            setFileBytes(0);
            clearJobReference();
          }}
          rows={9}
        />
      </label>
      <div className="transcript-text-meta">
        <span>
          {value.length.toLocaleString()} characters ·{" "}
          {(bytes / 1024 / 1024).toFixed(2)} MB
        </span>
        {large && (
          <Button variant="ghost" onClick={() => setShowFull(true)}>
            Edit full transcript
          </Button>
        )}
      </div>
      {large && (
        <p className="hint">
          Showing a short preview to keep the editor responsive. All{" "}
          {value.length.toLocaleString()} characters will be processed.
        </p>
      )}
      <p className="hint">
        Documents are extracted in your browser. Each section is sent to AI when
        you generate. Scanned PDFs require OCR first.
      </p>
      <div className="transcript-actions">
        <Button
          variant="primary"
          disabled={
            busy || bytes > MAX_TRANSCRIPT_BYTES || value.trim().length < 8
          }
          onClick={() => {
            void process();
          }}
        >
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <FileText size={16} />
          )}
          Generate meeting summary
        </Button>
        {busy && (
          <Button onClick={() => controller.current?.abort()}>
            <Pause size={16} />
            Pause processing
          </Button>
        )}
        {job && !busy && job.status !== "complete" && (
          <Button
            disabled={cooling}
            onClick={() => {
              void process(job);
            }}
          >
            <Play size={16} />
            Resume saved job
          </Button>
        )}
      </div>
      {(stage || job) && (
        <div className="transcript-progress" role="status" aria-live="polite">
          <div>
            <strong>{stage || job?.stage}</strong>
            <span>
              {job ? `${job.completed} / ${job.total} sections analyzed` : ""}
            </span>
          </div>
          {job && (
            <progress
              value={percent}
              max={100}
              aria-label="Transcript sections analyzed"
            />
          )}
          <p className="hint">
            {job
              ? "Your source and completed sections are saved in this browser. Keep this tab open while processing; you can pause and resume after closing it. Large jobs may pause at the public allowance of 10 requests per 10 minutes."
              : busy
                ? "Processing your document locally…"
                : "Review the text before generating a summary."}
          </p>
          {job?.retryAt && (
            <p className="hint">
              {cooling
                ? "Request allowance resets after "
                : "Ready to resume after "}
              {new Date(job.retryAt).toLocaleTimeString()}.
            </p>
          )}
          {job && (
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  const sections = await getTranscriptNodes(job.id);
                  download(
                    JSON.stringify({ job, sections }, null, 2),
                    `${job.title}-section-notes.json`,
                    "application/json",
                  );
                } catch {
                  toast.error("Section notes could not be exported.");
                }
              }}
            >
              Export full section notes
            </Button>
          )}
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {bytes > MAX_TRANSCRIPT_BYTES && (
        <div className="error-banner" role="alert">
          The transcript exceeds 25 MB. Split it into separate meetings before
          generating.
        </div>
      )}
      {jobs.length > 0 && (
        <details className="transcript-jobs">
          <summary>
            <RotateCcw size={15} />
            Saved transcript jobs ({jobs.length})
          </summary>
          {jobs.map((saved) => (
            <div className="transcript-job" key={saved.id}>
              <div>
                <strong>{saved.title}</strong>
                <small>
                  {saved.completed}/{saved.total} sections · {saved.status} ·{" "}
                  {new Date(saved.updatedAt).toLocaleDateString()}
                </small>
              </div>
              <Button
                disabled={busy}
                onClick={() => {
                  void restore(saved);
                }}
              >
                Open
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                aria-label={`Delete saved transcript ${saved.title}`}
                onClick={async () => {
                  try {
                    await removeTranscriptJob(saved.id);
                    if (job?.id === saved.id) clearJobReference();
                    await refresh();
                    toast.success("Transcript job and source deleted");
                  } catch {
                    toast.error("Transcript job could not be deleted.");
                  }
                }}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
