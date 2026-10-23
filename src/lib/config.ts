import {
  Mail,
  NotebookPen,
  ListTodo,
  Telescope,
  ShieldCheck,
} from "lucide-react";
import type { Feature } from "./contracts";
export const features = [
  {
    id: "email",
    name: "Smart Email",
    fullName: "Smart Email Generator",
    description:
      "Find the right words. Write clear, confident emails in your own voice.",
    icon: Mail,
    color: "violet",
    tag: "Write with confidence",
    example:
      "Write a professional follow-up email after a project proposal meeting.",
    action: "Draft an email",
  },
  {
    id: "meetings",
    name: "Meeting Notes",
    fullName: "Meeting Notes Summarizer",
    description:
      "Turn the conversation into clarity, decisions, and next steps.",
    icon: NotebookPen,
    color: "cyan",
    tag: "Make every meeting count",
    example:
      "Summarize your meeting notes and find the actions that move work forward.",
    action: "Summarize a meeting",
  },
  {
    id: "planner",
    name: "Task Planner",
    fullName: "AI Task Planner",
    description:
      "Break big ambitions into a practical plan you can actually follow.",
    icon: ListTodo,
    color: "amber",
    tag: "From idea to done",
    example: "Plan the launch of a personal portfolio website in two weeks.",
    action: "Build a plan",
  },
  {
    id: "research",
    name: "Research Assistant",
    fullName: "AI Research Assistant",
    description:
      "Understand complex topics and uncover what matters in your material.",
    icon: Telescope,
    color: "blue",
    tag: "Follow your curiosity",
    example: "Explain how small businesses can use generative AI responsibly.",
    action: "Explore a topic",
  },
  {
    id: "checkpoint",
    name: "AI Checkpoint",
    fullName: "AI Checkpoint",
    description:
      "Pause, refine, and approve. Keep your judgment at the heart of AI.",
    icon: ShieldCheck,
    color: "green",
    tag: "Your judgment, amplified",
    example:
      "Review a draft for clarity, unsupported claims, and missing information.",
    action: "Review content",
  },
] satisfies {
  id: Feature;
  name: string;
  fullName: string;
  description: string;
  icon: typeof Mail;
  color: string;
  tag: string;
  example: string;
  action: string;
}[];
export const getFeature = (id: Feature) => features.find((f) => f.id === id)!;
