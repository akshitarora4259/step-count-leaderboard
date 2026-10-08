"use client";

import { useMemo, useState } from "react";
import { getWeekRange, todayISODate } from "@/lib/week";

const MAX_STEPS = 100_000;

type SubmitState = { kind: "idle" } | { kind: "success" } | { kind: "error"; message: string };

export default function SubmitPage() {
  const { startDate, endDate } = useMemo(() => getWeekRange(), []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState(todayISODate());
  const [steps, setSteps] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "idle" });

    const stepsNum = Number(steps);
    if (!name.trim()) {
      setState({ kind: "error", message: "Please enter your name." });
      return;
    }
    if (!Number.isInteger(stepsNum) || stepsNum < 0 || stepsNum > MAX_STEPS) {
      setState({
        kind: "error",
        message: `Please enter a whole number of steps between 0 and ${MAX_STEPS.toLocaleString()}.`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          steps: stepsNum,
          entry_date: date,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: body.error ?? "Something went wrong." });
      } else {
        setState({ kind: "success" });
        setSteps("");
      }
    } catch {
      setState({ kind: "error", message: "Network error — please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Log your steps 🚶‍♀️</h1>
      <p className="text-sm text-gray-500 mb-6">
        This week&apos;s event runs {startDate} – {endDate}. Submit your daily step count below —
        resubmitting for the same day updates your entry.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id="name"
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@company.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
            Date
          </label>
          <input
            id="date"
            type="date"
            required
            min={startDate}
            max={endDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="steps" className="block text-sm font-medium text-gray-700 mb-1">
            Step count
          </label>
          <input
            id="steps"
            type="number"
            required
            min={0}
            max={MAX_STEPS}
            step={1}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder="e.g. 8500"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-blue-600 text-white font-medium py-2 text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting…" : "Submit steps"}
        </button>

        {state.kind === "success" && (
          <div className="rounded-md bg-green-50 border border-green-200 text-green-800 text-sm px-3 py-2">
            ✅ Thanks! Your steps were recorded. Check the{" "}
            <a href="/leaderboard" className="underline font-medium">
              leaderboard
            </a>
            .
          </div>
        )}
        {state.kind === "error" && (
          <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2">
            ⚠️ {state.message}
          </div>
        )}
      </form>
    </div>
  );
}
