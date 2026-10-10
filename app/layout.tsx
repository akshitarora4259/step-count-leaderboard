import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { GiveMark } from "@/components/GiveMark";
import { GiveLogo } from "@/components/GiveLogo";
import { HeaderNav } from "@/components/HeaderNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Step Count Give Event",
  description: "Company step count give event — connect Fitbit and check the leaderboard.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <header className="bg-white/90 backdrop-blur border-b border-gray-200 sticky top-0 z-10">
          <nav className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between">
            <Link href="/">
              <GiveLogo />
            </Link>
            <HeaderNav />
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-2 text-xs text-gray-500">
            <p className="flex items-center gap-1.5">
              <GiveMark className="w-3.5 h-3.5" />
              Step Challenge is an internal Microsoft Give-style event — no login required, just
              your name and a Fitbit connection.
            </p>
            <p>
              No wearable? The Fitbit app tracks steps from your phone&apos;s motion sensor too —
              install it, let it run in your pocket, then connect here.
            </p>
            <p>
              You can disconnect at any time from the{" "}
              <Link href="/#connect" className="underline hover:text-gray-700">
                Connect
              </Link>{" "}
              section — it revokes Fitbit&apos;s access and removes your synced step data
              immediately.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
