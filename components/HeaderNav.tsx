"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredName } from "@/lib/clientName";
import { PersonIcon } from "@/components/icons";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/#connect", label: "Connect" },
  { href: "/me", label: "Me" },
];

/**
 * Sticky header nav — matches the reference design's "Dashboard | Leaderboard
 * | Connect | Me" pattern, plus a small avatar/person icon far right that
 * links to the current browser's "Me" profile (see lib/clientName.ts — this
 * is a convenience lookup only, not an auth session).
 */
export function HeaderNav() {
  const pathname = usePathname();
  const [initials, setInitials] = useState<string | null>(null);

  useEffect(() => {
    const name = getStoredName();
    if (name) {
      const parts = name.trim().split(/\s+/).filter(Boolean);
      setInitials(
        parts.length > 1
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : parts[0]?.slice(0, 2).toUpperCase() ?? null
      );
    }
  }, [pathname]);

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <nav className="flex items-center gap-0.5 sm:gap-1 text-xs sm:text-sm font-medium">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="px-3 py-1.5 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <Link
        href="/me"
        aria-label="Your profile"
        className="w-8 h-8 rounded-full bg-msblue/10 text-msblue flex items-center justify-center text-xs font-semibold hover:bg-msblue/20 transition-colors shrink-0"
      >
        {initials ?? <PersonIcon className="w-4 h-4" />}
      </Link>
    </div>
  );
}
