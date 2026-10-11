import { createWorker } from "tesseract.js";
import { EVENT_START_DATE } from "./constants";

/** Sanity bounds mirroring the `steps` table's check constraint (0–100,000). */
export const MIN_STEPS = 0;
export const MAX_STEPS = 100_000;

// The event is entirely within one month/year, so EVENT_START_DATE doubles as
// a sensible default/"preferred" year+month for disambiguating dates parsed
// out of screenshot text (e.g. a bare "15" with no year, or an ambiguous
// "10/15" where either day-first or month-first order could be meant).
const [EVENT_YEAR, EVENT_MONTH] = EVENT_START_DATE.split("-").map(Number);

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

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

const MONTH_NAME_PATTERN = Object.keys(MONTH_NAMES)
  .sort((a, b) => b.length - a.length)
  .join("|");

/**
 * Best-effort date detection in OCR'd screenshot text (e.g. "Oct 15",
 * "15 Oct 2026", "10/15/2026", "2026-10-15"). Not every fitness-app step
 * screen shows a date, so this returns null rather than throwing when
 * nothing date-like is found — callers should treat a null result as "trust
 * the user-selected date" rather than a hard failure.
 *
 * Deliberately does NOT try to parse relative words like "Today"/
 * "Yesterday" — there's no reliable way to know what device-local "today"
 * meant at screenshot-capture time, so those are left undetected on purpose.
 */
export function extractDateFromText(rawText: string): string | null {
  const text = rawText.replace(/\s+/g, " ");

  // "Oct 15" / "October 15, 2026"
  // "Oct 15" / "October 15, 2026" — the day-digits must not be immediately
  // followed by another comma+digit (e.g. "Oct 8,432" from a step count
  // right after the month name), or they're a fragment of a bigger number,
  // not a real day.
  const monthFirst = text.match(
    new RegExp(`\\b(${MONTH_NAME_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!,\\d)(?:,?\\s*(\\d{4}))?`, "i")
  );
  if (monthFirst) {
    const month = MONTH_NAMES[monthFirst[1].toLowerCase()];
    const day = parseInt(monthFirst[2], 10);
    const year = monthFirst[3] ? parseInt(monthFirst[3], 10) : EVENT_YEAR;
    if (isValidCalendarDate(year, month, day)) return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  // "15 Oct" / "15 October 2026" — symmetric guard: the day-digits must not
  // be immediately preceded by a comma (e.g. the "32" tail of "8,432" right
  // before an unrelated month name elsewhere in the text).
  const dayFirst = text.match(
    new RegExp(`(?<!,)\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_NAME_PATTERN})\\.?\\b(?:,?\\s*(\\d{4}))?`, "i")
  );
  if (dayFirst) {
    const day = parseInt(dayFirst[1], 10);
    const month = MONTH_NAMES[dayFirst[2].toLowerCase()];
    const year = dayFirst[3] ? parseInt(dayFirst[3], 10) : EVENT_YEAR;
    if (isValidCalendarDate(year, month, day)) return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  // ISO-ish "2026-10-15" / "2026/10/15"
  const isoLike = text.match(/\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b/);
  if (isoLike) {
    const year = parseInt(isoLike[1], 10);
    const month = parseInt(isoLike[2], 10);
    const day = parseInt(isoLike[3], 10);
    if (isValidCalendarDate(year, month, day)) return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  // Ambiguous numeric "15/10" or "10/15", optionally with a year.
  const numeric = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numeric) {
    const a = parseInt(numeric[1], 10);
    const b = parseInt(numeric[2], 10);
    let year = EVENT_YEAR;
    if (numeric[3]) {
      year = parseInt(numeric[3], 10);
      if (year < 100) year += 2000;
    }
    const candidates = [
      { month: a, day: b }, // M/D (US-style)
      { month: b, day: a }, // D/M (international)
    ].filter((c) => isValidCalendarDate(year, c.month, c.day));
    // Prefer whichever interpretation lands in the event month — every
    // screenshot seen during this event is from October.
    const preferred = candidates.find((c) => c.month === EVENT_MONTH) ?? candidates[0];
    if (preferred) return `${year}-${pad2(preferred.month)}-${pad2(preferred.day)}`;
  }

  return null;
}

export type OcrResult = {
  /** Detected step count, or null if no plausible number was found. */
  steps: number | null;
  /** Detected calendar date (YYYY-MM-DD) shown in the screenshot, or null if none was confidently found. */
  detectedDate: string | null;
};

/**
 * Runs OCR on an uploaded screenshot (as a raw image buffer) and extracts
 * both the step count and (if present) a date shown in the image, from a
 * single recognition pass.
 *
 * Uses tesseract.js (pure JS/WASM, no external API/key, runs entirely
 * server-side) — a fresh worker is created and terminated per call rather
 * than kept alive across requests, which is simplest and safest for a
 * serverless/Vercel deployment (no long-lived process to manage).
 */
export async function extractStepsAndDateFromImage(buffer: Buffer): Promise<OcrResult> {
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(buffer);
    return { steps: parseStepCount(text), detectedDate: extractDateFromText(text) };
  } finally {
    await worker.terminate();
  }
}
