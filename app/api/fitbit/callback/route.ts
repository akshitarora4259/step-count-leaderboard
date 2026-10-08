import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, getFitbitRedirectUri } from "@/lib/fitbit";
import { upsertConnection } from "@/lib/fitbitConnections";
import { syncByName } from "@/lib/fitbitSync";

/**
 * Fitbit redirects here after the user authorizes (or denies) access. We
 * exchange the authorization `code` for tokens, persist the (encrypted)
 * connection, kick off an initial sync so the leaderboard has data right
 * away, then redirect back to the submission form with a friendly banner.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/?fitbit_error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(
      `${origin}/?fitbit_error=${encodeURIComponent("Missing authorization code from Fitbit.")}`
    );
  }

  let name: string;
  let email: string | null;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    name = String(decoded.name ?? "").trim();
    email = decoded.email ? String(decoded.email) : null;
    if (!name) throw new Error("Missing name in state.");
  } catch {
    return NextResponse.redirect(
      `${origin}/?fitbit_error=${encodeURIComponent("Invalid OAuth state.")}`
    );
  }

  try {
    const redirectUri = getFitbitRedirectUri(request.url);
    const token = await exchangeCodeForToken(code, redirectUri);

    await upsertConnection({
      name,
      email,
      fitbitUserId: token.user_id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      isMock: false,
    });

    // Best-effort initial sync so the leaderboard reflects this week's steps
    // immediately, rather than waiting for the next cron run / lazy sync.
    await syncByName(name);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fitbit connection failed.";
    return NextResponse.redirect(`${origin}/?fitbit_error=${encodeURIComponent(message)}`);
  }

  const params = new URLSearchParams({ connected: "1", name });
  return NextResponse.redirect(`${origin}/?${params.toString()}`);
}
