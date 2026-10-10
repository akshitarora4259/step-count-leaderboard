"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LeaderboardEntry, LeaderboardStats } from "@/app/api/leaderboard/route";
import { formatCompactNumber, formatNumber } from "@/lib/format";
import { formatWeekPill, getWeekRange } from "@/lib/week";
import { COMMUNITY_IMPACT_GOAL_USD } from "@/lib/constants";

const POLL_INTERVAL_MS = 30_000;
const VISIBLE_ROWS = 10;

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<LeaderboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const weekRange = useMemo(() => getWeekRange(), []);
  const datePill = useMemo(() => formatWeekPill(weekRange), [weekRange]);

  async function fetchLeaderboard() {
    try {
      const res = await fetch("/api/leaderboard", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to load leaderboard.");
        return;
      }
      setLeaderboard(body.leaderboard);
      setStats(body.stats ?? null);
      setError(null);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const leader = leaderboard[0];
  const top3 = leaderboard.slice(0, 3);
  // Podium visual order is second / first / third, per the design spec.
  const podiumOrder = [top3[1], top3[0], top3[2]];
  const visibleRows = showAll ? leaderboard : leaderboard.slice(0, VISIBLE_ROWS);

  // "72%"-style week-completion stat: reuses the already-computed average
  // days-logged-out-of-7 across participants from the leaderboard API.
  const completionPercent = stats?.completionPercent ?? 0;

  if (loading) {
    return (
      <main className="leaderboard-page page-container">
        <p className="empty-state">Loading leaderboard…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="leaderboard-page page-container">
        <div className="inline-banner error">{error}</div>
      </main>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <main className="leaderboard-page page-container">
        <div className="empty-state">
          <p>No entries yet this week. Be the first to connect and start syncing!</p>
          <Link href="/" className="muted-link">
            Connect Fitbit
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="leaderboard-page page-container">
      <section className="leaderboard-heading">
        <div>
          <div className="give-logo small">
            <strong>GIVE</strong>
            <span>Step Challenge</span>
          </div>
          <div className="date-pill">📅 {datePill}</div>
        </div>
        <span className="handwritten">
          Small Steps
          <br />
          Big Impact ♡
        </span>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <span>👥</span>
          <strong>{formatNumber(stats?.participants ?? 0)}</strong>
          <small>Participants</small>
        </article>
        <article className="stat-card">
          <span>👣</span>
          <strong>{formatCompactNumber(stats?.totalSteps ?? 0)}</strong>
          <small>Total Steps</small>
        </article>
        <article className="stat-card">
          <span>♥</span>
          {/* Placeholder fundraising goal — see lib/constants.ts. */}
          <strong>${formatNumber(COMMUNITY_IMPACT_GOAL_USD)}</strong>
          <small>Community Impact Goal</small>
        </article>
        <article className="stat-card">
          <strong className="progress-circle" style={{ "--pct": completionPercent } as React.CSSProperties}>
            {completionPercent}%
          </strong>
        </article>
      </section>

      <section className="leaderboard-card">
        <div className="section-heading">
          <div>
            <h1>Overall Leaderboard</h1>
            <p>Total steps from {datePill}</p>
          </div>
        </div>

        {top3.length === 3 && (
          <div className="podium">
            {podiumOrder.map((entry, i) => {
              const rank = i === 1 ? 1 : i === 0 ? 2 : 3;
              const positionClass = rank === 1 ? "first" : rank === 2 ? "second" : "third";
              return (
                <article className={`podium-item ${positionClass}`} key={entry.name}>
                  <div className="illustrated-avatar">🏃</div>
                  <span className="rank">{rank}</span>
                  <strong>{formatNumber(entry.totalSteps)}</strong>
                  <small>steps</small>
                </article>
              );
            })}
          </div>
        )}

        <div className="rankings">
          {visibleRows.map((entry, i) => {
            const progress = leader ? Math.max(4, Math.round((entry.totalSteps / leader.totalSteps) * 100)) : 0;
            return (
              <div className="ranking-row" key={entry.name}>
                <span className="rank-num">#{i + 1}</span>
                <div className="avatar-placeholder" />
                <strong>{entry.name}</strong>
                <span className="steps">{formatNumber(entry.totalSteps)}</span>
                <div className="bar" style={{ "--progress": `${progress}%` } as React.CSSProperties} />
              </div>
            );
          })}
        </div>

        {leaderboard.length > VISIBLE_ROWS && (
          <button type="button" className="view-all-link" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show top 10" : `View All (${leaderboard.length})`}
          </button>
        )}
      </section>

      <blockquote>
        &ldquo;When we move together, we create change together.&rdquo;
        <small>Microsoft Give</small>
      </blockquote>
    </main>
  );
}
