# Step Count Give Event 🚶

A tiny, deployable web app for a one-week company "step count give event":

- **`/`** — participation form, gated behind **email-OTP sign-in**: verify
  your work email with a one-time code, enter your name, then **upload a
  screenshot of your phone's step counter**. We read the step count
  straight out of the image (server-side OCR) — no typing a number, no
  external API keys required.
- **`/leaderboard`** — live leaderboard for the current week (Mon–Sun), with a
  ranked table and a top-10 bar chart, auto-refreshing every 30 seconds.
  Fully public, no sign-in required to view.

Built with Next.js (App Router, TypeScript), Tailwind CSS, and Supabase
(Postgres + Auth) as the database/identity provider. Participants verify
their email via Supabase Auth's email-OTP flow — that `user_id` (not a
self-reported name) is what actually gates who can upload/own step data,
since this is a casual internal event that still needed to stop one
participant from being able to tamper with another's data.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- [Supabase](https://supabase.com) (Postgres + Auth + Storage) via `@supabase/supabase-js` and `@supabase/ssr`
- [tesseract.js](https://github.com/naptha/tesseract.js) for server-side OCR (pure JS/WASM, **no external API key or cost**)
- [Recharts](https://recharts.org) for the bar chart
- Deploys for free on [Vercel](https://vercel.com)

## Identity: email-OTP sign-in via Supabase Auth

Participants sign in on `/` with a one-time code sent to their email
(Supabase Auth's built-in email-OTP flow — no passwords, no separate
account to create). Once verified, that session's `user_id` becomes the
real authorization boundary:

- **`steps`** rows are tied to `user_id`, not a self-reported name — so
  every upload action can only ever write the signed-in caller's own row.
  Identity comes from the session cookie, never from the request body.
- **`name` stays a free-text display field** — participants can still pick
  whatever name they want to show on the leaderboard; it's just no longer
  the thing that gates access to their own row.
- **The leaderboard stays fully public and read-only** — no sign-in needed
  to view `/leaderboard`, and it still aggregates by display `name` exactly
  as before.
- A Next.js middleware ([`middleware.ts`](./middleware.ts)) refreshes the
  Supabase Auth session cookie on every request, per Supabase's official
  `@supabase/ssr` App Router pattern.

## How the screenshot + OCR flow works

1. After signing in and entering a display name, a participant drags/drops
   (or picks) a screenshot of their phone's step-count screen. This always
   submits for **today's date** — there's no date picker, it's a daily
   capture.
2. On submit, the image is uploaded to a **private** Supabase Storage
   bucket (`step-screenshots`, scoped per-user — see
   [migration `0006`](./supabase/migrations/0006_screenshot_storage.sql)),
   and OCR runs **server-side** with tesseract.js against the image buffer
   (see [`lib/ocr.ts`](./lib/ocr.ts)) — no third-party OCR API, nothing
   billed per request.
3. The OCR'd text is parsed for the step count: commas/spaces are stripped,
   then the **longest contiguous run of digits** is taken as the step
   count, and validated to be within a plausible 0–100,000 daily range.
4. **Atomicity**: if no plausible number is found, nothing is written —
   no DB row, and the just-uploaded screenshot is deleted again — so a
   failed OCR attempt never leaves a stray file or a broken retry state.
   The user sees a clear inline error and can immediately retry with a
   clearer screenshot.
5. On success, the detected count is shown right away ("Detected 8,432
   steps ✅ Recorded for today") and the leaderboard updates on its next
   poll.
6. **One upload per day per person**: re-uploading on the same day
   **replaces** that day's screenshot + step count (an upsert keyed on
   `(user_id, entry_date)`, from migration `0005`), rather than creating a
   duplicate entry.

## Trying it locally with zero setup (mock mode)

If Supabase env vars aren't set, **sign-in is mocked too**: typing an email
and clicking "Continue (demo mode)" logs you in instantly with no real OTP
round trip, storing a simple session cookie
(see [`lib/mockAuth.ts`](./lib/mockAuth.ts)) — clearly labeled "(demo
mode)" in the UI.

Independently, if Supabase env vars aren't set, step data falls back to a
simple in-memory store (see [`lib/memoryStore.ts`](./lib/memoryStore.ts))
and screenshot uploads are a no-op (the bytes aren't persisted anywhere
locally — only the OCR'd step count matters for the demo) — not persisted
across restarts, fine for local dev only. **OCR itself always runs for
real** (tesseract.js needs no external project/keys), so the detection
flow you see locally is the same code path that runs in production.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter any email and
click **Continue (demo mode)**, enter your name, then drag in any
screenshot (or photo) with a visible number on it and click **Upload &
Detect Steps** — the detected count will show up within a few seconds, and
on [http://localhost:3000/leaderboard](http://localhost:3000/leaderboard).

## Setting it up for real

### 1. Create a free Supabase project and run the migrations

1. Go to [supabase.com](https://supabase.com) and sign up (free tier is
   plenty for this event).
2. Click **New project**. Pick an org, name (e.g. `step-count-event`), a
   database password, and a region. Wait for it to finish provisioning.
3. Open your new project, go to the **SQL Editor** (left sidebar), click
   **New query**, and run each migration file **in order**:
   - [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql) —
     creates the `steps` table and a basic index on `(name, entry_date)`.
   - [`supabase/migrations/0002_add_screenshot_url.sql`](./supabase/migrations/0002_add_screenshot_url.sql) —
     adds the `screenshot_url` column (reused by the current flow to store
     the path of each day's uploaded screenshot) and sets up an earlier,
     now-unused public "screenshots" bucket's policies. Harmless to run as
     historical context; the bucket those policies reference is superseded
     by migration `0006` below.
   - [`supabase/migrations/0003_fitbit_connections.sql`](./supabase/migrations/0003_fitbit_connections.sql)
     and [`0004_fitbit_user_id_unique.sql`](./supabase/migrations/0004_fitbit_user_id_unique.sql) —
     historical: created a `fitbit_connections` table for a since-abandoned
     Fitbit OAuth integration (Fitbit's developer platform is being retired
     — see below). The app no longer reads or writes this table, but the
     migrations are left in place/harmless rather than dropped, since a
     live project may have already applied them.
   - [`supabase/migrations/0005_auth_identity.sql`](./supabase/migrations/0005_auth_identity.sql) —
     adds `user_id` (references `auth.users`) to `steps`, adds a
     `user_id`-scoped unique index (so a re-upload the same day replaces
     rather than duplicates), and revokes public anon **write** access to
     `steps` (keeps public **read** access, so the leaderboard stays fully
     unauthenticated). This is what makes Supabase Auth's email-OTP sign-in
     the real identity boundary — see [Identity](#identity-email-otp-sign-in-via-supabase-auth)
     above.
   - [`supabase/migrations/0006_screenshot_storage.sql`](./supabase/migrations/0006_screenshot_storage.sql) —
     creates the **private** `step-screenshots` Storage bucket (via SQL —
     no manual dashboard step needed) with RLS policies scoping each file
     to its owning user's folder (`{user_id}/{date}.ext`).
   - Alternatively, if you have the [Supabase CLI](https://supabase.com/docs/guides/cli)
     installed and linked to your project, run `supabase db push` from this
     repo instead of using the SQL editor.
4. Go to **Project Settings → Authentication → Email** and confirm "Enable
   email provider" / email OTP is on (it is by default on a fresh project —
   this is what powers the `/` sign-in flow).
5. Go to **Project Settings → API**. You'll need three values from there:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** API key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

> The anon key is safe to expose client-side for the `steps` table — it
> only works through the Row Level Security policies defined in the
> migrations. The **service role key is different**: it bypasses RLS
> entirely. It's required server-side so API routes can write `steps` rows
> and upload to the private `step-screenshots` bucket after they've already
> verified the caller's session — it must **only** ever be set as a
> server-side env var (never `NEXT_PUBLIC_...`, never sent to the browser).

### 2. Configure environment variables

Copy the example file and fill in your real values:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

All three are required at runtime for the *real* Supabase path. The build
itself succeeds even without them (everything is lazily initialized), and —
per [mock mode](#trying-it-locally-with-zero-setup-mock-mode) — the app is
still fully usable locally without any of them set, including OCR, which
needs no credentials at all.

### 3. Deploy to Vercel for free

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. In the import screen (or afterwards under **Project Settings →
   Environment Variables**), add the three Supabase variables listed above.
4. Click **Deploy**. Vercel will build and host it on a free
   `your-project.vercel.app` URL.

> The OCR upload route (`/api/steps/upload`) runs on the Node.js runtime
> (tesseract.js needs Node, not Edge) with an extended `maxDuration` of 60
> seconds to leave headroom for worker init + recognition — this fits
> comfortably within Vercel's free Hobby plan function limits.

### 4. Share the link with participants

Once deployed, share the Vercel URL (e.g. `https://your-project.vercel.app`)
directly, or set up a custom/shared short link (e.g. an internal `go/`
link, or a service like Bitly) that points at it. Participants sign in,
enter their name, and upload a screenshot at the root URL; anyone can check
`/leaderboard` for live standings.

## Data model

See [`supabase/migrations/`](./supabase/migrations/) for the full SQL.

**`steps`** — one row per participant per day:

| column          | type      | notes                                   |
| --------------- | --------- | ---------------------------------------- |
| `id`            | uuid (pk) | default `gen_random_uuid()`             |
| `name`          | text      | participant's display name (cosmetic only — see below) |
| `email`         | text      | optional, used only for de-duping       |
| `user_id`       | uuid      | references `auth.users(id)` — the real identity/owner |
| `steps`         | integer   | OCR'd from the uploaded screenshot (0–100,000 sanity cap) |
| `entry_date`    | date      | always today's date at upload time      |
| `screenshot_url`| text      | Storage path of the source screenshot (private bucket, not a public URL) |
| `created_at`    | timestamp | default `now()`                         |

A unique index on `(user_id, entry_date)` (added in migration `0005`) means
re-uploading for the same participant on the same day **updates** that
day's entry (upsert) rather than creating a duplicate row. `name` is purely
a display field now — two different signed-in people can share a display
name without conflict; what actually identifies "whose row is this" is
`user_id`. Public **read** access remains on this table (so `/leaderboard`
stays fully unauthenticated); public **write** access was revoked in
migration `0005` — all writes go through the service-role client,
server-side, after the writing route has verified the caller's session.

## Why screenshot + OCR instead of an auto-sync integration?

This app originally auto-synced steps via the Fitbit Web API. That's no
longer an option: Fitbit's developer platform is being shut down, and its
likely replacement (Google Health Connect / Health API) requires per-user
manual allowlisting plus a companion mobile app install — far too much
setup friction for a casual one-week internal event. Screenshot upload with
automatic OCR gets back to "no typing, no setup" for participants (just
snap a photo of whatever step-tracking app they already use) without
depending on any OAuth platform's availability.

## Extending

The current-week (Mon–Sun) date range is computed in
[`lib/week.ts`](./lib/week.ts) via `getWeekRange()`, which accepts an
optional reference date. This is intentionally decoupled from "today" so a
future "week selector" UI can reuse it for past/future weeks without
touching the aggregation logic in `app/api/leaderboard/route.ts`.

The screenshot + OCR logic is split across a few small modules so each
piece can be swapped independently:
[`lib/ocr.ts`](./lib/ocr.ts) (tesseract.js wrapper + digit-sequence
parsing), [`lib/screenshotStorage.ts`](./lib/screenshotStorage.ts) (Storage
upload/delete, Supabase vs. mock no-op), and
[`app/api/steps/upload/route.ts`](./app/api/steps/upload/route.ts) (ties
identity + OCR + storage + the DB write together atomically).
