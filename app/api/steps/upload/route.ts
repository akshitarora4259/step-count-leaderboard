import { NextRequest, NextResponse } from "next/server";
import { getCurrentIdentity } from "@/lib/identity";
import { isValidEntryDate } from "@/lib/eventWindow";
import { extractStepsAndDateFromImage } from "@/lib/ocr";
import { deleteScreenshot, uploadScreenshot } from "@/lib/screenshotStorage";
import { upsertDailySteps } from "@/lib/steps";
import { formatShortDate, todayISODate } from "@/lib/week";

export const runtime = "nodejs";
// Vercel Hobby defaults to a 10s function timeout; OCR (worker init +
// recognize) can take a few seconds, so give it more headroom. Pro/Fluid
// plans allow longer still if needed.
export const maxDuration = 60;

const MAX_NAME_LENGTH = 100;
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB — generous for a phone screenshot.

/**
 * Daily screenshot upload + server-side OCR.
 *
 * The caller picks which event date (Oct 13–19, 2026) they're uploading for
 * — this lets someone backfill a day they missed, not just "today". One
 * upload per (user, date): re-uploading the same date overwrites that day's
 * screenshot + step count (see migration 0005's unique (user_id, entry_date)
 * index, used as the upsert conflict target).
 *
 * The step count is *always* OCR-only (never typed in) — but if the
 * screenshot itself shows a date, that's cross-checked against the
 * user-selected date so a mismatched upload (wrong day's screenshot) is
 * rejected rather than silently recorded under the wrong date.
 *
 * Atomicity: if OCR can't find a plausible step count, the date is outside
 * the event window, or the screenshot's own date disagrees with the
 * user-selected one, nothing is written — no DB row, and any uploaded file
 * is deleted again. Success always means the screenshot and the DB row are
 * persisted together, for the selected date.
 */
export async function POST(request: NextRequest) {
  const identity = await getCurrentIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const name = String(formData.get("name") ?? "").trim();
  const entryDate = String(formData.get("entryDate") ?? "").trim();
  const file = formData.get("screenshot");

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: "Name is too long." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Please choose a screenshot to upload." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Please upload an image file." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 8MB)." }, { status: 400 });
  }

  const today = todayISODate();
  const dateCheck = isValidEntryDate(entryDate, today);
  if (!dateCheck.ok) {
    return NextResponse.json({ error: dateCheck.error }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let ocr: { steps: number | null; detectedDate: string | null };
  try {
    ocr = await extractStepsAndDateFromImage(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OCR failed.";
    return NextResponse.json(
      { error: `Couldn't read that screenshot (${message}). Please try again.` },
      { status: 422 }
    );
  }

  if (ocr.steps === null) {
    return NextResponse.json(
      {
        error:
          "Couldn't detect a valid step count in that screenshot. Please retry with a clearer image showing just your step total.",
      },
      { status: 422 }
    );
  }

  if (ocr.detectedDate) {
    const screenshotDateCheck = isValidEntryDate(ocr.detectedDate, today);
    if (!screenshotDateCheck.ok) {
      return NextResponse.json(
        {
          error: `This screenshot is dated ${formatShortDate(ocr.detectedDate)}, which is outside the event window. Please upload a screenshot from the event week (Oct 13–19).`,
        },
        { status: 422 }
      );
    }
    if (ocr.detectedDate !== entryDate) {
      return NextResponse.json(
        {
          error: `This screenshot looks like it's from ${formatShortDate(ocr.detectedDate)}, but you selected ${formatShortDate(entryDate)} — please re-check and retry.`,
        },
        { status: 422 }
      );
    }
  }

  const steps = ocr.steps;

  // Upload first, then write the DB row — if the DB write fails, roll back
  // the upload so no orphaned file is left behind (success means both are
  // persisted together; failure means neither is).
  const { path } = await uploadScreenshot(identity.userId, entryDate, buffer, file.type);

  try {
    await upsertDailySteps({
      name,
      email: identity.email,
      userId: identity.userId,
      steps,
      entry_date: entryDate,
      screenshotUrl: path,
    });
  } catch (err) {
    await deleteScreenshot(path);
    const message = err instanceof Error ? err.message : "Failed to save your steps.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ steps, entry_date: entryDate });
}
