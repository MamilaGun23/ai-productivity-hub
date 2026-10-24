import Link from "next/link";
import { ShieldCheck, Sparkles, LockKeyhole, Eye } from "lucide-react";
export default function About() {
  return (
    <div className="page-wrap reading-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">THOUGHTFUL TOOLS. HUMAN JUDGMENT.</div>
          <h1>
            A little more intentional<span className="accent">.</span>
          </h1>
          <p>Productivity should give you room to think.</p>
        </div>
      </div>
      <section className="panel settings-panel">
        <h2>
          <Sparkles size={22} />
          Meet AI Productivity Hub
        </h2>
        <p>
          One focused workspace for writing emails, understanding meetings,
          planning tasks, exploring ideas, and reviewing generated content.
          Built as a CAPACITI AI portfolio project with Next.js, TypeScript, and
          Google Gemini.
        </p>
        <p>
          The project brief demonstrated Lovable. This implementation uses
          Next.js and Vercel; CAPACITI’s acceptance of this platform
          substitution must be confirmed separately.
        </p>
      </section>
      <section className="panel settings-panel">
        <h2>
          <ShieldCheck size={22} />
          Responsible AI, in practice
        </h2>
        <p>
          AI Productivity Hub uses artificial intelligence to generate and
          analyze content. AI-generated responses may contain inaccuracies or
          omissions. Review important information before relying on it. Avoid
          submitting sensitive or confidential information unless you are
          authorized to do so.
        </p>
        <p>
          Check names, dates, claims, and recommendations. Estimated schedules
          are suggestions, not guarantees. General research uses model knowledge
          and may be outdated. Supplied-material analysis relies on the text you
          provide. Neither mode performs live web search or independent fact
          checking.
        </p>
        <p>
          Checkpoint keeps approval with you. AI review can suggest
          improvements, but cannot guarantee factual correctness, fairness,
          safety, or suitability for a decision.
        </p>
      </section>
      <section className="panel settings-panel">
        <h2>
          <LockKeyhole size={22} />
          Your data & your control
        </h2>
        <p>
          Inputs are sent to Google Gemini for processing. This application does
          not store transcripts or outputs on its server. Google’s processing
          and retention depend on the configured account and applicable provider
          terms.
        </p>
        <p>
          Local history is optional and off by default. Explicitly saved content
          stays in IndexedDB in this browser and is not encrypted by this
          application. Tasks, events, usage and transcript checkpoints are also
          stored locally. Nothing syncs across devices. Clear saved content in{" "}
          <Link href="/settings">Settings</Link>; disabling history does not
          delete existing items.
        </p>
        <p>
          Public AI requests use managed rate limiting in production. The
          limiter counts short-lived requests per network address. The hosting
          and AI providers may process operational metadata under their own
          terms.
        </p>
      </section>
      <section className="panel settings-panel">
        <h2>
          <Eye size={22} />
          Accessible without an account
        </h2>
        <p>
          No sign-up, passwords, or registration. Keyboard controls, visible
          focus indicators, accessible dialogs, and reduced-motion styles help
          make the workspace usable by more people.
        </p>
      </section>
    </div>
  );
}
