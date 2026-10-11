import { createWorker } from "tesseract.js";

/** Sanity bounds mirroring the `steps` table's check constraint (0–100,000). */
export const MIN_STEPS = 0;
export const MAX_STEPS = 100_000;

/**
 * Parses OCR'd text for a step count: strips commas/spaces (common
 * thousands-separator noise from screenshots, e.g. "8,432" or "8 432"),
 * then takes the longest contiguous run of digits left in the text — on a
 * typical step-tracker screenshot, the step count is almost always the
 * largest number shown (dates, times, and goals tend to be shorter).
 *
 * Returns null if no digit sequence is found, or if the detected number
 * falls outside the plausible 0–100,000 daily step range (guards against
 * misreads like a 6-digit phone-status-bar time or a stray long number).
 */
export function parseStepCount(rawText: string): number | null {
  const cleaned = rawText.replace(/[,\s]/g, "");
  const matches = cleaned.match(/\d+/g);
  if (!matches || matches.length === 0) return null;

  const longest = matches.reduce((best, candidate) =>
    candidate.length > best.length ? candidate : best
  );

  const value = parseInt(longest, 10);
  if (!Number.isFinite(value)) return null;
  if (value < MIN_STEPS || value > MAX_STEPS) return null;
  return value;
}

/**
 * Runs OCR on an uploaded screenshot (as a raw image buffer) and returns the
 * detected step count, or null if no plausible number could be found.
 *
 * Uses tesseract.js (pure JS/WASM, no external API/key, runs entirely
 * server-side) — a fresh worker is created and terminated per call rather
 * than kept alive across requests, which is simplest and safest for a
 * serverless/Vercel deployment (no long-lived process to manage).
 */
export async function extractStepCountFromImage(buffer: Buffer): Promise<number | null> {
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(buffer);
    return parseStepCount(text);
  } finally {
    await worker.terminate();
  }
}
