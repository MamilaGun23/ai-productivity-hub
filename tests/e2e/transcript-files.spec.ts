import { expect, test } from "@playwright/test";
import { jsPDF } from "jspdf";
import { meetingDocx } from "./docx-fixture";

test("extracts a real Word transcript without uploading the document", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") requests.push(request.url());
  });
  await page.goto("/meetings");
  await page
    .getByLabel("Upload meeting transcript")
    .setInputFiles({
      name: "meeting.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: meetingDocx(
        "Alex: Review the report. Sam: I will send feedback on Friday.",
      ),
    });
  await expect(page.getByLabel("Notes or transcript")).toHaveValue(
    /Alex: Review the report.*Sam: I will send feedback on Friday/s,
    { timeout: 30000 },
  );
  expect(requests).toEqual([]);
});

test("extracts a text PDF in the browser through the local PDF worker", async ({
  page,
}) => {
  const pdf = new jsPDF();
  pdf.text(
    "Alex: Review the launch checklist before the next meeting.",
    20,
    20,
  );
  await page.goto("/meetings");
  await page.getByLabel("Upload meeting transcript").setInputFiles({
    name: "meeting.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf.output("arraybuffer")),
  });
  await expect(page.getByLabel("Notes or transcript")).toHaveValue(
    /Alex: Review the launch checklist before the next meeting/,
    { timeout: 30000 },
  );
  await expect(
    page.getByRole("button", { name: "Replace file", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Remove transcript file", exact: true })
    .click();
  await expect(page.getByLabel("Notes or transcript")).toHaveValue("");
});

test("explains that an image-only PDF needs OCR", async ({ page }) => {
  const blank = new jsPDF();
  await page.goto("/meetings");
  await page.getByLabel("Upload meeting transcript").setInputFiles({
    name: "scan.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(blank.output("arraybuffer")),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: /OCR/ }),
  ).toContainText("OCR is not supported here", { timeout: 30000 });
  await expect(page.getByLabel("Notes or transcript")).toHaveValue("");
});

test("rejects corrupt PDFs and keeps previously pasted notes", async ({
  page,
}) => {
  await page.goto("/meetings");
  await page
    .getByLabel("Notes or transcript")
    .fill("Keep these useful notes if the uploaded file fails.");
  await page.getByLabel("Upload meeting transcript").setInputFiles({
    name: "broken.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("This is not a PDF file."),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: /corrupt/ }),
  ).toBeVisible();
  await expect(page.getByLabel("Notes or transcript")).toHaveValue(
    "Keep these useful notes if the uploaded file fails.",
  );
});
