"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LeaderboardEntry } from "@/app/api/leaderboard/route";

const POLL_INTERVAL_MS = 30_000;

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
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

  const top10 = leaderboard.slice(0, 10).map((entry) => ({
    name: entry.name,
    steps: entry.totalSteps,
  }));

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Leaderboard 🏆</h1>
        {lastUpdated && (
          <span className="text-xs text-gray-400">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>
      {range && (
        <p className="text-sm text-gray-500 mb-6">
          Current week: {range.startDate} – {range.endDate}
        </p>
      )}

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2 mb-6">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : leaderboard.length === 0 ? (
        <p className="text-sm text-gray-500">No entries yet this week. Be the first to submit!</p>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-8">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Top 10 by total steps</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={top10} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="steps" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Rank</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium text-right">Total steps</th>
                  <th className="px-4 py-2 font-medium text-right">Days logged</th>
                  <th className="px-4 py-2 font-medium text-right">Daily avg</th>
                  <th className="px-4 py-2 font-medium text-center">Screenshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaderboard.map((entry, i) => (
                  <tr key={entry.name} className={i < 3 ? "bg-yellow-50/50" : undefined}>
                    <td className="px-4 py-2 font-semibold text-gray-700">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </td>
                    <td className="px-4 py-2 text-gray-900">{entry.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {entry.totalSteps.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{entry.daysLogged}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {entry.dailyAverage.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {entry.latestScreenshotUrl ? (
                        <a
                          href={entry.latestScreenshotUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View uploaded screenshot"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- small spot-check thumbnail, remote/base64 source */}
                          <img
                            src={entry.latestScreenshotUrl}
                            alt={`${entry.name}'s screenshot`}
                            className="inline-block h-10 w-10 rounded object-cover border border-gray-200 hover:ring-2 hover:ring-blue-400"
                          />
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
