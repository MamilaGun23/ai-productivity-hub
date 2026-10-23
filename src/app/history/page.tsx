"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, History, Trash2, Search } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button, ConfirmDialog } from "@/components/ui";
import { getFeature } from "@/lib/config";
import { outputSchemas } from "@/lib/contracts";
export default function HistoryPage() {
  const workspace = useWorkspace();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const entries = workspace.entries.filter((e) =>
    `${e.title} ${e.feature}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR WORK, WITHIN REACH</div>
          <h1>
            Workspace history<span className="accent">.</span>
          </h1>
          <p>
            Saved by you. Stored only on this browser. Up to 50 recent items.
          </p>
        </div>
        <ConfirmDialog
          title="Clear all saved history?"
          description="This permanently removes all saved drafts, plans, and reviews from this browser. Export anything you want to keep first."
          trigger={
            <Button variant="danger" disabled={!workspace.entries.length}>
              <Trash2 size={15} />
              Clear all
            </Button>
          }
          onConfirm={workspace.clear}
        />
      </div>
      {!workspace.enabled && (
        <div className="info-note">
          Local history is off.{" "}
          <Link href="/settings">Enable it in Settings</Link> to save new items.
        </div>
      )}
      <label className="search-field">
        <Search size={18} />
        <input
          aria-label="Search history"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search saved work…"
        />
      </label>
      {!workspace.ready ? (
        <p role="status">Restoring local history…</p>
      ) : !entries.length ? (
        <div className="panel history-empty">
          <History size={35} />
          <h2>{search ? "No matching work" : "Your next idea belongs here"}</h2>
          <p>
            {search
              ? "Try a different title or tool name."
              : "Generate something useful, then choose Save locally to revisit it here."}
          </p>
          <Link className="button primary" href="/">
            Explore your toolkit <ArrowUpRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="history-list">
          {entries.map((entry) => {
            const f = getFeature(entry.feature);
            return (
              <article className="panel history-item" key={entry.id}>
                <span className={`feature-icon ${f.color}`}>
                  <f.icon size={22} />
                </span>
                <div>
                  <h2>{entry.title}</h2>
                  <p>
                    {f.fullName} · Updated{" "}
                    {new Date(entry.updatedAt).toLocaleString()}
                  </p>
                  {entry.review && (
                    <span className="status-badge">{entry.review.status}</span>
                  )}
                </div>
                <div className="actions">
                  <Button
                    onClick={() => {
                      workspace.setDraft({
                        savedId: entry.id,
                        feature: entry.feature,
                        title: entry.title,
                        input: entry.input,
                        output:
                          entry.output === null
                            ? null
                            : outputSchemas[entry.feature].parse(entry.output),
                        review: entry.review,
                      });
                      router.push(`/${entry.feature}`);
                    }}
                  >
                    Open <ArrowUpRight size={15} />
                  </Button>
                  <ConfirmDialog
                    title="Delete this saved item?"
                    description="This removes this copy from local history."
                    trigger={
                      <Button
                        variant="danger"
                        aria-label={`Delete ${entry.title}`}
                      >
                        <Trash2 size={16} />
                      </Button>
                    }
                    onConfirm={() => workspace.remove(entry.id)}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
