import type { Outputs } from "../src/lib/contracts";
export const outputs: Outputs = {
  email: {
    subject: "Project follow-up",
    body: "Hello team,\n\nThank you for reviewing the proposal. Please share your feedback.\n\nBest regards",
  },
  meetings: {
    overview: "The team reviewed the launch.",
    discussion: ["Launch readiness"],
    decisions: ["Proceed after review"],
    actionItems: [
      {
        description: "Review the launch checklist",
        owner: "Alex",
        deadline: "Not specified",
        priority: "High",
        completed: false,
      },
    ],
    risks: ["Review is pending"],
    questions: ["When will review finish?"],
    assumptions: [],
  },
  planner: {
    overview: "Launch the portfolio in small steps.",
    tasks: [
      {
        id: "t1",
        title: "Design the homepage",
        description: "Create a clear layout.",
        subtasks: ["Sketch sections"],
        priority: "High",
        status: "To Do",
        estimatedHours: 3,
        dependencies: [],
        schedule: "Day 1",
        dueDate: "",
      },
      {
        id: "t2",
        title: "Build the homepage",
        description: "Implement the design.",
        subtasks: [],
        priority: "Medium",
        status: "To Do",
        estimatedHours: 4,
        dependencies: ["t1"],
        schedule: "Day 2",
        dueDate: "",
      },
    ],
    blockers: ["Assets needed"],
    recommendations: ["Review daily"],
    assumptions: ["Timelines are estimates."],
  },
  research: {
    overview: "Responsible AI requires human oversight.",
    concepts: ["Human review"],
    explanation: "Review generated material before using it.",
    examples: ["Review an email draft"],
    insights: ["Use a checkpoint"],
    recommendations: ["Verify facts"],
    limitations: ["Knowledge may be outdated; no live browsing."],
    arguments: [],
    facts: [],
    questions: ["What safeguards apply?"],
    basis: "General model knowledge",
  },
  checkpoint: {
    analysis: "The draft is clear but needs a specific next step.",
    concerns: ["The deadline is missing."],
    suggestions: ["Ask for feedback by an agreed date."],
    revisedContent:
      "Hello team, please review the proposal and suggest a suitable feedback date. Thank you.",
  },
};
export const emailInput = {
  purpose: "Ask the team to review the project proposal",
  topic: "Project proposal",
  tone: "Professional",
  length: "Medium",
  recipient: "",
  context: "",
};
