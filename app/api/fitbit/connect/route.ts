import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl, getFitbitRedirectUri, isFitbitConfigured } from "@/lib/fitbit";
import { connectMock } from "@/lib/fitbitMock";
import { getCurrentIdentity } from "@/lib/identity";

const MAX_NAME_LENGTH = 100;

/**
 * Starts the "Connect Fitbit" flow. Requires a verified session (email-OTP
 * login on `/`) — the signed-in `userId`/`email` are the real identity;
 * `name` is just a free-text display field the participant chose.
 *
 * Real mode: redirects to Fitbit's OAuth2 authorize page. The display
 * `name` (plus the session's `userId`, for a defense-in-depth cross-check
 * in the callback) are packed into the OAuth `state` param (base64url
 * JSON) so they survive the round trip to Fitbit and back.
 *
 * Mock mode (no FITBIT_CLIENT_ID/SECRET configured): skips the OAuth round
 * trip entirely and immediately creates a simulated connection with sample
 * step data, so the whole flow can be tried locally with zero setup.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  const identity = await getCurrentIdentity();
  if (!identity) {
    return NextResponse.redirect(
      `${origin}/?fitbit_error=${encodeURIComponent("Please sign in first.")}`
    );
  }

  const name = request.nextUrl.searchParams.get("name")?.trim() ?? "";

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: "Name is too long." }, { status: 400 });
  }

  if (!isFitbitConfigured()) {
    try {
      await connectMock(identity.userId, name, identity.email);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mock connect failed.";
      return NextResponse.redirect(`${origin}/?fitbit_error=${encodeURIComponent(message)}`);
    }
    const params = new URLSearchParams({ connected: "1", mock: "1", name });
    return NextResponse.redirect(`${origin}/?${params.toString()}`);
  }

  const state = Buffer.from(
    JSON.stringify({ userId: identity.userId, name, email: identity.email })
  ).toString("base64url");
  const redirectUri = getFitbitRedirectUri(request.url);
  const authorizeUrl = buildAuthorizeUrl(state, redirectUri);

  return NextResponse.redirect(authorizeUrl);
}
