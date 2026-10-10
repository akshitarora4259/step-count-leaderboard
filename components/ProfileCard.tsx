"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { ProfileResponse } from "@/app/api/profile/route";
import { AwardIcon, TrophyIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Own-stats card shown once a participant is connected — rank, total steps,
 * a small daily-steps bar chart for the current week, and a couple of simple
 * achievement badges (no monetary "giving credits" — reinterpreted as
 * streak/participation badges instead).
 */
export function ProfileCard({ name }: { name: string }) {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/profile?name=${encodeURIComponent(name)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body) setProfile(body);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [name]);

  if (!profile || profile.totalSteps === 0) return null;

  const chartData = profile.daily.map((d, i) => ({ label: DAY_LABELS[i], steps: d.steps }));

  return (
    <div className="card p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">Your steps this week</p>
          <p className="text-2xl font-bold tabular-nums text-gray-900">
            {formatNumber(profile.totalSteps)}
          </p>
        </div>
        {profile.rank && (
          <div className="text-right">
            <p className="text-xs text-gray-400 flex items-center justify-end gap-1">
              <TrophyIcon className="w-3.5 h-3.5 text-msyellow" />
              Rank
            </p>
            <p className="text-2xl font-bold tabular-nums text-msblue">
              #{profile.rank}
              <span className="text-xs font-normal text-gray-400">/{profile.participants}</span>
            </p>
          </div>
        )}
      </div>

      <div style={{ width: "100%", height: 100 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
              formatter={(value) => (value === undefined ? "" : formatNumber(Number(value)))}
            />
            <Bar dataKey="steps" fill="#00A4EF" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {profile.badges.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Badges earned</p>
          <div className="flex flex-wrap gap-2">
            {profile.badges.map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center gap-1.5 rounded-full bg-msgreen/10 text-[#4d7300] text-xs font-medium px-2.5 py-1"
              >
                <AwardIcon className="w-3.5 h-3.5" />
                {badge}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
