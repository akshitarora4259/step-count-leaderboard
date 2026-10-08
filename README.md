# Step Count Give Event 🚶

A tiny, deployable web app for a one-week company "step count give event":

- **`/`** — public participation form: enter your name + optional email,
  then **connect your Fitbit account**. Your daily step count syncs in
  automatically all week — no manual entry, no screenshots.
- **`/leaderboard`** — live leaderboard for the current week (Mon–Sun), with a
  ranked table and a top-10 bar chart, auto-refreshing every 30 seconds.

Built with Next.js (App Router, TypeScript), Tailwind CSS, and Supabase
(Postgres) as the database. No login/auth beyond the Fitbit OAuth
connection itself — just name-based entries, since this is a casual
internal event.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- [Supabase](https://supabase.com) (Postgres) via `@supabase/supabase-js`
- [Fitbit Web API](https://dev.fitbit.com/build/reference/web-api/) (OAuth2) for automatic step sync
- [Recharts](https://recharts.org) for the bar chart
- Deploys for free on [Vercel](https://vercel.com)

## Why Fitbit?

Apple Health has no public web API (it's native-app only, with no
server-side OAuth equivalent), and Google Fit's REST API is being
deprecated in 2026. Fitbit's Web API is the only realistic option for
automatic, web-based step-count sync for a one-week event like this: it's a
free, self-serve OAuth2 integration, and anyone with a Fitbit account (or a
phone that syncs its step data into Fitbit) can connect to it.

## How the Fitbit integration works

1. A participant enters their name (+ optional email) and clicks
   **Connect Fitbit**. They're redirected to Fitbit's OAuth2 authorize page
   and asked to grant **read-only `activity` access** (their step count —
   nothing else).
2. After authorizing, Fitbit redirects back to `/api/fitbit/callback`,
   which exchanges the authorization code for an access + refresh token
   pair. These tokens are **encrypted (AES-256-GCM)** before being stored in
   a dedicated `fitbit_connections` table that is **only reachable
   server-side** (via the Supabase service role key — see below) — they are
   never sent to the browser.
3. Steps sync in three ways, so you don't strictly need all of them set up:
   - **Immediately on connect** — the callback runs one sync right away.
   - **"Sync now"** — a button on the form page participants can click
     anytime.
   - **Automatically** — either via [Vercel Cron](#vercel-cron-optional) on
     a schedule, or a lightweight "lazy sync" that runs (throttled to once
     every 5 minutes) whenever the leaderboard page loads.
4. Access tokens expire roughly every 8 hours; the sync logic transparently
   refreshes them using the long-lived refresh token (see
   [`lib/fitbitSync.ts`](./lib/fitbitSync.ts)) — participants never have to
   reconnect mid-week because of this.
5. **Disconnect** is front-and-center on the form page: it revokes the
   Fitbit token via Fitbit's `/oauth2/revoke` endpoint, then deletes both
   the stored connection and every step entry it produced. Participants
   should be able to trust they can opt out anytime during the week.

## Trying it locally with zero setup (mock mode)

If `FITBIT_CLIENT_ID` / `FITBIT_CLIENT_SECRET` aren't set, clicking
**Connect Fitbit** skips the real OAuth round trip entirely: it immediately
creates a simulated ("mock") connection and generates a few days of
randomized sample step data for the current week, so you can try the full
connect → synced data → leaderboard → disconnect flow without ever
registering a Fitbit app. This is clearly labeled "(demo mode)" in the UI
wherever it shows up.

Independently, if Supabase env vars aren't set, both step data and Fitbit
connections fall back to a simple in-memory store (see
[`lib/memoryStore.ts`](./lib/memoryStore.ts)) — not persisted, resets on
server restart, fine for local dev only.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Connect
Fitbit** — you'll see sample data appear within a second or two, and it'll
show up on [http://localhost:3000/leaderboard](http://localhost:3000/leaderboard).

## Setting it up for real

### 1. Create a free Supabase project and run the migrations

1. Go to [supabase.com](https://supabase.com) and sign up (free tier is
   plenty for this event).
2. Click **New project**. Pick an org, name (e.g. `step-count-event`), a
   database password, and a region. Wait for it to finish provisioning.
3. Open your new project, go to the **SQL Editor** (left sidebar), click
   **New query**, and run each migration file **in order**:
   - [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql) —
     creates the `steps` table, a unique index on `(name, entry_date)` so
     re-syncing the same day updates instead of duplicating, and permissive
     Row Level Security policies (public read/insert/update — fine for a
     casual internal event with no login).
   - [`supabase/migrations/0002_add_screenshot_url.sql`](./supabase/migrations/0002_add_screenshot_url.sql) —
     historical; adds an unused `screenshot_url` column from an earlier
     screenshot+OCR entry flow that this app no longer uses. Harmless to
     run, kept for anyone who already ran it / for history.
   - [`supabase/migrations/0003_fitbit_connections.sql`](./supabase/migrations/0003_fitbit_connections.sql) —
     creates the `fitbit_connections` table (encrypted OAuth tokens), with
     Row Level Security enabled and **no policies** — meaning the anon key
     gets zero access to it. Only the service role key (server-side only)
     can read/write it.
   - Alternatively, if you have the [Supabase CLI](https://supabase.com/docs/guides/cli)
     installed and linked to your project, run `supabase db push` from this
     repo instead of using the SQL editor.
4. Go to **Project Settings → API**. You'll need three values from there:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** API key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

> The anon key is safe to expose client-side for the `steps` table — it
> only works through the Row Level Security policies defined in the
> migrations. The **service role key is different**: it bypasses RLS
> entirely, which is why it's required specifically for
> `fitbit_connections` (storing OAuth tokens) and must **only** ever be set
> as a server-side env var (never `NEXT_PUBLIC_...`, never sent to the
> browser).

### 2. Register a free Fitbit developer app

1. Go to [dev.fitbit.com/apps/new](https://dev.fitbit.com/apps/new) and log
   in with (or create) a Fitbit account.
2. Fill in the application registration form:
   - **Application Name**: e.g. "Company Step Challenge"
   - **OAuth 2.0 Application Type**: **Server**
   - **Callback URL**: `https://your-app.vercel.app/api/fitbit/callback`
     for production, and/or `http://localhost:3000/api/fitbit/callback` for
     local testing (you can register multiple callback URLs, one per line).
   - Everything else can be filled in reasonably (personal/internal use is
     fine for a self-serve Fitbit app).
3. After creating the app, copy the **OAuth 2.0 Client ID** and **Client
   Secret** from the app's settings page.

### 3. Configure environment variables

Copy the example file and fill in your real values:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

FITBIT_CLIENT_ID=your-fitbit-client-id
FITBIT_CLIENT_SECRET=your-fitbit-client-secret
FITBIT_REDIRECT_URI=http://localhost:3000/api/fitbit/callback

TOKEN_ENCRYPTION_KEY=some-long-random-string
CRON_SECRET=some-other-long-random-string
```

- `FITBIT_REDIRECT_URI` must **exactly** match a callback URL registered
  with your Fitbit app (including the path). Use the `localhost` one
  locally, and your real Vercel URL (e.g.
  `https://your-app.vercel.app/api/fitbit/callback`) in production.
- `TOKEN_ENCRYPTION_KEY` is used to encrypt Fitbit tokens before they're
  stored. Set a real random value in production — see
  [`lib/crypto.ts`](./lib/crypto.ts) for what happens if it's unset (a
  dev-only fallback key is used, which is **not** safe for production).
- `CRON_SECRET` is optional — see [Vercel Cron](#vercel-cron-optional)
  below.

All of these are required at runtime for the *real* Fitbit + Supabase path.
The build itself succeeds even without them (everything is lazily
initialized), and — per [mock mode](#trying-it-locally-with-zero-setup-mock-mode) —
the app is still fully usable locally without any of them set.

### 4. Deploy to Vercel for free

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. In the import screen (or afterwards under **Project Settings →
   Environment Variables**), add all the variables listed above, with
   `FITBIT_REDIRECT_URI` pointing at your real Vercel URL.
4. Click **Deploy**. Vercel will build and host it on a free
   `your-project.vercel.app` URL.
5. Go back to your Fitbit app settings at dev.fitbit.com and make sure the
   production callback URL is registered there too.

### Vercel Cron (optional)

[`vercel.json`](./vercel.json) includes a daily cron job that hits
`/api/fitbit/sync` once a day (`0 6 * * *`, i.e. ~6am UTC) to sync
everyone's steps — this just needs your Vercel project deployed, no extra
setup. The **Hobby (free) plan only allows one cron run per day**; if you
want more frequent automatic syncing, upgrade to Vercel Pro and adjust the
schedule in `vercel.json`. Either way, the **"Sync now" button** on the form
page and the **lazy sync on leaderboard load** (throttled to once every 5
minutes) keep data reasonably fresh in between.

If you set `CRON_SECRET`, Vercel Cron automatically sends it as
`Authorization: Bearer <CRON_SECRET>` when it calls your cron endpoints,
and `/api/fitbit/sync` checks for that header — this stops random internet
traffic from triggering syncs. It's optional; without it, the sync endpoint
is simply open (fine for a short internal event).

### 5. Share the link with participants

Once deployed, share the Vercel URL (e.g. `https://your-project.vercel.app`)
directly, or set up a custom/shared short link (e.g. an internal `go/`
link, or a service like Bitly) that points at it. Participants enter their
name and connect Fitbit at the root URL; anyone can check `/leaderboard`
for live standings.

## Data model

See [`supabase/migrations/`](./supabase/migrations/) for the full SQL.

**`steps`** — one row per participant per day:

| column       | type      | notes                                   |
| ------------ | --------- | ---------------------------------------- |
| `id`         | uuid (pk) | default `gen_random_uuid()`             |
| `name`       | text      | participant's display name              |
| `email`      | text      | optional, used only for de-duping       |
| `steps`      | integer   | synced from Fitbit (0–100,000 sanity cap) |
| `entry_date` | date      | the day the steps were logged           |
| `created_at` | timestamp | default `now()`                         |

A unique index on `(name, entry_date)` means re-syncing the same name for
the same day **updates** that day's entry (upsert) rather than creating a
duplicate row.

**`fitbit_connections`** — one row per connected participant (server-only, not exposed via the anon key):

| column             | type      | notes                                        |
| ------------------ | --------- | --------------------------------------------- |
| `id`               | uuid (pk) | default `gen_random_uuid()`                  |
| `name`             | text      | participant's display name (unique, case-insensitive) |
| `email`            | text      | optional                                     |
| `fitbit_user_id`   | text      | Fitbit's user identifier                     |
| `access_token`     | text      | encrypted (AES-256-GCM)                      |
| `refresh_token`    | text      | encrypted (AES-256-GCM)                      |
| `token_expires_at` | timestamp | used to decide when to refresh               |
| `is_mock`          | boolean   | true for local "demo mode" connections       |
| `connected_at`     | timestamp | default `now()`                              |
| `updated_at`       | timestamp | bumped on every token refresh                |

## Extending

The current-week (Mon–Sun) date range is computed in
[`lib/week.ts`](./lib/week.ts) via `getWeekRange()`, which accepts an
optional reference date. This is intentionally decoupled from "today" so a
future "week selector" UI can reuse it for past/future weeks without
touching the aggregation logic in `app/api/leaderboard/route.ts`.

The Fitbit OAuth + sync logic is split across a few small modules so each
piece can be swapped independently:
[`lib/fitbit.ts`](./lib/fitbit.ts) (raw Fitbit API calls),
[`lib/fitbitConnections.ts`](./lib/fitbitConnections.ts) (connection storage,
Supabase vs. in-memory), [`lib/fitbitSync.ts`](./lib/fitbitSync.ts)
(token refresh + per-participant sync), and
[`lib/fitbitMock.ts`](./lib/fitbitMock.ts) (local demo mode).
