"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getEventWeekRange, formatWeekPill, formatShortDate, todayISODate } from "@/lib/week";
import { EVENT_START_DATE, EVENT_END_DATE } from "@/lib/constants";
import { setStoredName, clearStoredName, getStoredName } from "@/lib/clientName";
import { notify } from "@/lib/toastBus";
import { Icon } from "@/components/Icon";

type AuthState =
  | { kind: "loading" }
  | { kind: "signed_out"; mockMode: boolean }
  | { kind: "signed_in"; email: string; mockMode: boolean };

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "success"; steps: number }
  | { kind: "error"; message: string };

const HOW_IT_WORKS = [
  {
    number: "1",
    badgeClass: "blue",
    icon: "lock",
    iconClass: "blue-filter",
    title: "Sign In",
    description: "Verify your work email with a one-time code. No passwords to remember.",
  },
  {
    number: "2",
    badgeClass: "green",
    icon: "camera",
    iconClass: "green-filter",
    title: "Snap & Upload",
    description: "Screenshot your phone's step counter and upload it. We read the number for you.",
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
 * Email-OTP login gate. Must be verified before the name + screenshot
 * upload UI is shown — this is what makes `user_id` (not a self-reported
 * name) the real identity behind every submission.
 *
 * In mock mode (no Supabase project configured), there's no real email
 * delivery — "Continue (demo mode)" logs the typed email in immediately.
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
        body: JSON.stringify({ email: trimmedEmail, token: trimmedCode }),
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
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Verification code"
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
  const weekRange = useMemo(() => getEventWeekRange(), []);
  const datePill = useMemo(() => formatWeekPill(weekRange), [weekRange]);
  const today = useMemo(() => todayISODate(), []);

  // The date picker is clamped to the fixed event window (Oct 13–19, 2026)
  // AND can never go past today — someone can backfill a missed day, but
  // never upload for a date that hasn't happened yet.
  const pickerMin = EVENT_START_DATE;
  const pickerMax = today < EVENT_END_DATE ? today : EVENT_END_DATE;
  const eventNotStarted = pickerMax < pickerMin;
  const defaultDate = eventNotStarted ? pickerMin : pickerMax;

  const [auth, setAuth] = useState<AuthState>({ kind: "loading" });
  const [name, setName] = useState("");
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [dailyMap, setDailyMap] = useState<Record<string, number>>({});
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [upload, setUpload] = useState<UploadState>({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const recordedStepsForSelectedDate = dailyMap[selectedDate] > 0 ? dailyMap[selectedDate] : null;

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

  const loadDailyStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      if (!res.ok) {
        setDailyMap({});
        return;
      }
      const body = await res.json();
      if (body.name) setName((current) => current || body.name);
      const map: Record<string, number> = {};
      for (const entry of body.daily ?? []) {
        map[entry.date] = entry.steps;
      }
      setDailyMap(map);
    } catch {
      setDailyMap({});
    }
  }, []);

  useEffect(() => {
    loadAuthStatus();
    const stored = getStoredName();
    if (stored) setName(stored);
  }, [loadAuthStatus]);

  useEffect(() => {
    if (auth.kind === "signed_in") {
      loadDailyStatus();
    }
  }, [auth.kind, loadDailyStatus]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(selected: File | null) {
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      notify("Please choose an image file.");
      return;
    }
    setFile(selected);
    setUpload({ kind: "idle" });
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    pickFile(dropped ?? null);
  }

  async function handleSignOut() {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      // Ignore — we still clear local UI state below either way.
    }
    clearStoredName();
    setName("");
    setFile(null);
    setDailyMap({});
    setUpload({ kind: "idle" });
    loadAuthStatus();
  }

  async function handleUpload() {
    const trimmed = name.trim();
    if (!trimmed) {
      notify("Please enter your name first.");
      return;
    }
    if (!file) {
      notify("Please choose a screenshot to upload.");
      return;
    }
    setStoredName(trimmed);
    setUpload({ kind: "uploading" });
    try {
      const formData = new FormData();
      formData.set("name", trimmed);
      formData.set("entryDate", selectedDate);
      formData.set("screenshot", file);
      const res = await fetch("/api/steps/upload", { method: "POST", body: formData });
      const body = await res.json();
      if (res.ok) {
        setUpload({ kind: "success", steps: body.steps });
        setDailyMap((current) => ({ ...current, [selectedDate]: body.steps }));
        // Reset the file/preview (but keep the selected date and signed-in
        // state) so the user can immediately pick another date and upload
        // the next day's screenshot without reloading the page.
        setFile(null);
        notify(`Detected ${body.steps.toLocaleString()} steps — recorded for ${formatShortDate(selectedDate)}!`);
      } else {
        setUpload({ kind: "error", message: body.error ?? "Upload failed." });
      }
    } catch {
      setUpload({ kind: "error", message: "Network error — please try again." });
    }
  }

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
            Snap a screenshot of your phone&apos;s step count each day, upload it here, and help
            your Microsoft community create a healthier, kinder world. Every step you take
            contributes to real impact.
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

              {eventNotStarted ? (
                <p className="privacy" style={{ color: "var(--red, #c53030)" }}>
                  The Step Challenge starts {formatShortDate(EVENT_START_DATE)}, 2026 — come back then to
                  upload your first screenshot!
                </p>
              ) : (
                <div className="connect-form">
                  <label htmlFor="entry-date" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                    Which day is this screenshot for?
                  </label>
                  <input
                    id="entry-date"
                    type="date"
                    required
                    min={pickerMin}
                    max={pickerMax}
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setUpload({ kind: "idle" });
                    }}
                    aria-label="Entry date"
                  />
                </div>
              )}

              {recordedStepsForSelectedDate !== null && upload.kind !== "success" && (
                <p className="privacy" style={{ color: "var(--green, #2f855a)" }}>
                  <Icon name="check" className="muted-filter" /> Already recorded{" "}
                  {recordedStepsForSelectedDate.toLocaleString()} steps for {formatShortDate(selectedDate)} —
                  upload again to replace it.
                </p>
              )}

              <div
                className="upload-dropzone"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !eventNotStarted && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Upload a screenshot of your step count"
                style={{
                  border: dragOver ? "2px dashed var(--blue, #2b6cb0)" : "2px dashed rgba(0,0,0,0.2)",
                  borderRadius: 12,
                  padding: "1.5rem",
                  textAlign: "center",
                  cursor: eventNotStarted ? "not-allowed" : "pointer",
                  marginTop: 12,
                  background: dragOver ? "rgba(43,108,176,0.06)" : "rgba(255,255,255,0.4)",
                  opacity: eventNotStarted ? 0.5 : 1,
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={eventNotStarted}
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Selected step-count screenshot preview"
                    style={{ maxHeight: 180, maxWidth: "100%", borderRadius: 8, margin: "0 auto" }}
                  />
                ) : (
                  <>
                    <Icon name="camera" className="navy-filter" />
                    <p style={{ margin: "0.5rem 0 0" }}>
                      Drag & drop your step-count screenshot for {formatShortDate(selectedDate)} here, or
                      click to choose a file
                    </p>
                  </>
                )}
              </div>

              {upload.kind === "success" && (
                <p className="privacy" style={{ color: "var(--green, #2f855a)" }}>
                  <Icon name="check" className="muted-filter" /> Detected{" "}
                  {upload.steps.toLocaleString()} steps ✅ Recorded for {formatShortDate(selectedDate)}.
                </p>
              )}
              {upload.kind === "error" && (
                <p className="privacy" style={{ color: "var(--red, #c53030)" }}>
                  {upload.message}
                </p>
              )}

              <button
                type="button"
                className="connect-button"
                onClick={handleUpload}
                disabled={upload.kind === "uploading" || !file || eventNotStarted}
              >
                <Icon name="camera" className="white-filter" />{" "}
                {upload.kind === "uploading" ? "Reading screenshot…" : "Upload & Detect Steps"}
              </button>
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

      <section className="impact-banner give-banner home-give-banner">
        <span className="impact-heart">
          <Icon name="heart" className="red-filter" />
        </span>
        <div>
          <h2>Take a Step. Make a Difference.</h2>
          <p>
            Contribute to Microsoft Give or visit the{" "}
            <b>IDC Give booths in Hyderabad and Noida office</b> — every action, big or small,
            helps create a greater collective impact.
          </p>
          <a
            className="connect-button give-button"
            href="https://aka.ms/give"
            target="_blank"
            rel="noopener noreferrer"
          >
            Donate on Give Portal
          </a>
        </div>
      </section>

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
