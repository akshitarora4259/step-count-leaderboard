"use client";

import { useMemo, useRef, useState } from "react";
import { getWeekRange, todayISODate } from "@/lib/week";
import { extractStepCount } from "@/lib/ocr";

const MAX_STEPS = 100_000;
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB — generous for a phone screenshot

type SubmitState = { kind: "idle" } | { kind: "success" } | { kind: "error"; message: string };
type OcrState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; detected: number | null }
  | { kind: "error"; message: string };

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

export default function SubmitPage() {
  const { startDate, endDate } = useMemo(() => getWeekRange(), []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState(todayISODate());
  const [steps, setSteps] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [ocr, setOcr] = useState<OcrState>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setState({ kind: "idle" });
    setSteps("");

    if (!file.type.startsWith("image/")) {
      setOcr({ kind: "error", message: "Please choose an image file." });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setOcr({ kind: "error", message: "Image is too large — please use a smaller screenshot (under 8MB)." });
      return;
    }

    const dataUrl = await readFileAsDataURL(file);
    setImageDataUrl(dataUrl);
    setOcr({ kind: "running" });

    try {
      // Dynamically imported so the (fairly large) tesseract.js bundle is
      // only fetched when someone actually uploads a screenshot, and the
      // OCR work happens entirely client-side — the API only ever receives
      // the extracted number plus the image itself, never runs OCR
      // server-side (keeps Vercel serverless functions light and fast).
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const {
        data: { text },
      } = await worker.recognize(dataUrl);
      await worker.terminate();

      const detected = extractStepCount(text);
      setOcr({ kind: "done", detected });
      if (detected !== null) {
        setSteps(String(detected));
      }
    } catch (err) {
      setOcr({
        kind: "error",
        message: err instanceof Error ? err.message : "OCR failed — please enter your step count manually.",
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "idle" });

    const stepsNum = Number(steps);
    if (!name.trim()) {
      setState({ kind: "error", message: "Please enter your name." });
      return;
    }
    if (!imageDataUrl) {
      setState({ kind: "error", message: "Please upload a screenshot of your step count." });
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
          screenshot: imageDataUrl,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: body.error ?? "Something went wrong." });
      } else {
        setState({ kind: "success" });
        setSteps("");
        setImageDataUrl(null);
        setOcr({ kind: "idle" });
        if (fileInputRef.current) fileInputRef.current.value = "";
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
        This week&apos;s event runs {startDate} – {endDate}. Upload a screenshot of your phone&apos;s
        step count screen — we&apos;ll read the number automatically. Resubmitting for the same day
        updates your entry.
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
          <label htmlFor="screenshot" className="block text-sm font-medium text-gray-700 mb-1">
            Step count screenshot
          </label>
          <input
            id="screenshot"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            required
            onChange={handleFileChange}
            className="w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="text-xs text-gray-400 mt-1">
            A screenshot of your fitness app / phone health screen showing today&apos;s step count.
          </p>

          {imageDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- local/base64 preview, no remote optimization needed
            <img
              src={imageDataUrl}
              alt="Step count screenshot preview"
              className="mt-3 max-h-48 rounded-md border border-gray-200 object-contain"
            />
          )}

          {ocr.kind === "running" && (
            <p className="text-sm text-blue-600 mt-2">🔎 Reading step count from image…</p>
          )}
          {ocr.kind === "error" && (
            <p className="text-sm text-amber-600 mt-2">⚠️ {ocr.message}</p>
          )}
          {ocr.kind === "done" && ocr.detected === null && (
            <p className="text-sm text-amber-600 mt-2">
              ⚠️ Couldn&apos;t detect a number automatically — please enter it manually below.
            </p>
          )}
          {ocr.kind === "done" && ocr.detected !== null && (
            <p className="text-sm text-green-700 mt-2">
              ✅ Detected: {ocr.detected.toLocaleString()} steps — double-check it below before submitting.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="steps" className="block text-sm font-medium text-gray-700 mb-1">
            Step count {ocr.kind === "done" && <span className="text-gray-400 font-normal">(edit if wrong)</span>}
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
            placeholder="Detected automatically, or enter manually"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || ocr.kind === "running"}
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
