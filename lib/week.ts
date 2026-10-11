/**
 * Small date-math utilities for computing the "current week" (Mon–Sun) window.
 * Written as a standalone module so a future "week selector" feature can reuse
 * `getWeekRange` for arbitrary dates instead of only "today".
 */

export type WeekRange = {
  /** Monday 00:00:00 of the week, inclusive. */
  start: Date;
  /** Sunday 23:59:59.999 of the week, inclusive. */
  end: Date;
  /** ISO date string (YYYY-MM-DD) for the Monday. */
  startDate: string;
  /** ISO date string (YYYY-MM-DD) for the Sunday. */
  endDate: string;
};

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns the Monday–Sunday range containing `reference` (defaults to now),
 * using the local timezone of wherever this runs.
 */
export function getWeekRange(reference: Date = new Date()): WeekRange {
  const ref = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const day = ref.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  // Days to subtract to get back to Monday. Sunday (0) -> 6 days back.
  const diffToMonday = day === 0 ? 6 : day - 1;

  const start = new Date(ref);
  start.setDate(ref.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    start,
    end,
    startDate: toISODate(start),
    endDate: toISODate(end),
  };
}

/** Convenience helper: today's date as an ISO string (YYYY-MM-DD), local time. */
export function todayISODate(): string {
  return toISODate(new Date());
}

/** True if the given ISO date string (YYYY-MM-DD) falls within the current week. */
export function isWithinCurrentWeek(isoDate: string): boolean {
  const { startDate, endDate } = getWeekRange();
  return isoDate >= startDate && isoDate <= endDate;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function ordinal(day: number): string {
  if (day % 10 === 1 && day !== 11) return `${day}st`;
  if (day % 10 === 2 && day !== 12) return `${day}nd`;
  if (day % 10 === 3 && day !== 13) return `${day}rd`;
  return `${day}th`;
}

/** Formats a single ISO date (YYYY-MM-DD) as a short "Oct 14" style label. */
export function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${MONTH_LABELS[month - 1]} ${day}`;
}

/**
 * Formats a week range as the "13th - 19th Oct, 2026" style date pill text
 * used across the Home/Leaderboard headers. Handles the rare case of a week
 * spanning two months/years by naming both ends explicitly.
 */
export function formatWeekPill(range: WeekRange): string {
  const { start, end } = range;
  const startDay = ordinal(start.getDate());
  const endDay = ordinal(end.getDate());
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${startDay} - ${endDay} ${MONTH_LABELS[end.getMonth()]}, ${end.getFullYear()}`;
  }
  return `${startDay} ${MONTH_LABELS[start.getMonth()]} - ${endDay} ${MONTH_LABELS[end.getMonth()]}, ${end.getFullYear()}`;
}
