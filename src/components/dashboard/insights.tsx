"use client";
import { Activity, ArrowUpRight, CheckCheck, FolderOpen } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { summarizeUsage } from "@/lib/local-data";
import { getFeature } from "@/lib/config";
import type { Feature } from "@/lib/contracts";

export function Insights() {
  const workspace = useWorkspace();
  const summary = summarizeUsage(workspace);
  const maximum = Math.max(1, ...summary.daily.map((day) => day.count));
  const failures = workspace.usage.filter(
    (event) => event.status === "error",
  ).length;
  return (
    <section
      className="panel glass-card insight-panel"
      aria-labelledby="insights-title"
    >
      <div className="widget-heading">
        <div>
          <span className="eyebrow">YOUR WORK IN MOTION</span>
          <h2 id="insights-title">Workspace insights</h2>
        </div>
        <span className="status-badge">This week</span>
      </div>
      <div className="insight-stats">
        <div>
          <span>
            <Activity size={15} />
            AI requests
          </span>
          <strong>{summary.requests}</strong>
          <small>
            {summary.hasPrevious
              ? `${summary.previousRequests} recorded last week`
              : "Your activity starts here"}
          </small>
        </div>
        <div>
          <span>
            <CheckCheck size={15} />
            Tasks completed
          </span>
          <strong>{summary.completed}</strong>
          <small>Completed this week</small>
        </div>
        <div>
          <span>
            <FolderOpen size={15} />
            Saved outputs
          </span>
          <strong>{summary.saved}</strong>
          <small>In your local workspace</small>
        </div>
      </div>
      <div
        className="usage-chart"
        role="img"
        aria-label={`AI requests this week: ${summary.daily.map((day) => `${day.label} ${day.count}`).join(", ")}`}
      >
        {summary.daily.map((day) => (
          <div className="usage-day" key={day.date}>
            <span className="usage-count">{day.count || ""}</span>
            <div className="usage-bar-track">
              <span style={{ height: `${(day.count / maximum) * 100}%` }} />
            </div>
            <small>{day.label.slice(0, 1)}</small>
          </div>
        ))}
      </div>
      <div className="usage-breakdown">
        <h3>
          Tool activity <ArrowUpRight size={13} />
        </h3>
        {summary.requests ? (
          <ul>
            {summary.breakdown
              .filter((item) => item.count > 0)
              .map((item) => (
                <li key={item.feature}>
                  <span>
                    <i className={`tool-dot ${item.feature}`} />
                    {getFeature(item.feature as Feature).name}
                  </span>
                  <strong>{item.count}</strong>
                </li>
              ))}
          </ul>
        ) : (
          <p className="muted">
            Use a tool to see your real activity here. There are no estimated
            time savings.
          </p>
        )}
      </div>
      <p className="insight-note">
        Counts are recorded on this browser. Requests include successful and
        failed attempts
        {failures
          ? `; ${failures} failed attempt${failures === 1 ? "" : "s"} in retained history`
          : ""}
        .
      </p>
    </section>
  );
}
