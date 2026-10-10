import { FootstepsIcon, TrophyIcon, UsersIcon, SparkleIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";

/**
 * Four-tile summary row shown above the leaderboard — participant count,
 * total steps, average steps/participant, and week completion %.
 * Intentionally skips any dollar/donation figure (no giving-dollar tracking
 * in this event).
 */
export function StatsRow({
  participants,
  totalSteps,
  averageSteps,
  completionPercent,
}: {
  participants: number;
  totalSteps: number;
  averageSteps: number;
  completionPercent: number;
}) {
  const tiles = [
    { label: "Participants", value: formatNumber(participants), icon: UsersIcon, color: "text-msblue" },
    { label: "Total steps", value: formatNumber(totalSteps), icon: FootstepsIcon, color: "text-msgreen" },
    { label: "Avg steps / person", value: formatNumber(averageSteps), icon: TrophyIcon, color: "text-msyellow" },
    { label: "Week completion", value: `${completionPercent}%`, icon: SparkleIcon, color: "text-msred" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
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
