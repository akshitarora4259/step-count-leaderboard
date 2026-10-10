"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredName } from "@/lib/clientName";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
];

function initialsFor(name: string | null): string {
  if (!name) return "ME";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ME";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function NavBar() {
  const pathname = usePathname();
  // Real-if-known participant initials for the profile button — not
  // fabricated data; falls back to a neutral "ME" placeholder when no
  // participant name has been captured yet on this browser (no login system).
  const [initials, setInitials] = useState("ME");

  useEffect(() => {
    setInitials(initialsFor(getStoredName()));
  }, [pathname]);

  return (
    <header className="topbar">
      <Link className="microsoft-brand" href="/" aria-label="Microsoft Give home">
        <span className="ms-mark" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span>Microsoft</span>
      </Link>
      <nav aria-label="Primary navigation">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link${pathname === link.href ? " active" : ""}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <Link href="/me" aria-label="Profile" className="profile-button">
        <span>{initials}</span>
      </Link>
    </header>
  );
}
