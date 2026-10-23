"use client";
import {
  HardDrive,
  ShieldCheck,
  Trash2,
  SlidersHorizontal,
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
      <section className="panel settings-panel">
        <h2>
          <HardDrive size={21} />
          Local workspace history
        </h2>
        <p>
          Opt in to saving generated drafts, plans, and review decisions in this
          browser. Saving is explicit: choose Save locally after editing.
          Nothing is synchronized across devices or saved to our server.
        </p>
        <label className="toggle-row">
          <span>
            <strong>Enable local history</strong>
            <small>
              {workspace.enabled
                ? "On — choose what to save"
                : "Off — work stays in memory until you refresh"}
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
          Turning this off prevents new saves. Use the delete action below to
          remove existing saved content. Shared browser users may be able to
          access saved content.
        </p>
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
          Clear saved content
        </h2>
        <p>
          There are {workspace.entries.length} saved items on this browser.
          Export anything you want to keep before clearing.
        </p>
        <ConfirmDialog
          title="Permanently clear local history?"
          description="All saved content and review history on this browser will be deleted. This cannot be undone."
          trigger={<Button variant="danger">Clear all saved content</Button>}
          onConfirm={workspace.clear}
        />
      </section>
    </div>
  );
}
