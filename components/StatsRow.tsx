import { FootstepsIcon, TrophyIcon, UsersIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";

/**
 * Three-tile summary row shown above the leaderboard — participant count,
 * total steps, and average steps/participant. Intentionally skips any
 * dollar/donation figure (no giving-dollar tracking in this event).
 */
export function StatsRow({
  participants,
  totalSteps,
  averageSteps,
}: {
  participants: number;
  totalSteps: number;
  averageSteps: number;
}) {
  const tiles = [
    { label: "Participants", value: formatNumber(participants), icon: UsersIcon, color: "text-msblue" },
    { label: "Total steps", value: formatNumber(totalSteps), icon: FootstepsIcon, color: "text-msgreen" },
    { label: "Avg steps / person", value: formatNumber(averageSteps), icon: TrophyIcon, color: "text-msyellow" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {tiles.map((tile) => (
        <div key={tile.label} className="card px-3 py-4 text-center">
          <tile.icon className={`w-5 h-5 mx-auto mb-1.5 ${tile.color}`} />
          <p className="text-lg sm:text-xl font-bold tabular-nums text-gray-900">{tile.value}</p>
          <p className="text-[11px] sm:text-xs text-gray-500">{tile.label}</p>
        </div>
      ))}
    </div>
  );
}
