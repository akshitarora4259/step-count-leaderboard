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

function toISODate(date: Date): string {
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
