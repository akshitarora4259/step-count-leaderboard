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
  const visibleRows = showAll ? leaderboard : leaderboard.slice(0, VISIBLE_ROWS);

  // "72%"-style week-completion stat: reuses the already-computed average
  // days-logged-out-of-7 across participants from the leaderboard API.
  const completionPercent = stats?.completionPercent ?? 0;

  if (loading) {
    return (
      <section id="leaderboard" className="view active-view">
        <p className="empty-state">Loading leaderboard…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section id="leaderboard" className="view active-view">
        <div className="inline-banner error">{error}</div>
      </section>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <section id="leaderboard" className="view active-view">
        <div className="empty-state">
          <p>No entries yet this week. Be the first to connect and start syncing!</p>
          <Link href="/" className="muted-link">
            Connect Fitbit
          </Link>
        </div>
      </section>
    );
  }

  const silver = top3[1];
  const gold = top3[0];
  const bronze = top3[2];

  return (
    <section id="leaderboard" className="view active-view" aria-labelledby="leaderboard-title">
      <div className="page-heading">
        <div className="give-lockup compact">
          <div className="give-word">
            <b>G</b>
            <b>I</b>
            <b>V</b>
            <b>E</b>
          </div>
          <div className="script-title">Step Challenge</div>
        </div>
        <div className="date-stack">
          <p className="campaign-date">
            <span>📅</span> {datePill}
          </p>
          <small>Together for a healthier, kinder tomorrow.</small>
        </div>
        <p className="scribble">
          Small
          <br />
          Steps
          <br />
          Big Impact ♡
        </p>
      </div>

      <div className="summary-grid">
        <article>
          <span className="summary-icon blue-text">👥</span>
          <div>
            <strong>{formatNumber(stats?.participants ?? 0)}</strong>
            <small>Participants</small>
          </div>
        </article>
        <article>
          <span className="summary-icon blue-text">👣</span>
          <div>
            <strong>{formatCompactNumber(stats?.totalSteps ?? 0)}</strong>
            <small>Total Steps</small>
          </div>
        </article>
        <article>
          <span className="summary-icon red-text">♥</span>
          <div>
            {/* Placeholder fundraising goal — see lib/constants.ts. */}
            <strong>${formatNumber(COMMUNITY_IMPACT_GOAL_USD)}</strong>
            <small>Community Impact Goal</small>
          </div>
        </article>
        <article className="progress-wrap">
          <div className="progress-ring" style={{ "--pct": completionPercent } as React.CSSProperties}>
            <span>{completionPercent}%</span>
          </div>
        </article>
      </div>

      <div className="leaderboard-header">
        <div>
          <h1 id="leaderboard-title">Overall Leaderboard</h1>
          <p>Total steps from {datePill}</p>
        </div>
        <span className="period-pill">📅 This Week⌄</span>
      </div>

      {top3.length === 3 && (
        <section className="podium" aria-label="Top three participants">
          <article className="podium-card silver">
            <div className="generic-person" aria-hidden="true" />
            <span className="medal">2</span>
            <strong>{formatNumber(silver.totalSteps)}</strong>
            <small>steps</small>
          </article>
          <article className="podium-card gold">
            <div className="crown">♛</div>
            <div className="generic-person" aria-hidden="true" />
            <span className="medal">1</span>
            <strong>{formatNumber(gold.totalSteps)}</strong>
            <small>steps</small>
          </article>
          <article className="podium-card bronze">
            <div className="generic-person" aria-hidden="true" />
            <span className="medal">3</span>
            <strong>{formatNumber(bronze.totalSteps)}</strong>
            <small>steps</small>
          </article>
        </section>
      )}

      <section className="ranking-card" aria-label="Top ten overall leaderboard">
        <div className="ranking-head">
          <span>#</span>
          <span>Participant</span>
          <span>Steps</span>
          <span />
        </div>
        <div>
          {visibleRows.map((entry, i) => {
            const widthPct = leader
              ? Math.max(4, Math.round((entry.totalSteps / leader.totalSteps) * 100))
              : 0;
            return (
              <div className="ranking-row" key={entry.name}>
                <span>#{i + 1}</span>
                <span className="rank-person">
                  <span className="mini-avatar" />
                  {entry.name}
                </span>
                <span>{formatNumber(entry.totalSteps)}</span>
                <span className="step-bar">
                  <i style={{ "--w": `${widthPct}%` } as React.CSSProperties} />
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {leaderboard.length > VISIBLE_ROWS && (
        <button
          type="button"
          className="muted-link"
          style={{ display: "block", margin: "12px auto 0" }}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show top 10" : `View All (${leaderboard.length})`}
        </button>
      )}

      <blockquote>
        &ldquo;When we move together, we create change together.&rdquo;
        <small>— Microsoft Give</small>
        <span className="scribble">
          Good
          <br />
          People
          <br />
          Greater
          <br />
          Impact ♡
        </span>
      </blockquote>
    </section>
  );
}
