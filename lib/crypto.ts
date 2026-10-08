import crypto from "crypto";

/**
 * Lightweight at-rest encryption for Fitbit OAuth tokens (AES-256-GCM).
 *
 * Tokens are encrypted here before they're ever written to Supabase (or the
 * in-memory dev store), and only decrypted server-side, in-process, right
 * before they're used to call Fitbit's API. They are never sent to the
 * browser in any API response.
 *
 * Set TOKEN_ENCRYPTION_KEY in production (any long random string — it's
 * hashed into a 256-bit key below, so it doesn't need to be exactly 32
 * bytes). Without it, a fixed dev-only key is used so local/mock-mode usage
 * doesn't require extra setup — this is NOT safe for production, which is
 * why real Fitbit credentials should always be paired with a real
 * TOKEN_ENCRYPTION_KEY (see README.md).
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY ?? "dev-only-insecure-default-key";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptToken(encoded: string): string {
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
