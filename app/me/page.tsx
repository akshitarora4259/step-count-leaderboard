"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Avatar } from "@/components/Avatar";
import {
  AwardIcon,
  CheckCircleIcon,
  LinkIcon,
  SparkleIcon,
  TrophyIcon,
  UnlinkIcon,
} from "@/components/icons";
import { clearStoredName, getStoredName } from "@/lib/clientName";
import { formatNumber } from "@/lib/format";
import { todayISODate } from "@/lib/week";
import type { ProfileResponse } from "@/app/api/profile/route";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
    return <div className="max-w-md mx-auto px-4 py-16 text-center text-sm text-gray-400">Loading…</div>;
  }

  if (state.kind === "no_name" || state.kind === "not_connected") {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="card p-8">
          <p className="text-sm text-gray-500 mb-4">
            {state.kind === "not_connected"
              ? `${state.name} isn't connected to Fitbit yet.`
              : "Connect your Fitbit to see your own stats, weekly chart, and achievement badges here."}
          </p>
          <Link
            href="/#connect"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-msblue text-white font-semibold px-6 py-2.5 text-sm hover:bg-[#0092d6] transition-colors"
          >
            <LinkIcon className="w-4 h-4" />
            Connect Fitbit
          </Link>
        </div>
      </div>
    );
  }

  const { name, isMock, profile } = state;
  const today = todayISODate();
  const todaysSteps = profile.daily.find((d) => d.date === today)?.steps ?? 0;
  const chartData = profile.daily.map((d, i) => ({ label: DAY_LABELS[i], steps: d.steps }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-5">
      {/* Connected banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-msgreen/10 border border-msgreen/30 px-4 py-3">
        <div className="flex items-center gap-2 text-[#4d7300] text-sm">
          <CheckCircleIcon className="w-5 h-5 shrink-0" />
          <span>
            <span className="font-semibold">Your Fitbit is connected{isMock ? " (demo)" : ""}.</span>{" "}
            Your steps are syncing automatically.
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleDisconnect(name)}
          disabled={disconnecting}
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-msred/40 text-msred font-medium px-4 py-1.5 text-sm hover:bg-msred/5 disabled:opacity-50 transition-colors shrink-0"
        >
          <UnlinkIcon className="w-4 h-4" />
          {disconnecting ? "Disconnecting…" : "Disconnect"}
        </button>
      </div>

      {/* Profile card */}
      <div className="card p-6 text-center">
        <Avatar name={name} size="lg" />
        <p className="mt-3 text-lg font-bold text-gray-900">{name}</p>

        <div className="grid grid-cols-3 gap-3 mt-5">
          <div>
            <p className="text-lg font-bold tabular-nums text-gray-900">{formatNumber(todaysSteps)}</p>
            <p className="text-[11px] text-gray-500">Today&apos;s steps</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-gray-900">{formatNumber(profile.totalSteps)}</p>
            <p className="text-[11px] text-gray-500">This week&apos;s total</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-msblue">
              {profile.rank ? `#${profile.rank}` : "—"}
            </p>
            <p className="text-[11px] text-gray-500">Current rank</p>
          </div>
        </div>
      </div>

      {/* Weekly chart */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <TrophyIcon className="w-4 h-4 text-msyellow" />
          Your Steps This Week
        </h2>
        <div style={{ width: "100%", height: 160 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                formatter={(value) => (value === undefined ? "" : formatNumber(Number(value)))}
              />
              <Bar dataKey="steps" fill="#00A4EF" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Impact message */}
      <div className="card p-5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-full brand-gradient text-white flex items-center justify-center shrink-0">
          <SparkleIcon className="w-4.5 h-4.5" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 mb-0.5">Your Steps Create Real Impact</h3>
          <p className="text-sm text-gray-500">
            Every step you log this week adds to the team&apos;s total momentum — keep walking,
            keep climbing the leaderboard.
          </p>
        </div>
      </div>

      {/* Achievements */}
      {profile.badges.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Achievements</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {profile.badges.map((badge) => (
              <div
                key={badge}
                className="flex flex-col items-center gap-1.5 rounded-xl bg-msgreen/5 border border-msgreen/20 px-2 py-3 text-center"
              >
                <div className="w-9 h-9 rounded-full bg-msgreen/15 text-[#4d7300] flex items-center justify-center">
                  <AwardIcon className="w-4.5 h-4.5" />
                </div>
                <p className="text-xs font-medium text-gray-700">{badge}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-right text-xs text-gray-400 italic">Move steps, inspire change.</p>
    </div>
  );
}
