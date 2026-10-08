import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient, isSupabaseConfigured, uploadScreenshotToSupabase } from "@/lib/supabase";
import { upsertStepEntry } from "@/lib/memoryStore";
import { getWeekRange } from "@/lib/week";

const MAX_STEPS = 100_000;
const MAX_NAME_LENGTH = 100;
// Keep screenshot payloads well under Vercel's ~4.5MB serverless function
// request body limit (base64 inflates size by ~33%, hence the smaller cap).
const MAX_SCREENSHOT_BASE64_CHARS = 6_000_000;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { name, email, steps, entry_date, screenshot } = (body ?? {}) as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: "Name is too long." }, { status: 400 });
  }
  if (email !== undefined && email !== null && email !== "" && typeof email !== "string") {
    return NextResponse.json({ error: "Email must be a string." }, { status: 400 });
  }
  if (typeof steps !== "number" || !Number.isFinite(steps) || !Number.isInteger(steps)) {
    return NextResponse.json({ error: "Steps must be a whole number." }, { status: 400 });
  }
  if (steps < 0 || steps > MAX_STEPS) {
    return NextResponse.json(
      { error: `Steps must be between 0 and ${MAX_STEPS.toLocaleString()}.` },
      { status: 400 }
    );
  }
  if (typeof entry_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry_date)) {
    return NextResponse.json({ error: "Entry date must be in YYYY-MM-DD format." }, { status: 400 });
  }
  if (screenshot !== undefined && screenshot !== null) {
    if (typeof screenshot !== "string" || !/^data:image\/[a-zA-Z0-9+.-]+;base64,/.test(screenshot)) {
      return NextResponse.json({ error: "Screenshot must be an image data URL." }, { status: 400 });
    }
    if (screenshot.length > MAX_SCREENSHOT_BASE64_CHARS) {
      return NextResponse.json({ error: "Screenshot is too large. Please use a smaller image." }, { status: 400 });
    }
  }

  const { startDate, endDate } = getWeekRange();
  if (entry_date < startDate || entry_date > endDate) {
    return NextResponse.json(
      { error: `Entry date must fall within the current week (${startDate} to ${endDate}).` },
      { status: 400 }
    );
  }

  const normalizedEmail = typeof email === "string" && email.trim() !== "" ? email.trim() : null;
  const screenshotDataUrl = typeof screenshot === "string" ? screenshot : null;

  // Local dev fallback: no Supabase env vars configured, so use an
  // in-memory store instead (not persisted, resets on server restart). The
  // screenshot is kept as-is (a base64 data URL) rather than uploaded
  // anywhere, which is enough to preview it in the browser.
  if (!isSupabaseConfigured()) {
    const data = upsertStepEntry({
      name: name.trim(),
      email: normalizedEmail,
      steps,
      entry_date,
      screenshot_url: screenshotDataUrl,
    });
    return NextResponse.json({ data, store: "memory" }, { status: 200 });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase is not configured." },
      { status: 500 }
    );
  }

  let screenshotUrl: string | null = null;
  if (screenshotDataUrl) {
    try {
      screenshotUrl = await uploadScreenshotToSupabase(screenshotDataUrl, name.trim());
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Screenshot upload failed." },
        { status: 500 }
      );
    }
  }

  const { data, error } = await supabase
    .from("steps")
    .upsert(
      {
        name: name.trim(),
        email: normalizedEmail,
        steps,
        entry_date,
        ...(screenshotUrl ? { screenshot_url: screenshotUrl } : {}),
      },
      { onConflict: "name,entry_date" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}
