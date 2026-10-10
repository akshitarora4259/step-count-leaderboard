/**
 * Small, dependency-free inline SVG icons used across the app. Kept as a
 * single module instead of pulling in an icon library for a handful of
 * glyphs.
 */

type IconProps = { className?: string };

export function FootstepsIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M9.5 3.5c1.4 0 2.1 1.4 2.1 3.2 0 2.3-1 4-1 6 0 1.6.9 2.8.9 4.3 0 1.7-1 2.8-2.4 2.8-1.6 0-2.4-1.3-2.4-3 0-2 .9-3.6.9-5.8 0-2.1-1-3.8-1-5.6 0-1.1.5-1.9 1.4-1.9z"
        fill="currentColor"
      />
      <path
        d="M16.5 8.5c1.4 0 2.1 1.4 2.1 3.2 0 2.3-1 4-1 6 0 1.6.9 2.8.9 4.3 0 1.7-1 2.8-2.4 2.8-1.6 0-2.4-1.3-2.4-3 0-2 .9-3.6.9-5.8 0-2.1-1-3.8-1-5.6 0-1.1.5-1.9 1.4-1.9z"
        fill="currentColor"
        opacity="0.55"
      />
    </svg>
  );
}

export function HeartIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 21s-7.5-4.6-10-9.1C.6 8.6 2 5 5.6 4.3c2-.4 3.9.5 5 2.1a.5.5 0 0 0 .8 0c1.1-1.6 3-2.5 5-2.1C19.9 5 21.4 8.6 22 11.9 19.5 16.4 12 21 12 21z"
        fill="currentColor"
      />
    </svg>
  );
}

export function LinkIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M9 15l6-6" />
      <path d="M11 6l1.4-1.4a4 4 0 1 1 5.7 5.7L16.6 11.7" />
      <path d="M13 18l-1.4 1.4a4 4 0 1 1-5.7-5.7L7.4 12.3" />
    </svg>
  );
}

export function UnlinkIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M18.4 14.6 20 13a4 4 0 0 0-5.7-5.7l-1.6 1.6" />
      <path d="M5.6 9.4 4 11a4 4 0 0 0 5.7 5.7l1.6-1.6" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

export function RefreshIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export function CheckCircleIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  );
}

export function AlertIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9 2.7 17.1A1.8 1.8 0 0 0 4.3 20h15.4a1.8 1.8 0 0 0 1.6-2.9L13.7 3.9a1.8 1.8 0 0 0-3.4 0z" />
    </svg>
  );
}

export function TrophyIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
      <path d="M7 5H4a3 3 0 0 0 3 5" />
      <path d="M17 5h3a3 3 0 0 1-3 5" />
    </svg>
  );
}

export function ChevronRightIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function UsersIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function AwardIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="6" />
      <path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1" />
    </svg>
  );
}
