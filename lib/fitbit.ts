/**
 * Fitbit Web API (OAuth2 Authorization Code flow) helpers.
 *
 * Fitbit is the only realistic option for automatic, web-based step-count
 * sync for this event: Apple Health has no public web API (native-app
 * only), and Google Fit's API is being deprecated in 2026. Fitbit's Web API
 * is a self-serve OAuth2 integration that any participant with a Fitbit
 * account (or a phone that syncs into Fitbit) can connect.
 *
 * Docs: https://dev.fitbit.com/build/reference/web-api/
 */

const AUTHORIZE_URL = "https://www.fitbit.com/oauth2/authorize";
const TOKEN_URL = "https://api.fitbit.com/oauth2/token";
const REVOKE_URL = "https://api.fitbit.com/oauth2/revoke";
const API_BASE = "https://api.fitbit.com/1/user/-";

/** Requested OAuth2 scope — read-only access to step/activity data. */
const SCOPE = "activity";

export function isFitbitConfigured(): boolean {
  return Boolean(process.env.FITBIT_CLIENT_ID && process.env.FITBIT_CLIENT_SECRET);
}

/**
 * Resolves the OAuth redirect URI. Prefers the explicit FITBIT_REDIRECT_URI
 * env var (required for production, since it must exactly match what's
 * registered in the Fitbit developer console); falls back to deriving it
 * from the current request's origin, which is convenient for local dev.
 */
export function getFitbitRedirectUri(requestUrl: string): string {
  if (process.env.FITBIT_REDIRECT_URI) return process.env.FITBIT_REDIRECT_URI;
  const origin = new URL(requestUrl).origin;
  return `${origin}/api/fitbit/callback`;
}

function basicAuthHeader(): string {
  const id = process.env.FITBIT_CLIENT_ID ?? "";
  const secret = process.env.FITBIT_CLIENT_SECRET ?? "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export function buildAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.FITBIT_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    scope: SCOPE,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export type FitbitTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string;
  scope: string;
  token_type: string;
};

async function postForm(url: string, body: URLSearchParams): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Fitbit request to ${url} failed (${res.status}): ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<FitbitTokenResponse> {
  const data = await postForm(
    TOKEN_URL,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.FITBIT_CLIENT_ID ?? "",
    })
  );
  return data as unknown as FitbitTokenResponse;
}

export async function refreshFitbitToken(refreshToken: string): Promise<FitbitTokenResponse> {
  const data = await postForm(
    TOKEN_URL,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
  return data as unknown as FitbitTokenResponse;
}

/** Best-effort token revocation — failures (e.g. already revoked) are swallowed by the caller. */
export async function revokeFitbitToken(accessToken: string): Promise<void> {
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token: accessToken }),
  });
}

export type DailySteps = { date: string; steps: number };

/** Fetches daily step totals for [startDate, endDate] (inclusive, YYYY-MM-DD) in one call. */
export async function fetchStepsForRange(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<DailySteps[]> {
  const res = await fetch(`${API_BASE}/activities/steps/date/${startDate}/${endDate}.json`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Fitbit steps fetch failed (${res.status}): ${text}`);
  }
  const body = JSON.parse(text) as { "activities-steps"?: { dateTime: string; value: string }[] };
  const series = body["activities-steps"] ?? [];
  return series.map((entry) => ({ date: entry.dateTime, steps: Number(entry.value) || 0 }));
}
