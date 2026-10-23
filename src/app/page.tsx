"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Layers3,
  CircleCheck,
  Zap,
  History,
} from "lucide-react";
import { features, getFeature } from "@/lib/config";
import { useWorkspace } from "@/components/workspace-provider";
import { outputSchemas } from "@/lib/contracts";
import { useRouter } from "next/navigation";
export default function Dashboard() {
  const workspace = useWorkspace();
  const router = useRouter();
  const approved = workspace.entries.filter(
    (e) => e.review?.status === "Approved",
  ).length;
  function launchExample(
    id: "email" | "planner" | "research",
    input: Record<string, string | undefined>,
  ) {
    workspace.setDraft({
      feature: id,
      title: "",
      input: Object.fromEntries(
        Object.entries(input).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ),
      output: null,
    });
    router.push(`/${id}`);
  }
  return (
    <div className="dashboard page-wrap">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="tiny-line" />A LITTLE CLARITY. A LOT MORE
            POSSIBILITY.
          </div>
          <h1>
            Your space to do more<span className="accent">.</span>
          </h1>
          <p>
            Less busywork. More meaningful work. Let’s make something happen.
          </p>
        </div>
        <span className="workspace-label">
          <span className="status-dot" />
          Personal workspace
        </span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="pill">
            <Sparkles size={13} />
            YOUR IDEAS, WITH A HEAD START
          </span>
          <h2>
            Big ideas.
            <br />
            Meet your <span>unfair advantage.</span>
          </h2>
          <p>
            From the first draft to the final decision, your AI toolkit helps
            you turn a full plate into a clear path forward.
          </p>
          <Link className="button primary" href="/email">
            <Sparkles size={16} />
            Create your first draft <ArrowRight size={16} />
          </Link>
          <span className="hero-footnote">
            Five tools. One workspace. You’re in control.
          </span>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="visual-stars">✦</div>
          <div className="visual-core">
            <Sparkles size={48} />
          </div>
          <div className="float-chip chip-one">
            <span className="chip-icon cyan">
              <Layers3 size={18} />
            </span>
            <div>
              From scattered notes<span>to clear next steps</span>
            </div>
            <CircleCheck size={16} />
          </div>
          <div className="float-chip chip-two">
            <span className="chip-icon violet">
              <Zap size={18} />
            </span>
            <div>
              Make room for<span>your best work.</span>
            </div>
          </div>
          <div className="visual-caption">
            <span className="status-dot" />A little intelligence goes a long way
          </div>
        </div>
      </section>
      <section className="stats-grid" aria-label="Workspace at a glance">
        <div>
          <span className="stat-icon violet">
            <Layers3 size={20} />
          </span>
          <div>
            <span>At your fingertips</span>
            <strong>
              5 <small>AI-powered tools</small>
            </strong>
          </div>
        </div>
        <div>
          <span className="stat-icon cyan">
            <History size={20} />
          </span>
          <div>
            <span>Saved on this browser</span>
            <strong>
              {workspace.entries.length} <small>workspace items</small>
            </strong>
          </div>
        </div>
        <div>
          <span className="stat-icon green">
            <ShieldCheck size={20} />
          </span>
          <div>
            <span>Reviewed by you</span>
            <strong>
              {approved} <small>approved drafts</small>
            </strong>
          </div>
        </div>
      </section>
      <section>
        <div className="section-heading">
          <div>
            <h2>A toolkit for your everyday</h2>
            <p>Choose where you want a little momentum.</p>
          </div>
          <span className="section-kicker">WORK SMARTER, STAY HUMAN</span>
        </div>
        <div className="feature-grid">
          {features.map((f, index) => (
            <Link
              className={`feature-card ${f.color} ${f.id === "checkpoint" ? "checkpoint-card" : ""}`}
              href={`/${f.id}`}
              key={f.id}
            >
              <div className="feature-card-top">
                <span className={`feature-icon ${f.color}`}>
                  <f.icon size={23} />
                </span>
                <span className="feature-number">0{index + 1}</span>
              </div>
              <div>
                <h3>
                  {f.fullName}
                  {f.id === "checkpoint" && (
                    <span className="human-badge">HUMAN IN THE LOOP</span>
                  )}
                </h3>
                <p>{f.description}</p>
              </div>
              <span className="feature-action">
                {f.action}
                <ArrowUpRight size={17} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <div className="bottom-grid">
        <section className="quick-start panel">
          <div className="section-heading">
            <h2>
              <Zap size={18} />
              Skip the blank page
            </h2>
            <span className="muted">A place to start</span>
          </div>
          {[
            {
              title: "An email that strikes the right tone",
              sub: "Follow up on a project proposal",
              id: "email" as const,
              input: {
                purpose: features[0].example,
                topic: "Project proposal follow-up",
              },
            },
            {
              title: "A big goal, broken into small wins",
              sub: "Plan your portfolio website launch",
              id: "planner" as const,
              input: {
                title: "Portfolio website launch",
                description: features[2].example,
              },
            },
            {
              title: "A complex topic, made clear",
              sub: "Explore responsible AI for small business",
              id: "research" as const,
              input: { topic: features[3].example },
            },
          ].map((item, i) => (
            <button
              key={item.id}
              className="quick-row"
              onClick={() => launchExample(item.id, item.input)}
            >
              <span className="quick-number">0{i + 1}</span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.sub}</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </section>
        <section className="recent panel">
          <div className="section-heading">
            <h2>Pick up where you left off</h2>
            <Link href="/history" aria-label="View all history">
              <ArrowUpRight size={17} />
            </Link>
          </div>
          {workspace.entries.length ? (
            workspace.entries.slice(0, 3).map((e) => {
              const f = getFeature(e.feature);
              return (
                <button
                  className="quick-row"
                  key={e.id}
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
                  <f.icon size={19} />
                  <span>
                    <strong>{e.title}</strong>
                    <small>
                      {f.name} · {new Date(e.updatedAt).toLocaleDateString()}
                    </small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              );
            })
          ) : (
            <div className="recent-empty">
              <span className="empty-icon">
                <History size={24} />
              </span>
              <strong>A fresh start looks good on you.</strong>
              <p>
                Save your work to see it here. Your next great idea is just a
                click away.
              </p>
              <Link href="/settings">
                Set up local history <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </section>
      </div>
      <div className="responsible-banner">
        <span className="responsible-banner-icon">
          <ShieldCheck size={20} />
        </span>
        <div>
          <strong>Powered by AI. Guided by you.</strong>
          <p>
            AI is a starting point, not the final word. Review outputs and keep
            sensitive information private.
          </p>
        </div>
        <Link href="/about">
          Our approach <ArrowUpRight size={15} />
        </Link>
      </div>
    </div>
  );
}
