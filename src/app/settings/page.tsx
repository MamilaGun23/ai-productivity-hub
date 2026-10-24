"use client";
import {
  HardDrive,
  ShieldCheck,
  Trash2,
  SlidersHorizontal,
  Download,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button, ConfirmDialog } from "@/components/ui";
export default function Settings() {
  const workspace = useWorkspace();
  return (
    <div className="page-wrap reading-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAKE YOURSELF AT HOME</div>
          <h1>
            Settings<span className="accent">.</span>
          </h1>
          <p>A few simple controls. Always your choice.</p>
        </div>
        <SlidersHorizontal size={28} className="muted" />
      </div>
      {workspace.storageError && (
        <p className="error-message" role="alert">
          {workspace.storageError}
        </p>
      )}
      <section className="panel settings-panel">
        <h2>
          <HardDrive size={21} />
          Local workspace history
        </h2>
        <p>
          Choose whether to save generated drafts, plans, and review decisions.
          Saved outputs, tasks, calendar events, prompt experiments, and
          transcript jobs use this browser’s IndexedDB storage. Preferences use
          localStorage. Nothing is synchronized across devices or saved to our
          server.
        </p>
        <label className="toggle-row">
          <span>
            <strong>Enable local history</strong>
            <small>
              {workspace.enabled
                ? "On — choose what to save"
                : "Off — generated outputs stay in memory unless exported"}
            </small>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Enable local history"
            checked={workspace.enabled}
            disabled={!workspace.ready}
            onChange={(e) => workspace.setEnabled(e.target.checked)}
          />
        </label>
        <p className="muted">
          Turning this off prevents new saved AI outputs. Tasks, events, request
          counts, explicitly saved experiments, and resumable transcript jobs
          are still stored locally. Shared browser users may access this data.
        </p>
      </section>
      <section className="panel settings-panel">
        <h2>
          <Download size={21} />
          Export your workspace
        </h2>
        <p>
          Download a JSON copy of your saved outputs, tasks, calendar events,
          experiments, usage records, transcript jobs, and active drafts. Keep
          this file private if it contains personal information.
        </p>
        <Button
          onClick={() => void workspace.exportData()}
          disabled={!workspace.ready}
        >
          <Download size={15} />
          Export all local data
        </Button>
      </section>
      <section className="panel settings-panel">
        <h2>
          <ShieldCheck size={21} />
          AI & privacy
        </h2>
        <p>
          Generation sends your inputs to Google Gemini. Do not submit
          confidential, sensitive, or personal information unless you are
          authorized. Provider usage and retention are subject to your site
          owner’s Google API terms and account settings.
        </p>
        <p>
          API credentials and model selection are configured by the site owner
          on the server. There are no accounts and no API key field in this
          browser.
        </p>
      </section>
      <section className="panel settings-panel">
        <h2>
          <Trash2 size={21} />
          Clear saved history
        </h2>
        <p>
          There are {workspace.entries.length} saved items on this browser.
          Export anything you want to keep before clearing.
        </p>
        <ConfirmDialog
          title="Permanently clear local history?"
          description="All saved content and review history on this browser will be deleted. This cannot be undone."
          trigger={
            <Button variant="danger" disabled={!workspace.ready}>
              Clear saved history
            </Button>
          }
          onConfirm={workspace.clear}
        />
      </section>
      <section className="panel settings-panel">
        <h2>
          <Trash2 size={21} />
          Clear all local data
        </h2>
        <p>
          This removes {workspace.tasks.length} tasks, {workspace.events.length}{" "}
          calendar events, {workspace.experiments.length} experiments, saved
          history, request counts, transcript jobs, active drafts, and the
          history preference from this browser.
        </p>
        <ConfirmDialog
          title="Permanently clear all local workspace data?"
          description="Every saved output, task, calendar event, prompt experiment, usage record, and transcript job on this browser will be removed. Download an export first if you want a copy."
          trigger={
            <Button variant="danger" disabled={!workspace.ready}>
              Clear all local data
            </Button>
          }
          onConfirm={() => void workspace.clearAll()}
        />
      </section>
    </div>
  );
}
