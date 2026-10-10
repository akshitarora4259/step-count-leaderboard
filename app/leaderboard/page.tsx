"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LeaderboardEntry, LeaderboardStats } from "@/app/api/leaderboard/route";
import { Avatar } from "@/components/Avatar";
import { LeaderboardSkeleton } from "@/components/Skeleton";
import { AlertIcon, LinkIcon, TrophyIcon } from "@/components/icons";
import { StatsRow } from "@/components/StatsRow";
import { formatNumber } from "@/lib/format";

const POLL_INTERVAL_MS = 30_000;

// Cycled across bars/podium accents so colors read as "brand", not random.
const BRAND_CYCLE = ["#F25022", "#7FBA00", "#00A4EF", "#FFB900"];

const PODIUM_STYLE = [
  { border: "border-[#FFB900]/50", bg: "bg-[#FFB900]/10", medal: "🥇", order: "sm:order-2" },
  { border: "border-gray-300", bg: "bg-gray-50", medal: "🥈", order: "sm:order-1" },
  { border: "border-[#F25022]/40", bg: "bg-[#F25022]/5", medal: "🥉", order: "sm:order-3" },
];

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<LeaderboardStats | null>(null);
  const [range, setRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
      setRange({ startDate: body.startDate, endDate: body.endDate });
      setError(null);
      setLastUpdated(new Date());
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

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);
  const top10 = leaderboard.slice(0, 10).map((entry) => ({
    name: entry.name,
    steps: entry.totalSteps,
  }));

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrophyIcon className="w-6 h-6 text-msyellow" />
          Leaderboard
        </h1>
        {lastUpdated && (
          <span className="text-xs text-gray-400">Updated {lastUpdated.toLocaleTimeString()}</span>
        )}
      </div>
      {range && (
        <p className="text-sm text-gray-500 mb-6">
          Current week: {range.startDate} – {range.endDate}
        </p>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-msred/10 border border-msred/30 text-msred text-sm px-3 py-2 mb-6">
          <AlertIcon className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <LeaderboardSkeleton />
      ) : leaderboard.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">
            No entries yet this week. Be the first to connect and start syncing!
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-msblue hover:underline"
          >
            <LinkIcon className="w-4 h-4" />
            Connect Fitbit
          </Link>
        </div>
      ) : (
        <div className="animate-fade-in">
          {stats && (
            <StatsRow
              participants={stats.participants}
              totalSteps={stats.totalSteps}
              averageSteps={stats.averageSteps}
            />
          )}
          {/* Podium: top 3 */}
          {top3.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 items-end">
              {top3.map((entry, i) => {
                const style = PODIUM_STYLE[i];
                return (
                  <div
                    key={entry.name}
                    className={`card ${style.order} ${style.bg} ${style.border} border-2 p-5 text-center relative overflow-hidden ${
                      i === 0 ? "sm:scale-105 sm:shadow-md" : ""
                    }`}
                  >
                    <div className="text-3xl mb-1" aria-hidden="true">
                      {style.medal}
                    </div>
                    <Avatar name={entry.name} size="lg" />
                    <p className="mt-2 font-semibold text-gray-900 truncate">{entry.name}</p>
                    <p className="text-2xl font-bold tabular-nums text-gray-900 mt-1">
                      {formatNumber(entry.totalSteps)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatNumber(entry.dailyAverage)} avg/day · {entry.daysLogged}d
                    </p>
                    {entry.fitbitConnected && (
                      <span className="inline-flex items-center gap-1 mt-2 rounded-full bg-msblue/10 text-msblue text-[11px] font-medium px-2 py-0.5">
                        <LinkIcon className="w-3 h-3" />
                        Fitbit{entry.isMock ? " (demo)" : ""}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Bar chart */}
          <div className="card p-4 mb-8">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Top 10 by total steps</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={top10} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                    formatter={(value) => (value === undefined ? "" : formatNumber(Number(value)))}
                  />
                  <Bar dataKey="steps" radius={[4, 4, 0, 0]}>
                    {top10.map((_, i) => (
                      <Cell key={i} fill={BRAND_CYCLE[i % BRAND_CYCLE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Rest of the field */}
          {rest.length > 0 && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">Rank</th>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium text-right">Total steps</th>
                    <th className="px-4 py-2 font-medium text-right">Days logged</th>
                    <th className="px-4 py-2 font-medium text-right">Daily avg</th>
                    <th className="px-4 py-2 font-medium text-center">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rest.map((entry, i) => (
                    <tr key={entry.name} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-2 font-semibold text-gray-500 tabular-nums">{i + 4}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar name={entry.name} size="sm" />
                          <span className="text-gray-900">{entry.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-900">
                        {formatNumber(entry.totalSteps)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-600">{entry.daysLogged}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                        {formatNumber(entry.dailyAverage)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {entry.fitbitConnected ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-msblue/10 text-msblue text-xs font-medium px-2 py-0.5"
                            title={entry.isMock ? "Demo connection (sample data)" : "Synced via Fitbit"}
                          >
                            <LinkIcon className="w-3 h-3" />
                            Fitbit{entry.isMock ? " (demo)" : ""}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
