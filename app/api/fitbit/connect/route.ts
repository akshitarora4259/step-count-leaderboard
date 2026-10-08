import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl, getFitbitRedirectUri, isFitbitConfigured } from "@/lib/fitbit";
import { connectMock } from "@/lib/fitbitMock";

const MAX_NAME_LENGTH = 100;

/**
 * Starts the "Connect Fitbit" flow.
 *
 * Real mode: redirects to Fitbit's OAuth2 authorize page. The participant's
 * name/email are packed into the OAuth `state` param (base64url JSON) so
 * they survive the round trip to Fitbit and back — this app has no login
 * system, so there's no server session to stash them in.
 *
 * Mock mode (no FITBIT_CLIENT_ID/SECRET configured): skips the OAuth round
 * trip entirely and immediately creates a simulated connection with sample
 * step data, so the whole flow can be tried locally with zero setup.
 */
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")?.trim() ?? "";
  const email = request.nextUrl.searchParams.get("email")?.trim() || null;

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: "Name is too long." }, { status: 400 });
  }

  const origin = request.nextUrl.origin;

  if (!isFitbitConfigured()) {
    try {
      await connectMock(name, email);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mock connect failed.";
      return NextResponse.redirect(`${origin}/?fitbit_error=${encodeURIComponent(message)}`);
    }
    const params = new URLSearchParams({ connected: "1", mock: "1", name });
    return NextResponse.redirect(`${origin}/?${params.toString()}`);
  }

  const state = Buffer.from(JSON.stringify({ name, email })).toString("base64url");
  const redirectUri = getFitbitRedirectUri(request.url);
  const authorizeUrl = buildAuthorizeUrl(state, redirectUri);

  return NextResponse.redirect(authorizeUrl);
}
