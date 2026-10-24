import type { Feature } from "./contracts";

/** Navigation only. User text never authorizes mutations or arbitrary execution. */
export function commandIntent(text: string): Feature | null {
  const matches: Feature[] = [];
  if (/\b(email|e-mail|mail|letter)\b/i.test(text)) matches.push("email");
  if (/\b(meeting|transcript|minutes)\b/i.test(text)) matches.push("meetings");
  if (/\b(plan|tasks?|schedule|planner)\b/i.test(text)) matches.push("planner");
  if (/\b(research|explain|learn|investigate)\b/i.test(text))
    matches.push("research");
  if (/\b(review|checkpoint|prompt|refine)\b/i.test(text))
    matches.push("checkpoint");
  return matches.length === 1 ? matches[0] : null;
}
export function commandInput(
  feature: Feature,
  text: string,
): Record<string, string> {
  if (feature === "email") return { purpose: text, topic: text.slice(0, 300) };
  if (feature === "meetings") return { title: text.slice(0, 300) };
  if (feature === "planner")
    return { title: text.slice(0, 300), description: text };
  if (feature === "research") return { topic: text.slice(0, 300) };
  return { title: text.slice(0, 300), content: text };
}
