"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getWeekRange, formatWeekPill } from "@/lib/week";
import { setStoredName, clearStoredName, getStoredName } from "@/lib/clientName";

type Status =
  | { kind: "unknown" }
  | { kind: "checking" }
  | { kind: "not_connected" }
  | { kind: "connected"; isMock: boolean };

type Banner = { kind: "success" | "error"; message: string };

const HOW_IT_WORKS = [
  {
    number: "1",
    badgeClass: "blue-bg",
    icon: "🔗",
    title: "Connect",
    description: "Link your Fitbit account in seconds. No manual entries, no screenshots.",
  },
  {
    number: "2",
    badgeClass: "green-bg",
    icon: "↻",
    title: "Sync",
    description: "Your steps sync automatically each day. You're always up to date.",
  },
  {
    number: "3",
    badgeClass: "yellow-bg",
    icon: "🏆",
    title: "Climb",
    description: "See how you're doing on the leaderboard and keep creating impact.",
  },
];

function Home() {
  const searchParams = useSearchParams();
  const weekRange = useMemo(() => getWeekRange(), []);
  const datePill = useMemo(() => formatWeekPill(weekRange), [weekRange]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "unknown" });
  const [banner, setBanner] = useState<Banner | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const checkStatus = useCallback(async (candidate: string) => {
    const trimmed = candidate.trim();
    if (!trimmed) {
      setStatus({ kind: "unknown" });
      return;
    }
    setStatus({ kind: "checking" });
    try {
      const res = await fetch(`/api/fitbit/status?name=${encodeURIComponent(trimmed)}`);
      const body = await res.json();
      if (body.connected) {
        setStatus({ kind: "connected", isMock: Boolean(body.isMock) });
        setStoredName(trimmed);
      } else {
        setStatus({ kind: "not_connected" });
      }
    } catch {
      setStatus({ kind: "not_connected" });
    }
  }, []);

  useEffect(() => {
    const stored = getStoredName();
    if (stored) {
      setName(stored);
      checkStatus(stored);
    }

    const paramName = searchParams.get("name");
    const connected = searchParams.get("connected");
    const mock = searchParams.get("mock");
    const err = searchParams.get("fitbit_error");

    if (paramName) {
      setName(paramName);
      checkStatus(paramName);
    }
    if (connected === "1" && paramName) {
      setStoredName(paramName);
    }
    if (connected === "1") {
      setBanner({
        kind: "success",
        message:
          mock === "1"
            ? "Connected (demo mode) — sample step data has been generated for this week."
            : "Connected to Fitbit! Your steps will sync automatically.",
      });
    } else if (err) {
      setBanner({ kind: "error", message: `Fitbit connection failed: ${err}` });
    }
    // Only run once, on mount — this reads the redirect params/stored name, not live state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleConnect() {
    const trimmed = name.trim();
    if (!trimmed) {
      setBanner({ kind: "error", message: "Please enter your name first." });
      return;
    }
    const params = new URLSearchParams({ name: trimmed });
    if (email.trim()) params.set("email", email.trim());
    window.location.href = `/api/fitbit/connect?${params.toString()}`;
  }

  async function handleDisconnect() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setDisconnecting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/fitbit/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = await res.json();
      if (res.ok) {
        setStatus({ kind: "not_connected" });
        clearStoredName();
        setBanner({ kind: "success", message: "Disconnected — your synced step data has been removed." });
      } else {
        setBanner({ kind: "error", message: body.error ?? "Failed to disconnect." });
      }
    } catch {
      setBanner({ kind: "error", message: "Network error — please try again." });
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSyncNow() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSyncing(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/fitbit/sync?name=${encodeURIComponent(trimmed)}`);
      const body = await res.json();
      if (res.ok) {
        setBanner({ kind: "success", message: "Synced! Check the leaderboard for your latest steps." });
      } else {
        const message = body.synced?.[0]?.error ?? body.error ?? "Sync failed.";
        setBanner({ kind: "error", message });
      }
    } catch {
      setBanner({ kind: "error", message: "Network error — please try again." });
    } finally {
      setSyncing(false);
    }
  }

  const isConnected = status.kind === "connected";

  return (
    <>
      <section className="hero page-container">
        <div className="give-logo">
          <div className="give">
            <span className="red">G</span>
            <span className="green">I</span>
            <span className="blue">V</span>
            <span className="yellow">E</span>
          </div>
          <div className="challenge">Step Challenge</div>
        </div>
        <h1>
          Every Step Is a <span>Give</span>
        </h1>
        <h2>Walk for your health. Give for a better tomorrow.</h2>
        <div className="date-pill">📅 {datePill}</div>
        <p className="hero-description">
          Connect your Fitbit, move together with your Microsoft community, and help us create a
          healthier, kinder world. Every step you take contributes to real impact.
        </p>

        {banner && (
          <div className={`inline-banner ${banner.kind}`}>{banner.message}</div>
        )}

        {!isConnected && (
          <div className="connect-form">
            <input
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={(e) => checkStatus(e.target.value)}
              placeholder="Your name"
              aria-label="Your name"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (optional)"
              aria-label="Email (optional)"
            />
          </div>
        )}

        {isConnected ? (
          <div className="connect-form">
            <button type="button" className="primary-btn" onClick={handleSyncNow} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync Now ↻"}
            </button>
            <button type="button" className="secondary-btn" onClick={handleDisconnect} disabled={disconnecting}>
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        ) : (
          <button type="button" className="primary-btn" onClick={handleConnect}>
            {status.kind === "checking" ? "Checking…" : "Connect Fitbit →"}
          </button>
        )}

        <div className="privacy">🔒 Secure. Private. You&apos;re in control.</div>
        <p className="privacy">No wearable? Your phone works too.</p>
      </section>

      <section className="how-it-works page-container">
        <h2>How it works</h2>
        <p>Get started in 3 simple steps</p>
        <div className="steps-grid">
          {HOW_IT_WORKS.map((step) => (
            <article className="step-card" key={step.title}>
              <span className={`step-number ${step.badgeClass}`}>{step.number}</span>
              <div className="step-icon">{step.icon}</div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rewards-banner page-container">
        <div className="reward-icon">🎁</div>
        <div>
          <h3>Exciting Goodies Await!</h3>
          <p>Stay active, make an impact, and win exclusive Microsoft merchandise and special surprises!</p>
        </div>
      </section>
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  );
}
