import { NextRequest, NextResponse } from "next/server";
import { getCurrentIdentity } from "@/lib/identity";
import { extractStepCountFromImage } from "@/lib/ocr";
import { deleteScreenshot, uploadScreenshot } from "@/lib/screenshotStorage";
import { upsertDailySteps } from "@/lib/steps";
import { todayISODate } from "@/lib/week";

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
 * Always submits for *today's* date (see requirement: no date picker — this
 * is a daily capture). One upload per day per user: re-uploading the same
 * day overwrites that day's screenshot + step count (see migration 0005's
 * unique (user_id, entry_date) index, used as the upsert conflict target).
 *
 * Atomicity: if OCR can't find a plausible step count, nothing is written —
 * no DB row, and any uploaded file is deleted again. Success always means
 * the screenshot and the DB row are persisted together.
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

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let steps: number | null;
  try {
    steps = await extractStepCountFromImage(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OCR failed.";
    return NextResponse.json(
      { error: `Couldn't read that screenshot (${message}). Please try again.` },
      { status: 422 }
    );
  }

  if (steps === null) {
    return NextResponse.json(
      {
        error:
          "Couldn't detect a valid step count in that screenshot. Please retry with a clearer image showing just your step total.",
      },
      { status: 422 }
    );
  }

  const entryDate = todayISODate();

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
