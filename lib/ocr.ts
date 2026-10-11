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
 * Prefers a number token that already looks like a comma-grouped thousands
 * number (e.g. "8,966", "10,482") over a bare digit run, since a genuine
 * step count almost always displays with thousands separators on these
 * screenshots — this lets label-anchored lookups above a label-free "Steps"
 * mention skip past small unrelated numbers.
 */
const NUMBER_TOKEN_SOURCE = String.raw`\d{1,3}(?:,\d{3})+|\d+`;

const STEPS_LABEL = /steps\b/gi;

function toStepValue(token: string): number | null {
  const value = parseInt(token.replace(/,/g, ""), 10);
  if (!Number.isFinite(value)) return null;
  if (value < MIN_STEPS || value > MAX_STEPS) return null;
  return value;
}

/**
 * Looks for a number near each "Steps" label occurrence in the OCR'd text —
 * real step-tracker screenshots almost always put the count right next to
 * that word, so anchoring on the label is far more reliable than scanning
 * the whole screen for "the longest number" (which can be fooled by an
 * unrelated number of similar or greater length, e.g. a calendar/date
 * artifact, a calorie total, or a distance reading).
 *
 * Candidates are ranked in tiers, favoring layout locality over raw
 * character distance (a naive "nearest char wins" approach can be fooled by
 * an unrelated number on the *previous* line being textually closer than
 * the real value one line below):
 *   1. same line as the label, in either direction — covers "Steps: 8,966"
 *      and "12,345 steps" layouts.
 *   2. the line immediately after the label's line — covers the common
 *      stacked "Steps\n8,966" layout (and "Steps\nDistance\n8,966", where
 *      an intervening same-line sibling label has no digits to match).
 * Within a tier, the textually closest candidate wins.
 */
function parseStepCountNearLabel(rawText: string): number | null {
  const labelRegex = new RegExp(STEPS_LABEL.source, STEPS_LABEL.flags);
  const numberToken = new RegExp(NUMBER_TOKEN_SOURCE, "g");
  let match: RegExpExecArray | null;
  const candidates: { value: number; tier: number; distance: number }[] = [];

  const collectForward = (segment: string, tier: number, baseOffset: number) => {
    numberToken.lastIndex = 0;
    let tokenMatch: RegExpExecArray | null;
    while ((tokenMatch = numberToken.exec(segment)) !== null) {
      const value = toStepValue(tokenMatch[0]);
      if (value !== null) candidates.push({ value, tier, distance: baseOffset + tokenMatch.index });
    }
  };

  const collectBackward = (segment: string, tier: number) => {
    numberToken.lastIndex = 0;
    let tokenMatch: RegExpExecArray | null;
    while ((tokenMatch = numberToken.exec(segment)) !== null) {
      const value = toStepValue(tokenMatch[0]);
      if (value !== null) {
        candidates.push({ value, tier, distance: segment.length - (tokenMatch.index + tokenMatch[0].length) });
      }
    }
  };

  while ((match = labelRegex.exec(rawText)) !== null) {
    const labelStart = match.index;
    const labelEnd = labelStart + match[0].length;

    // Forward: same line, then the next line.
    const after = rawText.slice(labelEnd, labelEnd + 200);
    const afterNewline = after.indexOf("\n");
    const sameLineAfter = afterNewline === -1 ? after : after.slice(0, afterNewline);
    collectForward(sameLineAfter, 0, 0);
    if (afterNewline !== -1) {
      const rest = after.slice(afterNewline + 1);
      const restNewline = rest.indexOf("\n");
      const nextLineAfter = restNewline === -1 ? rest : rest.slice(0, restNewline);
      collectForward(nextLineAfter, 1, afterNewline + 1);
    }

    // Backward: same line only — a preceding line is too likely to belong
    // to an unrelated stat (e.g. "TOTAL 2,070 KCAL" directly above "Steps").
    const before = rawText.slice(Math.max(0, labelStart - 80), labelStart);
    const beforeNewline = before.lastIndexOf("\n");
    const sameLineBefore = beforeNewline === -1 ? before : before.slice(beforeNewline + 1);
    collectBackward(sameLineBefore, 0);
  }

  if (candidates.length === 0) return null;
  const best = candidates.reduce((a, b) =>
    b.tier < a.tier || (b.tier === a.tier && b.distance < a.distance) ? b : a
  );
  return best.value;
}

/**
 * Parses OCR'd text for a step count.
 *
 * Primary strategy: look for a number right next to a "Steps" label (see
 * `parseStepCountNearLabel`) — real step-tracker screenshots almost always
 * have one, and anchoring on it avoids misreading an unrelated number.
 *
 * Fallback (no "Steps" label found, or no valid number near it): strip
 * thousands-separator commas *within* number tokens only — deliberately
 * NOT whitespace — then take the longest contiguous digit run left. Only
 * stripping commas (not spaces/newlines) matters: on a real screenshot,
 * genuinely separate on-screen numbers (a time, a date, a calorie total)
 * are usually whitespace-separated in the OCR output, and merging them
 * together by stripping that whitespace can produce a spurious longer
 * "number" that beats the real step count — exactly the bug this guards
 * against.
 *
 * Returns null if no digit sequence is found, or if the detected number
 * falls outside the plausible 0–100,000 daily step range (guards against
 * misreads like a 6-digit phone-status-bar time or a stray long number).
 */
export function parseStepCount(rawText: string): number | null {
  const nearLabel = parseStepCountNearLabel(rawText);
  if (nearLabel !== null) return nearLabel;

  const cleaned = rawText.replace(/,/g, "");
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
