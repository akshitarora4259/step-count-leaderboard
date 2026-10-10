/**
 * Lightweight flat-style illustration of people walking outdoors, used as a
 * decorative hero visual on the landing page. Pure inline SVG (no external
 * image assets) so it stays dependency-free and fast — captures the "vibe"
 * of the design reference rather than reproducing it pixel-for-pixel.
 */
export function WalkingIllustration({ className = "" }: { className?: string }) {
  const walkers = [
    { x: 60, color: "#00A4EF", skin: "#C68642", delay: "0s" },
    { x: 140, color: "#7FBA00", skin: "#8D5524", delay: "0.15s" },
    { x: 220, color: "#F25022", skin: "#FFDBAC", delay: "0.3s" },
    { x: 300, color: "#FFB900", skin: "#E0AC69", delay: "0.45s" },
  ];

  return (
    <svg
      viewBox="0 0 360 240"
      className={className}
      role="img"
      aria-label="Illustration of people walking together outdoors"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EAF6FF" />
          <stop offset="100%" stopColor="#F7FBF0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="360" height="240" rx="20" fill="url(#sky)" />
      <circle cx="310" cy="45" r="22" fill="#FFF4CC" />
      <circle cx="310" cy="45" r="14" fill="#FFB900" />
      <path d="M0 195 h360 v45 h-360 z" fill="#DCEFC8" />
      <path d="M0 195 q180 -20 360 0 v5 q-180 -20 -360 0 z" fill="#C9E6A8" />
      {/* simple trees */}
      <g opacity="0.85">
        <circle cx="35" cy="160" r="18" fill="#7FBA00" />
        <rect x="31" y="170" width="8" height="22" fill="#A9784D" />
        <circle cx="335" cy="150" r="22" fill="#7FBA00" />
        <rect x="330" y="165" width="10" height="28" fill="#A9784D" />
      </g>
      {/* walkers */}
      {walkers.map((w, i) => (
        <g key={i} transform={`translate(${w.x} 120)`}>
          <circle cx="0" cy="0" r="14" fill={w.skin} />
          <path
            d="M-14 16 q14 -10 28 0 l-4 46 q-10 6 -20 0 z"
            fill={w.color}
          />
          <rect x="-16" y="60" width="7" height="24" rx="3" fill={w.skin} />
          <rect x="9" y="60" width="7" height="24" rx="3" fill={w.skin} />
        </g>
      ))}
    </svg>
  );
}
