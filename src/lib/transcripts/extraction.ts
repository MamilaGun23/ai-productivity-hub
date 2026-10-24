import { MAX_TRANSCRIPT_BYTES, utf8Bytes } from "./chunking";
export type ExtractionResult = {
  text: string;
  filename: string;
  bytes: number;
  warnings: string[];
};
export function validateTranscriptUpload(
  file: Pick<File, "name" | "size">,
  maximum = MAX_TRANSCRIPT_BYTES,
) {
  if (!/\.(txt|md|vtt|docx|pdf)$/i.test(file.name))
    throw new Error(
      "Choose a TXT, Markdown, VTT, DOCX, or text-based PDF file.",
    );
  if (!file.size)
    throw new Error(
      "This file is empty. Choose a file containing meeting text.",
    );
  if (file.size > maximum)
    throw new Error(
      `This file exceeds the ${Math.round(maximum / 1024 / 1024)} MB upload limit. Split the document and try again.`,
    );
}
export function normalizeTranscript(
  text: string,
  maximum = MAX_TRANSCRIPT_BYTES,
) {
  const clean = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
  if (utf8Bytes(clean) > maximum)
    throw new Error(
      "Extracted text exceeds the safe 25 MB processing limit. Split this document into separate meetings.",
    );
  if (clean.length < 8 || !/[\p{L}\p{N}].*[\p{L}\p{N}]/su.test(clean))
    throw new Error(
      "No readable meeting text was found. Choose a document with text or paste your notes.",
    );
  if ((clean.match(/\uFFFD/g)?.length ?? 0) > clean.length * 0.02)
    throw new Error(
      "The text encoding is unreadable. Save the file as UTF-8 and try again.",
    );
  return clean;
}
/** Reject ZIP expansion bombs before asking the DOCX parser to inflate XML. */
export function validateDocxContainer(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer),
    view = new DataView(buffer);
  if (bytes.length < 22 || view.getUint32(0, true) !== 0x04034b50)
    throw new Error("This DOCX is corrupt or is not a Word document.");
  let end = -1;
  for (
    let index = bytes.length - 22;
    index >= Math.max(0, bytes.length - 65557);
    index--
  )
    if (view.getUint32(index, true) === 0x06054b50) {
      end = index;
      break;
    }
  if (end < 0)
    throw new Error(
      "This DOCX is corrupt: its document directory could not be found.",
    );
  const entries = view.getUint16(end + 10, true),
    offset = view.getUint32(end + 16, true);
  if (entries > 10000 || entries === 65535 || offset === 0xffffffff)
    throw new Error(
      "This DOCX exceeds the safe document complexity limit. Export it as TXT.",
    );
  let pointer = offset,
    expanded = 0,
    xmlBytes = 0,
    hasDocument = false;
  for (let index = 0; index < entries; index++) {
    if (
      pointer + 46 > bytes.length ||
      view.getUint32(pointer, true) !== 0x02014b50
    )
      throw new Error("This DOCX is corrupt: a document entry is invalid.");
    const size = view.getUint32(pointer + 24, true),
      nameLength = view.getUint16(pointer + 28, true),
      extraLength = view.getUint16(pointer + 30, true),
      commentLength = view.getUint16(pointer + 32, true);
    const name = new TextDecoder().decode(
      bytes.slice(pointer + 46, pointer + 46 + nameLength),
    );
    expanded += size;
    if (/\.xml$/i.test(name)) xmlBytes += size;
    if (name === "word/document.xml") hasDocument = true;
    if (expanded > 128 * 1024 * 1024 || xmlBytes > MAX_TRANSCRIPT_BYTES)
      throw new Error(
        "This DOCX expands beyond the safe processing limit. Export the meeting text as TXT.",
      );
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  if (!hasDocument)
    throw new Error("This DOCX is corrupt: the Word document text is missing.");
}
export async function extractTranscript(
  file: File,
  options: {
    signal?: AbortSignal;
    onProgress?: (message: string) => void;
    maxBytes?: number;
  } = {},
): Promise<ExtractionResult> {
  validateTranscriptUpload(file, options.maxBytes);
  options.signal?.throwIfAborted();
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  options.onProgress?.("Reading your document…");
  let text = "";
  const warnings: string[] = [];
  try {
    if (extension === "pdf") {
      const data = new Uint8Array(await file.arrayBuffer());
      if (!new TextDecoder().decode(data.slice(0, 1024)).includes("%PDF-"))
        throw new Error("This PDF is corrupt or is not a valid PDF document.");
      const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const loading = pdfjs.getDocument({
        data,
        useSystemFonts: false,
        standardFontDataUrl: "/pdf-assets/standard_fonts/",
        cMapUrl: "/pdf-assets/cmaps/",
        cMapPacked: true,
      });
      const abort = () => {
        void loading.destroy();
      };
      options.signal?.addEventListener("abort", abort, { once: true });
      try {
        const pdf = await loading.promise;
        const pages: string[] = [];
        let extractedBytes = 0,
          unreadablePages = 0;
        for (let number = 1; number <= pdf.numPages; number++) {
          options.signal?.throwIfAborted();
          options.onProgress?.(
            `Extracting PDF page ${number} of ${pdf.numPages}…`,
          );
          const page = await pdf.getPage(number);
          const content = await page.getTextContent();
          const pageText = content.items
            .map((item) =>
              "str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : "",
            )
            .join("");
          if (!pageText.trim()) unreadablePages++;
          extractedBytes += utf8Bytes(pageText);
          if (extractedBytes > MAX_TRANSCRIPT_BYTES)
            throw new Error(
              "Extracted text exceeds the safe 25 MB processing limit. Split this document.",
            );
          pages.push(pageText);
          page.cleanup();
        }
        text = pages.join("\n\n");
        if (!text.trim())
          throw new Error(
            "This PDF contains no extractable text. Scanned/image-only PDFs need OCR first; OCR is not supported here.",
          );
        if (unreadablePages)
          warnings.push(
            `${unreadablePages} PDF page(s) had no extractable text. Images and scanned pages need OCR; review the extracted transcript for missing content.`,
          );
      } finally {
        options.signal?.removeEventListener("abort", abort);
        await loading.destroy();
      }
    } else if (extension === "docx") {
      options.onProgress?.("Extracting Word document text…");
      const buffer = await file.arrayBuffer();
      validateDocxContainer(buffer);
      const mammoth = await import("mammoth/mammoth.browser");
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      text = result.value;
      if (result.messages.length)
        warnings.push(
          "Some document formatting could not be read. Review the extracted text before summarizing.",
        );
    } else text = await file.text();
    options.signal?.throwIfAborted();
    return {
      text: normalizeTranscript(text),
      filename: file.name,
      bytes: file.size,
      warnings,
    };
  } catch (error) {
    if (options.signal?.aborted)
      throw new DOMException("Cancelled", "AbortError");
    if (
      error instanceof Error &&
      /OCR|corrupt|readable|exceeds|expands|encoding|empty/.test(error.message)
    )
      throw error;
    throw new Error(
      extension === "pdf"
        ? "This PDF could not be read. It may be corrupt or password protected. Export an unlocked text-based PDF and try again."
        : "This document could not be read. It may be corrupt. Export a fresh DOCX or UTF-8 TXT file and try again.",
    );
  }
}
