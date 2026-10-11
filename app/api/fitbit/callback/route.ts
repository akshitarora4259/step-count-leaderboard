import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, getFitbitRedirectUri } from "@/lib/fitbit";
import { assertFitbitUserIdAvailable, upsertConnection } from "@/lib/fitbitConnections";
import { syncByUserId } from "@/lib/fitbitSync";
import { getCurrentIdentity } from "@/lib/identity";

/**
 * Fitbit redirects here after the user authorizes (or denies) access. We
 * exchange the authorization `code` for tokens, persist the (encrypted)
 * connection, kick off an initial sync so the leaderboard has data right
 * away, then redirect back to the submission form with a friendly banner.
 *
 * Identity comes from the current session (re-checked here, not just
 * trusted from the OAuth `state`), with `state.userId` cross-checked as a
 * defense-in-depth guard against a forged/replayed `state` value.
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

  const identity = await getCurrentIdentity();
  if (!identity) {
    return NextResponse.redirect(
      `${origin}/?fitbit_error=${encodeURIComponent("Your session expired — please sign in and try again.")}`
    );
  }

  let name: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    name = String(decoded.name ?? "").trim();
    if (!name) throw new Error("Missing name in state.");
    if (decoded.userId && decoded.userId !== identity.userId) {
      throw new Error("Session mismatch — please retry connecting.");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid OAuth state.";
    return NextResponse.redirect(`${origin}/?fitbit_error=${encodeURIComponent(message)}`);
  }

  try {
    const redirectUri = getFitbitRedirectUri(request.url);
    const token = await exchangeCodeForToken(code, redirectUri);

    // Validate the fitbit_user_id uniqueness rule BEFORE writing anything —
    // if this same real Fitbit account is already linked to a different
    // signed-in identity, bail out here so no partial/stale row is ever
    // created and the user can always retry cleanly.
    await assertFitbitUserIdAvailable(token.user_id, identity.userId);

    await upsertConnection({
      name,
      email: identity.email,
      userId: identity.userId,
      fitbitUserId: token.user_id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      isMock: false,
    });
  } catch (err) {
    // Token exchange, the uniqueness check, or the connection write itself
    // failed — nothing was persisted (the Supabase upsert is a single
    // atomic statement, and the in-memory store only mutates after its own
    // uniqueness check passes), so the user can simply retry "Connect Fitbit".
    const message = err instanceof Error ? err.message : "Fitbit connection failed.";
    return NextResponse.redirect(`${origin}/?fitbit_error=${encodeURIComponent(message)}`);
  }

  // The connection itself succeeded at this point. The initial sync is
  // genuinely best-effort — a lazy sync / cron run will pick up this
  // participant's steps later regardless — so a failure here must NOT
  // undo the successful link or strand the user; just surface a soft
  // warning instead of a hard error.
  let syncWarning: string | null = null;
  try {
    await syncByUserId(identity.userId);
  } catch (err) {
    console.error(`Initial Fitbit sync after connect failed for "${name}":`, err);
    syncWarning = "Connected! Step sync will catch up shortly.";
  }

  const params = new URLSearchParams({ connected: "1", name });
  if (syncWarning) {
    params.set("fitbit_warning", syncWarning);
  }
  return NextResponse.redirect(`${origin}/?${params.toString()}`);
}
