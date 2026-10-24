"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ArrowUp, Command, CornerDownLeft, Search } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { features } from "@/lib/config";
import { commandInput, commandIntent } from "@/lib/command";
import type { Feature } from "@/lib/contracts";
import { GlassButton } from "@/components/glass";

export function CommandBar({ compact = false }: { compact?: boolean }) {
  const [value, setValue] = useState("");
  const [choose, setChoose] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { openDraft } = useWorkspace();
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
      if (e.key === "Escape") setChoose(false);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  function launch(feature: Feature, text = value) {
    setBusy(true);
    setChoose(false);
    openDraft({
      feature,
      title: "",
      input: commandInput(feature, text.trim()),
      output: null,
    });
    setError("");
    if (pathname === `/${feature}`) {
      setBusy(false);
      setValue("");
      return;
    }
    router.push(`/${feature}`);
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (value.trim().length < 3) {
      setError("Add a few words, or choose a tool below.");
      return;
    }
    setError("");
    const intent = commandIntent(value);
    if (intent) launch(intent);
    else setChoose(true);
  }
  return (
    <div className={`command-area ${compact ? "command-compact" : ""}`}>
      <form className="ai-command" onSubmit={submit}>
        {compact ? (
          <Search size={17} />
        ) : (
          <span className="command-symbol">
            <Command size={20} />
          </span>
        )}
        <input
          ref={ref}
          aria-label={compact ? "Global AI command" : "AI command"}
          placeholder="Ask AI anything or choose a productivity tool..."
          value={value}
          maxLength={12000}
          onChange={(e) => {
            setValue(e.target.value);
            setChoose(false);
            setError("");
          }}
          disabled={busy}
        />
        <kbd>Ctrl K</kbd>
        <GlassButton
          variant={compact ? "ghost" : "primary"}
          type="submit"
          aria-label="Open matching AI tool"
          loading={busy}
        >
          <ArrowUp size={18} />
        </GlassButton>
      </form>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {choose && (
        <div
          className="command-choices"
          role="region"
          aria-label="Choose the intended tool"
        >
          <p>Which tool should open this request?</p>
          {features.map((f) => (
            <button type="button" key={f.id} onClick={() => launch(f.id)}>
              <f.icon size={15} />
              {f.name}
              <CornerDownLeft size={13} />
            </button>
          ))}
        </div>
      )}
      {!compact && (
        <div className="command-suggestions">
          <span>Try asking</span>
          {[
            "Write a follow-up email",
            "Summarize my meeting",
            "Plan my week",
            "Research cloud computing",
          ].map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => launch(commandIntent(s)!, s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
