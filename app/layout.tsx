import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { GiveMark } from "@/components/GiveMark";

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
        <div className="brand-ribbon" />
        <header className="bg-white/90 backdrop-blur border-b border-gray-200 sticky top-0 z-10">
          <nav className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold text-gray-800">
              <GiveMark className="w-5 h-5" />
              <span>
                Step Challenge <span className="text-gray-400 font-normal">· Microsoft Give</span>
              </span>
            </Link>
            <div className="flex gap-1 text-sm font-medium">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                Connect
              </Link>
              <Link
                href="/leaderboard"
                className="px-3 py-1.5 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                Leaderboard
              </Link>
            </div>
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
              <Link href="/" className="underline hover:text-gray-700">
                Connect
              </Link>{" "}
              page — it revokes Fitbit&apos;s access and removes your synced step data immediately.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
