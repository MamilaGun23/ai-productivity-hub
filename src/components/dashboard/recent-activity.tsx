"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, History, Search, Trash2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { GlassPanel, GlassInput, GlassDropdown } from "@/components/glass";
import { Button, CopyButton, ConfirmDialog } from "@/components/ui";
import { features, getFeature } from "@/lib/config";
import { outputSchemas } from "@/lib/contracts";
import { formatOutput } from "@/lib/utils";
export function RecentActivity({ full = false }: { full?: boolean }) {
  const workspace = useWorkspace();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tool, setTool] = useState("");
  const entries = workspace.entries.filter(
    (e) =>
      (!tool || e.feature === tool) &&
      `${e.title} ${formatOutput(e.output)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <GlassPanel className="activity-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR WORK, WITHIN REACH</span>
          <h2>Recent activity</h2>
        </div>
        {!full && (
          <Link href="/history" className="text-link">
            View all <ArrowUpRight size={14} />
          </Link>
        )}
      </div>
      <div className="activity-filters">
        <label className="search-field">
          <Search size={16} />
          <GlassInput
            aria-label="Search saved activity"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your work..."
          />
        </label>
        <GlassDropdown
          aria-label="Filter activity by tool"
          value={tool}
          onChange={(e) => setTool(e.target.value)}
        >
          <option value="">All tools</option>
          {features.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </GlassDropdown>
      </div>
      {!workspace.ready ? (
        <p role="status">Restoring your workspace…</p>
      ) : !entries.length ? (
        <div className="activity-empty">
          <span className="empty-icon">
            <History size={23} />
          </span>
          <h3>
            {search || tool
              ? "No matching work"
              : "Good ideas deserve a place to land."}
          </h3>
          <p>
            {search || tool
              ? "Try another search or tool."
              : "Save an output from any tool. Pick it up here whenever you’re ready."}
          </p>
          {!workspace.enabled && (
            <Link className="text-link" href="/settings">
              Enable local history <ArrowUpRight size={14} />
            </Link>
          )}
        </div>
      ) : (
        <div className="activity-list">
          {entries.slice(0, full ? entries.length : 5).map((e) => {
            const f = getFeature(e.feature);
            const preview = formatOutput(e.output)
              .replace(/[#*\n]/g, " ")
              .slice(0, 140);
            return (
              <article className="activity-row" key={e.id}>
                <span className={`feature-icon ${f.color}`}>
                  <f.icon size={19} />
                </span>
                <div className="activity-copy">
                  <h3>{e.title}</h3>
                  <p>{preview || "Saved draft — ready to continue."}</p>
                  <small>
                    {f.name} · {new Date(e.updatedAt).toLocaleDateString()} ·{" "}
                    {e.review?.status || (e.output ? "Saved output" : "Draft")}
                  </small>
                </div>
                <div className="activity-actions">
                  <Button
                    aria-label={`Open and edit ${e.title}`}
                    onClick={() => {
                      workspace.setDraft({
                        savedId: e.id,
                        feature: e.feature,
                        title: e.title,
                        input: e.input,
                        output:
                          e.output === null
                            ? null
                            : outputSchemas[e.feature].parse(e.output),
                        review: e.review,
                      });
                      router.push(`/${e.feature}`);
                    }}
                  >
                    Open <ArrowUpRight size={14} />
                  </Button>
                  <CopyButton
                    text={
                      formatOutput(e.output) ||
                      Object.values(e.input).join("\n")
                    }
                  />
                  <ConfirmDialog
                    title="Delete this saved item?"
                    description="This removes the saved copy from this browser."
                    trigger={
                      <Button variant="ghost" aria-label={`Delete ${e.title}`}>
                        <Trash2 size={15} />
                      </Button>
                    }
                    onConfirm={() => workspace.remove(e.id)}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </GlassPanel>
  );
}
