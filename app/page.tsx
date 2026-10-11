"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getWeekRange, formatWeekPill } from "@/lib/week";
import { setStoredName, clearStoredName, getStoredName } from "@/lib/clientName";
import { notify } from "@/lib/toastBus";
import { Icon } from "@/components/Icon";

type Status =
  | { kind: "unknown" }
  | { kind: "checking" }
  | { kind: "not_connected" }
  | { kind: "connected"; isMock: boolean };

type AuthState =
  | { kind: "loading" }
  | { kind: "signed_out"; mockMode: boolean }
  | { kind: "signed_in"; email: string; mockMode: boolean };

const HOW_IT_WORKS = [
  {
    number: "1",
    badgeClass: "blue",
    icon: "fitbit",
    iconClass: "blue-filter",
    title: "Connect",
    description: "Link your Fitbit account in seconds. No manual entries, no screenshots.",
  },
  {
    number: "2",
    badgeClass: "green",
    icon: "sync",
    iconClass: "green-filter",
    title: "Sync",
    description: "Your steps sync automatically each day. You're always up to date.",
  },
  {
    number: "3",
    badgeClass: "yellow",
    icon: "crown",
    iconClass: "yellow-filter",
    title: "Climb the Leaderboard",
    description: "See how you're doing and stay motivated with exciting goodies.",
  },
] as const;

/**
 * Email-OTP login gate. Must be verified before the name + Connect Fitbit
 * UI is shown — this is what makes `user_id` (not a self-reported name) the
 * real identity behind every Fitbit connect/disconnect/sync action.
 *
 * In mock mode (no Supabase project configured), there's no real email
 * delivery — "Continue (demo mode)" logs the typed email in immediately,
 * mirroring the existing Fitbit mock-connect pattern for local dev.
 */
function AuthGate({ auth, onSignedIn }: { auth: AuthState; onSignedIn: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSendCode() {
    const trimmed = email.trim();
    if (!trimmed) {
      notify("Please enter your email first.");
      return;
    }
    if (auth.kind === "signed_out" && auth.mockMode) {
      // Mock mode: skip the real OTP round trip entirely.
      await verify(trimmed, "000000");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const body = await res.json();
      if (res.ok) {
        setCodeSent(true);
        notify("Code sent! Check your email.");
      } else {
        notify(body.error ?? "Failed to send code.");
      }
    } catch {
      notify("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verify(trimmedEmail: string, trimmedCode: string) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, code: trimmedCode }),
      });
      const body = await res.json();
      if (res.ok) {
        onSignedIn(trimmedEmail);
      } else {
        notify(body.error ?? "Invalid or expired code.");
      }
    } catch {
      notify("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleVerify() {
    const trimmed = code.trim();
    if (!trimmed) {
      notify("Please enter the code we sent you.");
      return;
    }
    verify(email.trim(), trimmed);
  }

  const isMock = auth.kind === "signed_out" && auth.mockMode;

  return (
    <div className="connect-form">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Work email"
        aria-label="Work email"
        disabled={codeSent}
      />
      {!isMock && codeSent && (
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="6-digit code"
          aria-label="Verification code"
        />
      )}
      {!codeSent || isMock ? (
        <button type="button" className="connect-button" onClick={handleSendCode} disabled={submitting}>
          {submitting ? "Please wait…" : isMock ? "Continue (demo mode)" : "Send code"}
        </button>
      ) : (
        <button type="button" className="connect-button" onClick={handleVerify} disabled={submitting}>
          {submitting ? "Verifying…" : "Verify"}
        </button>
      )}
    </div>
  );
}

function Home() {
  const searchParams = useSearchParams();
  const weekRange = useMemo(() => getWeekRange(), []);
  const datePill = useMemo(() => formatWeekPill(weekRange), [weekRange]);

  const [auth, setAuth] = useState<AuthState>({ kind: "loading" });
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "unknown" });
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const checkStatus = useCallback(async () => {
    setStatus({ kind: "checking" });
    try {
      const res = await fetch("/api/fitbit/status");
      const body = await res.json();
      if (body.connected) {
        setStatus({ kind: "connected", isMock: Boolean(body.isMock) });
        if (body.name) setStoredName(body.name);
      } else {
        setStatus({ kind: "not_connected" });
      }
    } catch {
      setStatus({ kind: "not_connected" });
    }
  }, []);

  const loadAuthStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/status");
      const body = await res.json();
      if (body.user) {
        setAuth({ kind: "signed_in", email: body.user.email, mockMode: Boolean(body.mockMode) });
      } else {
        setAuth({ kind: "signed_out", mockMode: Boolean(body.mockMode) });
      }
    } catch {
      setAuth({ kind: "signed_out", mockMode: false });
    }
  }, []);

  useEffect(() => {
    loadAuthStatus();

    const stored = getStoredName();
    if (stored) setName(stored);

    const paramName = searchParams.get("name");
    const connected = searchParams.get("connected");
    const mock = searchParams.get("mock");
    const err = searchParams.get("fitbit_error");
    const warning = searchParams.get("fitbit_warning");

    if (paramName) setName(paramName);
    if (connected === "1") {
      notify(
        warning ??
          (mock === "1"
            ? "Fitbit connected (demo mode) — sample step data generated for this week."
            : "Connected to Fitbit! Your steps will sync automatically.")
      );
    } else if (err) {
      notify(`Fitbit connection failed: ${err}`);
    }
    // Only run once, on mount — this reads the redirect params/stored name, not live state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (auth.kind === "signed_in") {
      checkStatus();
    }
  }, [auth.kind, checkStatus]);

  function handleConnect() {
    const trimmed = name.trim();
    if (!trimmed) {
      notify("Please enter your name first.");
      return;
    }
    const params = new URLSearchParams({ name: trimmed });
    window.location.href = `/api/fitbit/connect?${params.toString()}`;
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/fitbit/disconnect", { method: "POST" });
      const body = await res.json();
      if (res.ok) {
        setStatus({ kind: "not_connected" });
        clearStoredName();
        notify("Disconnected — your synced step data has been removed.");
      } else {
        notify(body.error ?? "Failed to disconnect.");
      }
    } catch {
      notify("Network error — please try again.");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    try {
      const res = await fetch("/api/fitbit/sync?self=1");
      const body = await res.json();
      if (res.ok) {
        notify("Synced! Check the leaderboard for your latest steps.");
      } else {
        const message = body.synced?.[0]?.error ?? body.error ?? "Sync failed.";
        notify(message);
      }
    } catch {
      notify("Network error — please try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSignOut() {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      // Ignore — we still clear local UI state below either way.
    }
    clearStoredName();
    setStatus({ kind: "unknown" });
    setName("");
    loadAuthStatus();
  }

  const isConnected = status.kind === "connected";
  const isSignedIn = auth.kind === "signed_in";

  return (
    <section id="home" className="view active-view" aria-labelledby="home-title">
      <div className="home-scene">
        <div className="hero-shade" aria-hidden="true" />
        <p className="eyebrow">PEOPLE • PURPOSE • A BRIGHTER TOMORROW</p>
        <div className="hero-copy">
          <div className="give-lockup" aria-label="Give Step Challenge">
            <div className="give-word">
              <b>G</b>
              <b>I</b>
              <b>V</b>
              <b>E</b>
            </div>
            <div className="script-title">Step Challenge</div>
          </div>
          <h1 id="home-title">
            Every Step Is a <span>Give</span>
          </h1>
          <p className="lead">Walk for your health. Give for a better tomorrow.</p>
          <p className="campaign-date">
            <Icon name="calendar" className="navy-filter" /> {datePill}
          </p>
          <p className="intro">
            Connect your Fitbit, move together with your Microsoft community, and help create a
            healthier, kinder world. Every step you take contributes to real impact.
          </p>

          {auth.kind === "loading" ? null : !isSignedIn ? (
            <AuthGate auth={auth} onSignedIn={() => loadAuthStatus()} />
          ) : (
            <>
              <p className="privacy" style={{ marginBottom: 4 }}>
                Signed in as <strong>{auth.email}</strong>{" "}
                <button
                  type="button"
                  onClick={handleSignOut}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--blue, #2b6cb0)",
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: 0,
                    font: "inherit",
                  }}
                >
                  Sign out
                </button>
              </p>

              {!isConnected && (
                <div className="connect-form">
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    aria-label="Your name"
                  />
                </div>
              )}

              {isConnected ? (
                <div className="connect-form">
                  <button
                    type="button"
                    className="connect-button"
                    onClick={handleSyncNow}
                    disabled={syncing}
                  >
                    <Icon name="fitbit" className="fitbit-dots white-filter" />{" "}
                    {syncing ? "Syncing…" : "Sync Now"} <Icon name="sync" className="white-filter" />
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                  >
                    {disconnecting ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
              ) : (
                <button
                  id="connectButton"
                  type="button"
                  className="connect-button"
                  onClick={handleConnect}
                >
                  <Icon name="fitbit" className="fitbit-dots white-filter" />{" "}
                  {status.kind === "checking" ? "Checking…" : "Connect Fitbit"} <span>›</span>
                </button>
              )}
            </>
          )}

          <p className="privacy">
            <Icon name="lock" className="muted-filter" /> Secure. Private. You&apos;re in control.
          </p>
        </div>
        <p className="scribble home-scribble">
          Healthier
          <br />
          People
          <br />
          Stronger
          <br />
          Communities ♡
        </p>
        <img
          className="walkers"
          src="/images/give/home-walking-group.webp"
          alt="Illustrated colleagues walking together"
        />
        <img className="giving" src="/images/give/home-giving-vignette.webp" alt="Community giving illustration" />
      </div>

      <section className="how-section" aria-labelledby="how-title">
        <h2 id="how-title">How it works</h2>
        <p>Get started in 3 simple steps</p>
        <div className="step-grid">
          {HOW_IT_WORKS.map((step) => (
            <article className="step-card" key={step.title}>
              <span className={`step-no ${step.badgeClass}`}>{step.number}</span>
              <Icon name={step.icon} className={`step-icon ${step.iconClass}`} />
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
        <div className="goodies-strip">
          <Icon name="gift" className="gift yellow-filter" />
          <div>
            <strong>Exciting Goodies Await!</strong>
            <p>
              Stay active, make an impact, and win exclusive Microsoft merchandise and special
              surprises!
            </p>
          </div>
          <span className="scribble mini">
            Move
            <br />
            Give
            <br />
            Inspire
            <br />
            Together ♡
          </span>
        </div>
      </section>
    </section>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  );
}
