"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CircleCheck,
  ShieldCheck,
} from "lucide-react";
import { features } from "@/lib/config";
import { RibbonMark } from "@/components/branding/brand-logo";
import { ToolArt } from "@/components/branding/tool-art";
import { GlassPanel } from "@/components/glass";
import { CommandBar } from "@/components/dashboard/command-bar";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { FocusCalendar } from "@/components/dashboard/focus-calendar";
import { Insights } from "@/components/dashboard/insights";
export default function Dashboard() {
  return (
    <div className="dashboard page-wrap">
      <div className="dashboard-intro">
        <div>
          <span className="eyebrow">
            A LITTLE CLARITY. A LOT MORE POSSIBILITY.
          </span>
          <p>Your workspace, with a little more momentum.</p>
        </div>
        <span className="workspace-label">
          <span className="status-dot" />
          Personal workspace
        </span>
      </div>
      <div className="dashboard-layout">
        <div className="dashboard-main">
          <GlassPanel className="momentum-hero">
            <div className="hero-copy">
              <span className="pill">
                <span className="status-dot" />
                INTELLIGENCE, WITH INTENTION
              </span>
              <h1>
                Turn ideas
                <br />
                into <span>progress.</span>
              </h1>
              <p>
                Your AI-powered workspace for writing, planning, research, and
                staying on track.
              </p>
              <Link className="button primary" href="/planner">
                Make your next move <ArrowRight size={16} />
              </Link>
              <span className="hero-footnote">
                Five tools. Connected possibilities.
              </span>
            </div>
            <div className="ribbon-scene" aria-hidden="true">
              <div className="ribbon-halo" />
              <RibbonMark decorative />
              <div className="ribbon-glass-floor" />
              <span className="ribbon-label">
                <CircleCheck size={14} />
                From possibility to progress
              </span>
            </div>
          </GlassPanel>
          <CommandBar />
          <section className="tool-section">
            <div className="section-heading">
              <div>
                <h2>A little help. A lot of potential.</h2>
                <p>Choose your starting point.</p>
              </div>
              <span className="section-kicker">YOUR AI TOOLKIT</span>
            </div>
            <div className="tool-card-grid">
              {features.map((f, i) => (
                <Link
                  className={`tool-card ${f.color}`}
                  href={`/${f.id}`}
                  key={f.id}
                >
                  <div className="tool-card-art">
                    <span className="tool-index">0{i + 1}</span>
                    <ToolArt feature={f.id} />
                  </div>
                  <h3>
                    {f.id === "email"
                      ? "Smart Email"
                      : f.id === "meetings"
                        ? "Meeting Notes"
                        : f.name}
                  </h3>
                  <p>{f.description}</p>
                  <span className="tool-card-action">
                    {f.action}
                    <ArrowUpRight size={15} />
                  </span>
                </Link>
              ))}
            </div>
          </section>
          <RecentActivity />
          <Insights />
        </div>
        <div className="dashboard-context">
          <FocusCalendar />
        </div>
      </div>
      <div className="responsible-banner">
        <span className="responsible-banner-icon">
          <ShieldCheck size={20} />
        </span>
        <div>
          <strong>Powered by AI. Guided by you.</strong>
          <p>
            Review AI outputs, check important facts, and keep sensitive
            information private.
          </p>
        </div>
        <Link href="/about">
          Our approach <ArrowUpRight size={15} />
        </Link>
      </div>
    </div>
  );
}
