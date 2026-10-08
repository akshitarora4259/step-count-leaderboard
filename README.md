# Step Count Give Event 🚶

A tiny, deployable web app for a one-week company "step count give event":

- **`/`** — public submission form (name, optional email, date, step count)
- **`/leaderboard`** — live leaderboard for the current week (Mon–Sun), with a
  ranked table and a top-10 bar chart, auto-refreshing every 30 seconds

Built with Next.js (App Router, TypeScript), Tailwind CSS, and Supabase
(Postgres) as the database. No login/auth — just name-based entries, since
this is a casual internal event.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- [Supabase](https://supabase.com) (Postgres) via `@supabase/supabase-js`
- [Recharts](https://recharts.org) for the bar chart
- Deploys for free on [Vercel](https://vercel.com)

## 1. Create a free Supabase project and run the migration

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
   - Alternatively, if you have the [Supabase CLI](https://supabase.com/docs/guides/cli)
     installed and linked to your project, you can run `supabase db push`
     from this repo instead of using the SQL editor.
4. Go to **Project Settings → API**. You'll need two values from there in
   the next step:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** API key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> The anon key is safe to expose client-side — it only works through the
> Row Level Security policies defined in the migration. Do **not** use the
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

Single `steps` table (see [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql)):

| column       | type      | notes                                   |
| ------------ | --------- | ---------------------------------------- |
| `id`         | uuid (pk) | default `gen_random_uuid()`             |
| `name`       | text      | participant's display name              |
| `email`      | text      | optional, used only for de-duping       |
| `steps`      | integer   | 0–100,000 (sanity check against typos)  |
| `entry_date` | date      | the day the steps were logged           |
| `created_at` | timestamp | default `now()`                         |

A unique index on `(name, entry_date)` means resubmitting the same name for
the same day **updates** that day's entry (upsert) rather than creating a
duplicate row.

## Extending

The current-week (Mon–Sun) date range is computed in
[`lib/week.ts`](./lib/week.ts) via `getWeekRange()`, which accepts an
optional reference date. This is intentionally decoupled from "today" so a
future "week selector" UI can reuse it for past/future weeks without
touching the aggregation logic in `app/api/leaderboard/route.ts`.
