"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getWeekRange } from "@/lib/week";

type Status =
  | { kind: "unknown" }
  | { kind: "checking" }
  | { kind: "not_connected" }
  | { kind: "connected"; isMock: boolean };

type Banner = { kind: "success" | "error"; message: string };

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
    <div className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Join the step challenge 🚶‍♀️</h1>
      <p className="text-sm text-gray-500 mb-6">
        This week&apos;s event runs {startDate} – {endDate}. Connect your Fitbit account and we&apos;ll
        automatically sync your daily step count all week — no manual entry needed.
      </p>

      <div className="space-y-4 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="pt-3 border-t border-gray-100">
          {status.kind === "checking" && <p className="text-sm text-gray-500">Checking connection…</p>}

          {(status.kind === "unknown" || status.kind === "not_connected") && (
            <>
              <button
                type="button"
                onClick={handleConnect}
                className="w-full rounded-md bg-[#00B0B9] text-white font-medium py-2 text-sm hover:opacity-90"
              >
                🔗 Connect Fitbit
              </button>
              <p className="text-xs text-gray-400 mt-2">
                You&apos;ll be redirected to Fitbit to authorize read-only access to your step count.
                You can disconnect anytime — see below.
              </p>
            </>
          )}

          {status.kind === "connected" && (
            <div className="space-y-3">
              <div className="rounded-md bg-green-50 border border-green-200 text-green-800 text-sm px-3 py-2">
                ✅ Connected to Fitbit{status.isMock ? " (demo mode — sample data)" : ""}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={syncing}
                  className="flex-1 rounded-md border border-gray-300 text-gray-700 font-medium py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  {syncing ? "Syncing…" : "Sync now"}
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex-1 rounded-md border border-red-300 text-red-700 font-medium py-2 text-sm hover:bg-red-50 disabled:opacity-50"
                >
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
            className={`rounded-md border text-sm px-3 py-2 ${
              banner.kind === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {banner.kind === "success" ? "✅ " : "⚠️ "}
            {banner.message}
          </div>
        )}

        <p className="text-xs text-gray-400 pt-3 border-t border-gray-100">
          Check the{" "}
          <a href="/leaderboard" className="underline font-medium">
            leaderboard
          </a>{" "}
          to see standings update as everyone&apos;s steps sync in.
        </p>
      </div>
    </div>
  );
}

export default function SubmitPage() {
  return (
    <Suspense fallback={null}>
      <SubmitForm />
    </Suspense>
  );
}
