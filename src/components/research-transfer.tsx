"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { Button } from "./ui";
import type { Outputs } from "@/lib/contracts";
export function ResearchTransfer({
  output,
  title,
}: {
  output: Outputs["research"];
  title: string;
}) {
  const [context, setContext] = useState("");
  const [error, setError] = useState("");
  const workspace = useWorkspace();
  const router = useRouter();
  const options = [
    ...new Set([output.overview, ...output.insights, ...output.facts]),
  ].filter(Boolean);
  return (
    <section className="research-transfer" aria-label="Research to email">
      <h3>Turn findings into a conversation</h3>
      <p>
        Select findings, then review the context before opening an email draft.
      </p>
      <details>
        <summary>Choose research findings</summary>
        {options.map((text, i) => (
          <label className="checkbox-row" key={i}>
            <input
              type="checkbox"
              checked={context.includes(text)}
              onChange={(e) => {
                const next = e.target.checked
                  ? `${context}${context ? "\n\n" : ""}${text}`
                  : context.replace(text, "").trim();
                if (next.length > 11800) {
                  setError(
                    "These findings exceed the email context limit. Shorten the context or choose fewer findings.",
                  );
                  return;
                }
                setError("");
                setContext(next);
              }}
            />
            <span>{text}</span>
          </label>
        ))}
      </details>
      <label>
        Information to use in email
        <textarea
          aria-label="Information to use in email"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          maxLength={11800}
          rows={5}
          placeholder="Choose findings above or paste the information you want to share."
        />
      </label>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <Button
        onClick={() => {
          if (!context.trim()) {
            setError("Select or enter information to transfer first.");
            return;
          }
          workspace.setDraft({
            feature: "email",
            title,
            input: {
              purpose: `Write an email sharing the following research on ${title}.`,
              topic: title.slice(0, 300),
              context: `Research basis: ${output.basis}. Review facts before sending.\n${context}`,
              tone: "Professional",
              length: "Medium",
            },
            output: null,
          });
          router.push("/email");
        }}
      >
        <Mail size={15} />
        Draft email from selected findings
      </Button>
    </section>
  );
}
