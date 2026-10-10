/**
 * Formats a number with en-US thousands separators regardless of the
 * viewer's browser locale — plain `toLocaleString()` without a locale arg
 * picks up the user's locale (e.g. en-IN renders "2,54,260" instead of
 * "254,260"), which looks like a bug on a shared company leaderboard where
 * everyone should see the same digit grouping.
 */
export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}
