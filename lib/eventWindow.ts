import { EVENT_END_DATE, EVENT_START_DATE } from "./constants";
import { formatShortDate } from "./week";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type EntryDateCheck = { ok: true } | { ok: false; error: string };

/**
 * Validates a user-selected entry date against the fixed event window
 * (Oct 13–19, 2026) and the "no future dates" rule. `today` is passed in
 * (rather than computed here) so this stays a pure, easily unit-testable
 * function — the caller supplies `todayISODate()` for real requests.
 */
export function isValidEntryDate(isoDate: string, today: string): EntryDateCheck {
  if (!ISO_DATE_RE.test(isoDate)) {
    return { ok: false, error: "Invalid date." };
  }
  if (isoDate < EVENT_START_DATE || isoDate > EVENT_END_DATE) {
    return {
      ok: false,
      error: `Please pick a date within the event window (${formatShortDate(EVENT_START_DATE)}–${formatShortDate(EVENT_END_DATE)}).`,
    };
  }
  if (isoDate > today) {
    return { ok: false, error: "You can't upload a screenshot for a future date." };
  }
  return { ok: true };
}
