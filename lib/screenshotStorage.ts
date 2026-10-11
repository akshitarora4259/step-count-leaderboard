import { getSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase";

/**
 * Private Supabase Storage bucket for daily step-count screenshots (see
 * supabase/migrations/0006_screenshot_storage.sql for the bucket + RLS
 * policies). Scoped by `{userId}/...` path prefix so each participant can
 * only ever read/write their own files, even if a client somehow bypassed
 * the API route and talked to Storage directly with a user JWT.
 */
const BUCKET = "step-screenshots";

export type UploadedScreenshot = {
  /** `{userId}/{entry_date}.{ext}` — stored in `steps.screenshot_url` (a path, not a public URL, since the bucket is private). */
  path: string;
};

function extensionForContentType(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

/**
 * Uploads (or overwrites, for a same-day re-upload) a participant's
 * screenshot. In mock mode (no Supabase admin client configured), this is a
 * no-op that just returns the path the real path would have been — local
 * dev doesn't need the bytes persisted anywhere, only the OCR'd step count
 * that gets written to the DB alongside it.
 */
export async function uploadScreenshot(
  userId: string,
  entryDate: string,
  buffer: Buffer,
  contentType: string
): Promise<UploadedScreenshot> {
  const path = `${userId}/${entryDate}.${extensionForContentType(contentType)}`;

  if (!isSupabaseAdminConfigured()) {
    return { path };
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Failed to upload screenshot: ${error.message}`);
  }

  return { path };
}

/**
 * Best-effort cleanup — used to roll back a successfully-uploaded file when
 * a later step (the DB upsert) fails, so a failure never leaves an orphaned
 * file with no corresponding row. Swallows its own errors so a cleanup
 * failure doesn't mask the original error that triggered the rollback.
 */
export async function deleteScreenshot(path: string): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // Non-fatal — see comment above.
  }
}
