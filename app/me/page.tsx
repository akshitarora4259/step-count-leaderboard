"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { clearStoredName, getStoredName } from "@/lib/clientName";
import { formatNumber } from "@/lib/format";
import { todayISODate } from "@/lib/week";
import type { ProfileResponse } from "@/app/api/profile/route";

type State =
  | { kind: "loading" }
  | { kind: "no_name" }
  | { kind: "not_connected"; name: string }
  | { kind: "connected"; name: string; isMock: boolean; profile: ProfileResponse };

export default function MePage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [disconnecting, setDisconnecting] = useState(false);

  const load = useCallback(async () => {
    const name = getStoredName();
    if (!name) {
      setState({ kind: "no_name" });
      return;
    }
    try {
      const [statusRes, profileRes] = await Promise.all([
        fetch(`/api/fitbit/status?name=${encodeURIComponent(name)}`),
        fetch(`/api/profile?name=${encodeURIComponent(name)}`),
      ]);
      const statusBody = await statusRes.json();
      if (!statusBody.connected) {
        setState({ kind: "not_connected", name });
        return;
      }
      const profile: ProfileResponse = await profileRes.json();
      setState({ kind: "connected", name, isMock: Boolean(statusBody.isMock), profile });
    } catch {
      setState({ kind: "not_connected", name });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDisconnect(name: string) {
    setDisconnecting(true);
    try {
      await fetch("/api/fitbit/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    } finally {
      clearStoredName();
      setDisconnecting(false);
      setState({ kind: "no_name" });
    }
  }

  if (state.kind === "loading") {
    return (
      <main className="connected-page page-container">
        <p className="empty-state">Loading…</p>
      </main>
    );
  }

  if (state.kind === "no_name" || state.kind === "not_connected") {
    return (
      <main className="connected-page page-container">
        <div className="empty-state">
          <p>
            {state.kind === "not_connected"
              ? `${state.name} isn't connected to Fitbit yet.`
              : "Connect your Fitbit to see your own stats, weekly chart, and achievement badges here."}
          </p>
          <Link href="/" className="primary-btn" style={{ display: "inline-block", marginTop: 16 }}>
            Connect Fitbit →
          </Link>
        </div>
      </main>
    );
  }

  const { name, isMock, profile } = state;
  const today = todayISODate();
  const todaysSteps = profile.daily.find((d) => d.date === today)?.steps ?? 0;

  return (
    <main className="connected-page page-container">
      <section className="connected-banner">
        <div>
          <strong>✓ Your Fitbit is connected{isMock ? " (demo)" : ""}!</strong>
          <p>Your steps are syncing automatically.</p>
        </div>
        <button
          type="button"
          className="disconnect-btn"
          onClick={() => handleDisconnect(name)}
          disabled={disconnecting}
        >
          {disconnecting ? "Disconnecting…" : "Disconnect"}
        </button>
      </section>

      <section className="personal-card">
        <div className="personal-header">
          <div className="illustrated-avatar large">🏃</div>
          <div>
            <h2>Good going, {name}!</h2>
            <p>Every step you take helps build a healthier you and a brighter tomorrow.</p>
          </div>
        </div>
        <div className="personal-stats">
          <article>
            <span>👣</span>
            <strong>{formatNumber(todaysSteps)}</strong>
            <small>Steps Today</small>
          </article>
          <article>
            <span>▥</span>
            <strong>{formatNumber(profile.totalSteps)}</strong>
            <small>This Week</small>
          </article>
          <article>
            <span>📅</span>
            <strong>{profile.daysLogged}/7</strong>
            <small>Days Completed</small>
          </article>
        </div>
      </section>

      <section className="impact-card">
        <h2>How Your Steps Create Impact</h2>
        <div className="impact-grid">
          <div>
            ♥<strong>Healthier People</strong>
          </div>
          <div>
            👥<strong>Stronger Communities</strong>
          </div>
          <div>
            🌱<strong>Brighter Futures</strong>
          </div>
        </div>
      </section>

      <section className="rewards-banner">
        <span className="reward-icon">🎁</span>
        <div>
          <h2>Exciting Goodies Await!</h2>
          <p>Stay active, make an impact, and win exclusive Microsoft merchandise and special surprises!</p>
        </div>
      </section>
    </main>
  );
}
