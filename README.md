# Step Count Give Event 🚶

A tiny, deployable web app for a one-week company "step count give event":

- **`/`** — public submission form: name, optional email, date, and a
  **screenshot of your phone's step count screen** — the app reads the
  number automatically via OCR (no typing in your step count)
- **`/leaderboard`** — live leaderboard for the current week (Mon–Sun), with a
  ranked table and a top-10 bar chart, auto-refreshing every 30 seconds

Built with Next.js (App Router, TypeScript), Tailwind CSS, and Supabase
(Postgres + Storage) as the database. No login/auth — just name-based
entries, since this is a casual internal event.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- [Supabase](https://supabase.com) (Postgres + Storage) via `@supabase/supabase-js`
- [tesseract.js](https://tesseract.projectnaptha.com/) for client-side OCR
- [Recharts](https://recharts.org) for the bar chart
- Deploys for free on [Vercel](https://vercel.com)

## How screenshot OCR works

Instead of typing in a step count, participants upload a screenshot of their
phone's step-count screen (e.g. Health app, Google Fit, Fitbit). The number
is extracted **entirely in the browser** using
[tesseract.js](https://tesseract.projectnaptha.com/) (pure JS/WASM OCR, no
API key or server credentials needed) — only the extracted number and the
image itself are sent to the API. This is deliberate: running OCR
server-side would mean bundling tesseract.js's WASM core into the Vercel
serverless function, which is heavy and slows down cold starts. Doing it
client-side keeps the API fast and avoids that entirely.

Because phone screenshots can be misread (e.g. "8,543" → "6,543"), the
detected number is always shown back to the user as an editable field
("Detected: 8,543 steps") before submission, so they can correct it if OCR
got it wrong.

## 1. Create a free Supabase project and run the migrations

1. Go to [supabase.com](https://supabase.com) and sign up (free tier is
   plenty for this event).
2. Click **New project**. Pick an org, name (e.g. `step-count-event`), a
   database password, and a region. Wait for it to finish provisioning.
3. Open your new project, go to the **SQL Editor** (left sidebar), click
   **New query**, paste in the contents of
   [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql),
   and click **Run**. This creates the `steps` table, a unique index on
   `(name, entry_date)` so resubmitting the same day updates instead of
   duplicating, and permissive Row Level Security policies (public
   read/insert/update — fine for a casual internal event with no login).
4. Create a **Storage** bucket for screenshots: go to **Storage** (left
   sidebar) → **New bucket** → name it exactly `screenshots` → toggle
   **Public bucket: ON** → **Create bucket**.
5. Back in the **SQL Editor**, run
   [`supabase/migrations/0002_add_screenshot_url.sql`](./supabase/migrations/0002_add_screenshot_url.sql).
   This adds the `screenshot_url` column to `steps` and adds Storage RLS
   policies so the anon key can upload to and read from the `screenshots`
   bucket you just created.
   - Alternatively, if you have the [Supabase CLI](https://supabase.com/docs/guides/cli)
     installed and linked to your project, you can run `supabase db push`
     from this repo instead of using the SQL editor (you'll still need to
     create the `screenshots` bucket manually via the dashboard first, since
     bucket creation isn't part of the SQL migration).
6. Go to **Project Settings → API**. You'll need two values from there in
   the next step:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** API key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> The anon key is safe to expose client-side — it only works through the
> Row Level Security policies defined in the migrations. Do **not** use the
> `service_role` key in this app (it bypasses RLS and must never be exposed
> to the browser). This app doesn't use it.

## 2. Configure environment variables

Copy the example file and fill in the two values from Supabase:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

Both variables are required at runtime. The build itself will succeed even
without them (the Supabase client is lazily initialized), but API calls will
fail until they're set — locally in `.env.local`, and in Vercel's project
settings for production.

**Trying it with zero setup:** if these env vars are *not* set, the app
automatically falls back to a simple in-memory store (see
[`lib/memoryStore.ts`](./lib/memoryStore.ts)) so you can run `npm run dev`
and try the whole flow — screenshot upload, OCR, leaderboard — without
creating a Supabase project first. This fallback is dev-only: data resets
whenever the server restarts and screenshots are kept as base64 data URLs
in memory, so it's not suitable for the real multi-day event.

## 3. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the submission form,
and [http://localhost:3000/leaderboard](http://localhost:3000/leaderboard)
for the leaderboard.

## 4. Deploy to Vercel for free

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. In the import screen (or afterwards under **Project Settings →
   Environment Variables**), add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**. Vercel will build and host it on a free
   `your-project.vercel.app` URL.

## 5. Share the link with participants

Once deployed, share the Vercel URL (e.g. `https://your-project.vercel.app`)
directly, or set up a custom/shared short link (e.g. an internal `go/`
link, or a service like Bitly) that points at it. Participants submit steps
at the root URL; anyone can check `/leaderboard` for live standings.

## Data model

Single `steps` table (see
[`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql) +
[`supabase/migrations/0002_add_screenshot_url.sql`](./supabase/migrations/0002_add_screenshot_url.sql)):

| column           | type      | notes                                      |
| ---------------- | --------- | ------------------------------------------- |
| `id`             | uuid (pk) | default `gen_random_uuid()`                |
| `name`           | text      | participant's display name                 |
| `email`          | text      | optional, used only for de-duping          |
| `steps`          | integer   | 0–100,000 (sanity check against typos)     |
| `entry_date`     | date      | the day the steps were logged              |
| `created_at`     | timestamp | default `now()`                            |
| `screenshot_url` | text      | public Supabase Storage URL of the upload  |

A unique index on `(name, entry_date)` means resubmitting the same name for
the same day **updates** that day's entry (upsert) rather than creating a
duplicate row.

## Extending

The current-week (Mon–Sun) date range is computed in
[`lib/week.ts`](./lib/week.ts) via `getWeekRange()`, which accepts an
optional reference date. This is intentionally decoupled from "today" so a
future "week selector" UI can reuse it for past/future weeks without
touching the aggregation logic in `app/api/leaderboard/route.ts`.

The OCR number-extraction heuristic lives in
[`lib/ocr.ts`](./lib/ocr.ts) (`extractStepCount`) — it picks the largest
plausible number found in the recognized text, since the step count is
typically the most prominent number on a phone's step screen. Swap this out
if you need smarter parsing for a specific app's screenshot layout.
