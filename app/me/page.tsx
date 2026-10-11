"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatCompactNumber, formatNumber } from "@/lib/format";
import { todayISODate } from "@/lib/week";
import type { ProfileResponse } from "@/app/api/profile/route";
import { Icon } from "@/components/Icon";

type State =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "no_entries" }
  | { kind: "active"; profile: ProfileResponse };

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function shortDayDate(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTH_LABELS[month - 1]}`;
}

export default function MePage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    try {
      const authRes = await fetch("/api/auth/status");
      const authBody = await authRes.json();
      if (!authBody.user) {
        setState({ kind: "signed_out" });
        return;
      }
      const profileRes = await fetch("/api/profile");
      if (!profileRes.ok) {
        setState({ kind: "no_entries" });
        return;
      }
      const profile: ProfileResponse = await profileRes.json();
      setState({ kind: "active", profile });
    } catch {
      setState({ kind: "no_entries" });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === "loading") {
    return (
      <section id="connected" className="view active-view">
        <p className="empty-state">Loading…</p>
      </section>
    );
  }

  if (state.kind === "signed_out" || state.kind === "no_entries") {
    return (
      <section id="connected" className="view active-view">
        <div className="empty-state">
          <p>
            {state.kind === "no_entries"
              ? "You're signed in, but haven't uploaded a step screenshot yet this week."
              : "Sign in and upload your daily step screenshot to see your own stats and weekly chart here."}
          </p>
          <Link href="/" className="connect-button" style={{ display: "inline-block", marginTop: 16 }}>
            {state.kind === "no_entries" ? "Upload a Screenshot ›" : "Go to Sign In ›"}
          </Link>
        </div>
      </section>
    );
  }

  const { profile } = state;
  const { name } = profile;
  const today = todayISODate();
  const todaysSteps = profile.daily.find((d) => d.date === today)?.steps ?? 0;

  // Chart y-axis scale is real, not the reference's hardcoded 15K/10K/5K/0 —
  // ceil the week's highest day to the next 5K (minimum 5K) so bars/labels
  // stay proportionate to this participant's actual data.
  const maxDaily = Math.max(0, ...profile.daily.map((d) => d.steps));
  const chartMax = Math.max(5000, Math.ceil(maxDaily / 5000) * 5000);
  const yLabels = [chartMax, (chartMax * 2) / 3, chartMax / 3, 0];

  return (
    <section id="connected" className="view active-view" aria-labelledby="connected-title">
      <div className="page-heading connected-heading">
        <div className="give-lockup compact">
          <div className="give-word">
            <b>G</b>
            <b>I</b>
            <b>V</b>
            <b>E</b>
          </div>
          <div className="script-title">Step Challenge</div>
        </div>
        <p className="scribble">
          Healthier You
          <br />
          Brighter Tomorrows ♡
        </p>
      </div>

      <div className="connected-banner">
        <div className="success">
          <Icon name="check" className="white-filter" />
        </div>
        <div>
          <h1 id="connected-title">You&apos;re all set, {name}!</h1>
          <p>Upload a fresh screenshot each day to keep your streak going.</p>
        </div>
        <Link href="/" className="disconnect-button" style={{ textDecoration: "none", display: "inline-block" }}>
          Upload Today&apos;s Steps
        </Link>
      </div>

      <section className="profile-summary">
        <div className="profile-avatar">
          <img src="/images/give/avatar-05.webp" alt="" />
        </div>
        <div className="profile-copy">
          <h2>Good going, {name}!</h2>
          <p>Every step you take helps build a healthier you and a brighter tomorrow.</p>
        </div>
        <div className="metric-grid">
          <article>
            <span>
              <Icon name="footsteps" className="blue-filter" />
            </span>
            <strong>{formatNumber(todaysSteps)}</strong>
            <small>Steps Today</small>
          </article>
          <article>
            <span>
              <Icon name="chart" className="blue-filter" />
            </span>
            <strong>{formatNumber(profile.totalSteps)}</strong>
            <small>This Week</small>
          </article>
          <article>
            <span>
              <Icon name="calendar" className="navy-filter" />
            </span>
            <strong>{profile.daysLogged}/7</strong>
            <small>Days Completed</small>
          </article>
        </div>
      </section>

      <section className="weekly-card">
        <div className="card-heading">
          <h2>Your Steps This Week</h2>
          <span>
            {profile.rank ? (
              <>
                <Icon name="rank" className="blue-filter" />
                {`Rank #${profile.rank} of ${profile.participants}`}
              </>
            ) : (
              ""
            )}
          </span>
        </div>
        <div className="chart" aria-label="Weekly steps bar chart">
          <div className="y-labels">
            {yLabels.map((v, i) => (
              <span key={i}>{v === 0 ? "0" : formatCompactNumber(v)}</span>
            ))}
          </div>
          <div className="bars">
            {profile.daily.map((day, i) => {
              const heightPct = Math.max(2, Math.round((day.steps / chartMax) * 100));
              const isToday = day.date === today;
              return (
                <div key={day.date}>
                  <b>{day.steps > 0 ? formatCompactNumber(day.steps) : "\u00a0"}</b>
                  <i className={isToday ? "active-bar" : ""} style={{ "--h": `${heightPct}%` } as React.CSSProperties} />
                  <span>
                    {DAY_LABELS[i]}
                    <small>{shortDayDate(day.date)}</small>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="impact-banner">
        <span className="impact-heart">
          <Icon name="heart" className="red-filter" />
        </span>
        <div>
          <h2>Your Steps Create Real Impact</h2>
          <p>
            Together, we&apos;re moving closer to our goal of supporting education, nutrition and
            brighter futures for communities in need.
          </p>
        </div>
        <img className="impact-art" src="/images/give/connected-impact-vignette.webp" alt="" />
      </section>

      <section className="rewards-section">
        <div className="reward-copy">
          <span className="gift">
            <Icon name="gift" className="yellow-filter" />
          </span>
          <div>
            <h2>Exciting Goodies Await!</h2>
            <p>
              Stay active, move up the leaderboard, and win exclusive Microsoft merchandise and
              special surprises!
            </p>
          </div>
        </div>
        <div className="reward-icons">
          <div>
            <span>
              <Icon name="bag" className="blue-filter" />
            </span>
            <small>
              Microsoft
              <br />
              Merchandise
            </small>
          </div>
          <div>
            <span>
              <Icon name="sparkles" className="yellow-filter" />
            </span>
            <small>
              Special
              <br />
              Surprises
            </small>
          </div>
        </div>
        <p className="scribble">
          Move
          <br />
          Give
          <br />
          Inspire
          <br />
          Together ♡
        </p>
      </section>
    </section>
  );
}
