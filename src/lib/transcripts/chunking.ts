export const DEFAULT_CONTEXT_TOKENS = 32768;
export const MAX_SECTION_BYTES = 14000;
export const MAX_TRANSCRIPT_BYTES = 25 * 1024 * 1024;
const encoder = new TextEncoder();
export const utf8Bytes = (text: string) => encoder.encode(text).byteLength;

/** Conservative byte-token bound. Byte-fallback tokenizers never need more than one token per UTF-8 byte. */
export const estimateTokens = utf8Bytes;
export type TranscriptChunk = {
  index: number;
  text: string;
  context: string;
  start: number;
  end: number;
};
export function sectionBudget(contextTokens = DEFAULT_CONTEXT_TOKENS) {
  if (!Number.isInteger(contextTokens) || contextTokens < 12000)
    throw new Error("The model context must be at least 12,000 tokens.");
  return Math.min(MAX_SECTION_BYTES, contextTokens - 8192 - 3000);
}
function prefixWithin(text: string, bytes: number) {
  let used = 0,
    length = 0;
  while (length < text.length) {
    const point = text.codePointAt(length)!;
    const size = point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
    if (used + size > bytes) break;
    used += size;
    length += point > 0xffff ? 2 : 1;
  }
  return text.slice(0, length);
}
function suffixWithin(text: string, budget: number) {
  let start = text.length,
    used = 0;
  while (start > 0) {
    let previous = start - 1;
    const unit = text.charCodeAt(previous);
    if (unit >= 0xdc00 && unit <= 0xdfff && previous > 0) {
      const high = text.charCodeAt(previous - 1);
      if (high >= 0xd800 && high <= 0xdbff) previous--;
    }
    const point = text.codePointAt(previous)!;
    const bytes =
      point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
    if (used + bytes > budget) break;
    used += bytes;
    start = previous;
  }
  return text.slice(start);
}
export function chunkTranscript(
  source: string,
  budget = sectionBudget(),
  overlapBytes = 600,
): TranscriptChunk[] {
  if (budget < 256 || overlapBytes < 0 || overlapBytes >= budget)
    throw new Error("Invalid transcript section budget.");
  const chunks: TranscriptChunk[] = [];
  let start = 0;
  while (start < source.length) {
    let text = prefixWithin(source.slice(start), budget);
    if (!text) throw new Error("A transcript section could not be created.");
    if (start + text.length < source.length) {
      const newline = text.lastIndexOf("\n");
      // Keep speaker turns/timestamps intact when possible. A single very long turn is split without losing any text.
      if (newline >= text.length * 0.4) text = text.slice(0, newline + 1);
      else {
        const boundaries = [...text.matchAll(/[.!?][ \t]+/g)];
        const boundary = boundaries.at(-1);
        if (boundary && boundary.index >= text.length * 0.4)
          text = text.slice(0, boundary.index + boundary[0].length);
      }
    }
    const prior = chunks.at(-1)?.text ?? "";
    const context = suffixWithin(prior, overlapBytes);
    chunks.push({
      index: chunks.length,
      text,
      context,
      start,
      end: start + text.length,
    });
    start += text.length;
  }
  return chunks;
}
/** Ordered batches keep every summary; no truncation when recursive reduction is needed. */
export function batchSummaries(
  summaries: string[],
  bytes = MAX_SECTION_BYTES,
): string[][] {
  const batches: string[][] = [];
  for (const summary of summaries) {
    if (utf8Bytes(summary) > bytes)
      throw new Error(
        "A section summary exceeded the reduction budget. Retry that section.",
      );
    const last = batches.at(-1);
    if (
      !last ||
      last.length >= 6 ||
      utf8Bytes([...last, summary].join("\n\n")) > bytes
    )
      batches.push([summary]);
    else last.push(summary);
  }
  return batches;
}
