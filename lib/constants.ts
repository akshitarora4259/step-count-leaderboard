/** Hardcoded fallback event window, used when env vars are unset/invalid. */
const DEFAULT_EVENT_START_DATE = "2026-10-13";
const DEFAULT_EVENT_END_DATE = "2026-10-19";

/** Matches a plain `YYYY-MM-DD` ISO date string (no time component). */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function resolveEventWindow(): { start: string; end: string } {
  const rawStart = process.env.NEXT_PUBLIC_EVENT_START_DATE;
  const rawEnd = process.env.NEXT_PUBLIC_EVENT_END_DATE;

  // Both unset is the common case (local dev, or a deployment that hasn't
  // configured these yet) — silently use the defaults, no warning needed.
  if (!rawStart && !rawEnd) {
    return { start: DEFAULT_EVENT_START_DATE, end: DEFAULT_EVENT_END_DATE };
  }

  const start = rawStart ?? DEFAULT_EVENT_START_DATE;
  const end = rawEnd ?? DEFAULT_EVENT_END_DATE;

  const isValid = ISO_DATE_PATTERN.test(start) && ISO_DATE_PATTERN.test(end) && start <= end;
  if (!isValid) {
    console.warn(
      `[constants] Ignoring invalid NEXT_PUBLIC_EVENT_START_DATE/NEXT_PUBLIC_EVENT_END_DATE ` +
        `("${rawStart}"/"${rawEnd}") — expected YYYY-MM-DD with start <= end. ` +
        `Falling back to defaults (${DEFAULT_EVENT_START_DATE}–${DEFAULT_EVENT_END_DATE}).`
    );
    return { start: DEFAULT_EVENT_START_DATE, end: DEFAULT_EVENT_END_DATE };
  }

  return { start, end };
}

const resolvedEventWindow = resolveEventWindow();

/**
 * The Step Challenge's fixed event window (inclusive), sourced from
 * `NEXT_PUBLIC_EVENT_START_DATE`/`NEXT_PUBLIC_EVENT_END_DATE` when set and
 * valid, falling back to a hardcoded default (Mon Oct 13 – Sun Oct 19, 2026)
 * otherwise. `NEXT_PUBLIC_` env vars are inlined by Next.js at build time,
 * so these are available in both server code and client components.
 *
 * Screenshot uploads are only accepted for dates in this range (see
 * lib/eventWindow.ts), and it's also what the leaderboard/profile display
 * and aggregation use (see lib/week.ts's `getEventWeekRange`) — this is a
 * one-off window for this specific event, deliberately separate from
 * lib/week.ts's generic "current week" math (`getWeekRange`), which
 * computes an arbitrary Mon–Sun range for any reference date and is kept
 * around for any future feature that needs genuine calendar-week math.
 */
export const EVENT_START_DATE = resolvedEventWindow.start;
export const EVENT_END_DATE = resolvedEventWindow.end;
