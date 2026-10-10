"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="nav">
      <div className="brand">
        <span className="ms-logo">
          <span />
          <span />
          <span />
          <span />
        </span>
        <strong>Microsoft</strong>
      </div>
      <nav>
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : ""}>
            {link.label}
          </Link>
        ))}
      </nav>
      <Link href="/me" aria-label="Your profile" className="profile-placeholder">
        ●
      </Link>
    </header>
  );
}
