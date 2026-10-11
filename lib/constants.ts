/**
 * Shared event-wide constants that aren't derived from any data source.
 *
 * COMMUNITY_IMPACT_GOAL_USD is a placeholder fundraising/goal figure for the
 * leaderboard's "Community Impact Goal" stat card. There's no real donation
 * pipeline wired into this app (steps come from screenshot OCR, not a
 * payments provider), so this is a configurable constant rather than a
 * computed value — update it here if the real event goal changes.
 */
export const COMMUNITY_IMPACT_GOAL_USD = 50_000;

/**
 * The 2026 Step Challenge's fixed event window: Mon Oct 13 – Sun Oct 19,
 * 2026 (inclusive). Screenshot uploads are only accepted for dates in this
 * range (see lib/eventWindow.ts), and it's also what the leaderboard/profile
 * display and aggregation use (see lib/week.ts's `getEventWeekRange`) — this
 * is a hardcoded one-off window for this specific event, deliberately
 * separate from lib/week.ts's generic "current week" math (`getWeekRange`),
 * which computes an arbitrary Mon–Sun range for any reference date and is
 * kept around for any future feature that needs genuine calendar-week math.
 */
export const EVENT_START_DATE = "2026-10-13";
export const EVENT_END_DATE = "2026-10-19";
