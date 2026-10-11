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
