import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazily-initialized Supabase client.
 *
 * We avoid reading env vars (and constructing the client) at module load
 * time so that `next build` never hard-fails when NEXT_PUBLIC_SUPABASE_URL /
 * NEXT_PUBLIC_SUPABASE_ANON_KEY aren't set (e.g. CI build checks, or before
 * the real Supabase project is wired up). The client is only created the
 * first time it's actually needed, at request time.
 */
let client: SupabaseClient | null = null;

/** True once NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are both set. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY (see README.md)."
    );
  }

  client = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  return client;
}

export type StepEntry = {
  id: string;
  name: string;
  email: string | null;
  steps: number;
  entry_date: string;
  created_at: string;
  screenshot_url: string | null;
};

export const SCREENSHOTS_BUCKET = "screenshots";

/**
 * Uploads a base64 data URL (as produced by `FileReader.readAsDataURL`) to
 * the public `screenshots` Supabase Storage bucket and returns its public
 * URL. The bucket must already exist with public read access and an anon
 * insert policy (see supabase/migrations/0002_add_screenshot_url.sql and
 * README.md).
 */
export async function uploadScreenshotToSupabase(
  dataUrl: string,
  filenameHint: string
): Promise<string> {
  const match = /^data:(.+);base64,(.*)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Screenshot must be a base64 data URL.");
  }
  const [, mimeType, base64] = match;
  const bytes = Buffer.from(base64, "base64");
  const extension = mimeType.split("/")[1] ?? "png";
  const path = `${Date.now()}-${filenameHint.replace(/[^a-zA-Z0-9_-]/g, "_")}.${extension}`;

  const supabase = getSupabaseClient();
  const { error: uploadError } = await supabase.storage
    .from(SCREENSHOTS_BUCKET)
    .upload(path, bytes, { contentType: mimeType, upsert: false });

  if (uploadError) {
    throw new Error(`Screenshot upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(SCREENSHOTS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
