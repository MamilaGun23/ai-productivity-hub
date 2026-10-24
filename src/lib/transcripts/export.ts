import type { Outputs } from "../contracts";
import { formatOutput } from "../utils";
/** Text-based PDF: no content is sent to an export service. */
export async function exportMeetingPdf(
  report: Outputs["meetings"],
  title = "Meeting summary",
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setProperties({
    title,
    subject: "AI Productivity Hub meeting report",
    creator: "AI Productivity Hub",
  });
  const font = await fetch(
    "/pdf-assets/standard_fonts/LiberationSans-Regular.ttf",
  );
  if (!font.ok)
    throw new Error(
      "The PDF font could not be loaded. Export text or Markdown to keep a copy.",
    );
  const bytes = new Uint8Array(await font.arrayBuffer());
  const binary: string[] = [];
  for (let start = 0; start < bytes.length; start += 32768)
    binary.push(String.fromCharCode(...bytes.subarray(start, start + 32768)));
  pdf.addFileToVFS("HubSans.ttf", btoa(binary.join("")));
  pdf.addFont("HubSans.ttf", "HubSans", "normal");
  pdf.setFont("HubSans", "normal");
  pdf.setFontSize(11);
  const text = `${title}\n\n${formatOutput(report)}\n\nAI-generated draft. Review facts, owners, and deadlines before use.`;
  const lines: string[] = pdf.splitTextToSize(text, 174);
  let y = 20;
  for (const line of lines) {
    if (y > 278) {
      pdf.addPage();
      y = 20;
    }
    pdf.text(line, 18, y);
    y += 5.2;
  }
  pdf.save(
    `${title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 70) || "meeting-summary"}.pdf`,
  );
}
