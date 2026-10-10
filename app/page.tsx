"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getWeekRange } from "@/lib/week";
import { FootstepsIcon, HeartIcon, LinkIcon, RefreshIcon, UnlinkIcon, CheckCircleIcon, AlertIcon, TrophyIcon } from "@/components/icons";
import { WalkingIllustration } from "@/components/WalkingIllustration";
import { ProfileCard } from "@/components/ProfileCard";

type Status =
  | { kind: "unknown" }
  | { kind: "checking" }
  | { kind: "not_connected" }
  | { kind: "connected"; isMock: boolean };

type Banner = { kind: "success" | "error"; message: string };

const HOW_IT_WORKS = [
  {
    title: "Connect",
    description: "Enter your name and link your Fitbit account in one click — read-only access, nothing posted on your behalf.",
    icon: LinkIcon,
  },
  {
    title: "Sync",
    description: "Your daily step count syncs automatically all week. No manual logging, no screenshots.",
    icon: RefreshIcon,
  },
  {
    title: "Climb the leaderboard",
    description: "Watch your rank update live alongside everyone else giving it their all this week.",
    icon: TrophyIcon,
  },
];

function SubmitForm() {
  const searchParams = useSearchParams();
  const { startDate, endDate } = useMemo(() => getWeekRange(), []);
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
      } else {
        setStatus({ kind: "not_connected" });
      }
    } catch {
      setStatus({ kind: "not_connected" });
    }
  }, []);

  // On first render, pick up state from the OAuth redirect back from
  // /api/fitbit/connect or /api/fitbit/callback (connected=1&name=...,
  // mock=1, or fitbit_error=...).
  useEffect(() => {
    const paramName = searchParams.get("name");
    const connected = searchParams.get("connected");
    const mock = searchParams.get("mock");
    const err = searchParams.get("fitbit_error");

    if (paramName) {
      setName(paramName);
      checkStatus(paramName);
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
    // Only run once, on mount — this reads the redirect params, not live state.
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

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 brand-gradient opacity-[0.05]" aria-hidden="true" />
        <div className="relative max-w-5xl mx-auto px-4 pt-14 pb-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center justify-center md:justify-start gap-2 text-msblue mb-4">
              <FootstepsIcon className="w-8 h-8" />
              <HeartIcon className="w-6 h-6 text-msred" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-3">
              Every Step Is a Give
            </h1>
            <p className="text-base text-gray-600 max-w-xl mx-auto md:mx-0 mb-5">
              Walk for your health. Give for a better tomorrow. Connect your Fitbit once — your
              steps sync automatically all week, no manual logging — and see how your movement
              stacks up on the company leaderboard. {startDate} – {endDate}.
            </p>
            <a
              href="#connect"
              className="inline-flex items-center justify-center gap-2 rounded-lg brand-gradient text-white font-semibold px-6 py-3 text-sm shadow-sm hover:shadow-md hover:brightness-105 active:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-msblue transition-all"
            >
              <LinkIcon className="w-4 h-4" />
              Connect Fitbit
            </a>
          </div>
          <WalkingIllustration className="w-full h-auto max-w-sm mx-auto md:max-w-none" />
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-3xl mx-auto px-4 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.title} className="card p-5 text-center">
              <div className="w-10 h-10 rounded-full brand-gradient text-white flex items-center justify-center mx-auto mb-3">
                <step.icon className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-msblue mb-1">STEP {i + 1}</p>
              <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
              <p className="text-sm text-gray-500">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Connect card */}
      <section id="connect" className="max-w-md mx-auto px-4 pb-16 scroll-mt-20">
        <div className="card p-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              id="name"
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={(e) => checkStatus(e.target.value)}
              placeholder="Jane Doe"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-msblue/60 focus:border-msblue transition-shadow"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@company.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-msblue/60 focus:border-msblue transition-shadow"
            />
          </div>

          <div className="pt-3 border-t border-gray-100">
            {status.kind === "checking" && <p className="text-sm text-gray-500">Checking connection…</p>}

            {(status.kind === "unknown" || status.kind === "not_connected") && (
              <>
                <button
                  type="button"
                  onClick={handleConnect}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg brand-gradient text-white font-semibold py-2.5 text-sm shadow-sm hover:shadow-md hover:brightness-105 active:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-msblue transition-all"
                >
                  <LinkIcon className="w-4 h-4" />
                  Connect Fitbit
                </button>
                <p className="text-xs text-gray-400 mt-2">
                  You&apos;ll be redirected to Fitbit to authorize read-only access to your step count.
                  You can disconnect anytime — see below.
                </p>
              </>
            )}

            {status.kind === "connected" && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 rounded-lg bg-msgreen/10 border border-msgreen/30 text-[#4d7300] text-sm px-3 py-2">
                  <CheckCircleIcon className="w-4 h-4 shrink-0" />
                  Connected to Fitbit{status.isMock ? " (demo mode — sample data)" : ""}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSyncNow}
                    disabled={syncing}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 text-gray-700 font-medium py-2 text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    <RefreshIcon className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                    {syncing ? "Syncing…" : "Sync now"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-msred/40 text-msred font-medium py-2 text-sm hover:bg-msred/5 disabled:opacity-50 transition-colors"
                  >
                    <UnlinkIcon className="w-4 h-4" />
                    {disconnecting ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  Disconnecting revokes Fitbit&apos;s access and removes your synced step data from
                  this event.
                </p>
              </div>
            )}
          </div>

          {banner && (
            <div
              className={`flex items-start gap-2 rounded-lg border text-sm px-3 py-2 animate-fade-in ${
                banner.kind === "success"
                  ? "bg-msgreen/10 border-msgreen/30 text-[#4d7300]"
                  : "bg-msred/10 border-msred/30 text-msred"
              }`}
            >
              {banner.kind === "success" ? (
                <CheckCircleIcon className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertIcon className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              {banner.message}
            </div>
          )}

          <p className="text-xs text-gray-400 pt-3 border-t border-gray-100">
            Check the{" "}
            <Link href="/leaderboard" className="underline font-medium text-msblue">
              leaderboard
            </Link>{" "}
            to see standings update as everyone&apos;s steps sync in.
          </p>
        </div>

        {status.kind === "connected" && name.trim() && (
          <div className="mt-4">
            <ProfileCard name={name.trim()} />
          </div>
        )}
      </section>
    </>
  );
}

export default function SubmitPage() {
  return (
    <Suspense fallback={null}>
      <SubmitForm />
    </Suspense>
  );
}
