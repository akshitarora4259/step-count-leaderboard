/** A single shimmering placeholder block — use multiple to compose a loading skeleton. */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/** Skeleton placeholder for the leaderboard's podium + table while the first fetch is in flight. */
export function LeaderboardSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-5 space-y-3">
            <SkeletonBlock className="w-12 h-12 rounded-full mx-auto" />
            <SkeletonBlock className="h-4 w-2/3 mx-auto" />
            <SkeletonBlock className="h-6 w-1/2 mx-auto" />
          </div>
        ))}
      </div>
      <div className="card p-4 mb-8">
        <SkeletonBlock className="h-4 w-40 mb-4" />
        <SkeletonBlock className="h-64 w-full" />
      </div>
      <div className="card p-4 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <SkeletonBlock key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
