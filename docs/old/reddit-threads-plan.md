# Reddit Gaming Threads — Dashboard Feature

## Context

Goodgame needs a "Trending on Reddit" section on the dashboard tab. Data fetched live from Reddit on the client would be slow, leak credentials, and hit rate limits. Instead: a daily server-side cron fetches the top 10 posts across curated gaming subreddits, caches them in Supabase, and the dashboard reads from the DB. No history — each daily run replaces the previous batch.

---

## Phase 1 — Database Migration

**File:** `supabase/migrations/20260508000002_add_reddit_threads.sql`

Create `reddit_threads` table:

```sql
CREATE TABLE reddit_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reddit_id text UNIQUE NOT NULL,
  subreddit text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  permalink text NOT NULL,
  score integer NOT NULL,
  num_comments integer NOT NULL,
  thumbnail_url text,
  created_utc timestamptz NOT NULL,
  rank_score numeric NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reddit_threads ENABLE ROW LEVEL SECURITY;

-- Public read, no client write
CREATE POLICY "reddit_threads_public_read"
  ON reddit_threads FOR SELECT
  USING (true);

CREATE INDEX reddit_threads_rank_idx ON reddit_threads (rank_score DESC);
```

---

## Phase 2 — TypeScript Types

**File:** `mobile/types/reddit.ts` (new file)

```ts
export interface RedditThread {
  id: string
  reddit_id: string
  subreddit: string
  title: string
  url: string
  permalink: string
  score: number
  num_comments: number
  thumbnail_url: string | null
  created_utc: string
  rank_score: number
  fetched_at: string
}
```

After migration runs, regenerate Supabase types:
```bash
pnpm run db:types
```

---

## Phase 3 — Supabase Edge Function

**File:** `supabase/functions/fetch-reddit-threads/index.ts`

**Required env vars (set in Supabase dashboard → Project Settings → Edge Functions):**
- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `SUPABASE_URL` (auto-injected)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-injected)

**Logic:**

1. Obtain Reddit app-only OAuth token via `POST https://www.reddit.com/api/v1/access_token` with `grant_type=client_credentials`. Header: `User-Agent: server:com.goodgame.app:v1.0 (by /u/yourusername)`.
2. For each of the 9 subreddits: `GET /r/{sub}/hot.json?t=day&limit=25`
3. Flatten all posts into one array
4. Dedupe by `url` — keep highest-score post per URL
5. Compute `rank_score = score + num_comments * 3` for each
6. Sort descending, take top 10
7. Atomically replace table contents:
   ```sql
   DELETE FROM reddit_threads;
   INSERT INTO reddit_threads (...) VALUES ...;
   ```
   Use Supabase service role client (`createClient` with `SUPABASE_SERVICE_ROLE_KEY`).

**Subreddits:** `games`, `gaming`, `pcgaming`, `PS5`, `pcmasterrace`, `GamingLeaksAndRumours`, `patientgamers`, `playstation`, `Steam`,

**Thumbnail handling:** Reddit thumbnails are often `"self"`, `"default"`, or `"nsfw"` strings. Store `null` for non-URL values.

---

## Phase 4 — Schedule the Function

**Option A (local dev / config.toml):**
In `supabase/config.toml`, Supabase CLI v1.x supports function schedules:
```toml
[functions.fetch-reddit-threads]
verify_jwt = false
schedule = "0 8 * * *"
```
This runs daily at 08:00 UTC.

**Option B (production — Supabase dashboard):**
Dashboard → Edge Functions → `fetch-reddit-threads` → Schedule → `0 8 * * *`

Both needed: config.toml for local reproducibility, dashboard for production.

---

## Phase 5 — React Query Hook

**File:** `mobile/hooks/useRedditThreads.ts`

Follow existing pattern from `useRawg.ts` / `useLibrary.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { RedditThread } from '@/types/reddit'

export function useRedditThreads() {
  return useQuery({
    queryKey: ['reddit', 'threads'],
    queryFn: async (): Promise<RedditThread[]> => {
      const { data, error } = await supabase
        .from('reddit_threads')
        .select('*')
        .order('rank_score', { ascending: false })
        .limit(10)
      if (error) throw error
      return data
    },
    staleTime: 60 * 60 * 1000,   // 1 hour — data only changes once/day
    gcTime: 2 * 60 * 60 * 1000,
  })
}
```

No `enabled` guard needed — public table, no auth required.

---

## Phase 6 — RedditThreadCard Component

**File:** `mobile/components/RedditThreadCard.tsx`

New component. Uses `Card.tsx` wrapper + design tokens. Shows:
- Subreddit pill (e.g. `r/gaming`) — `Colors.textMuted` background chip
- Title — `FontFamily.medium`, 2-line clamp
- Row: upvote arrow + score | comment bubble + num_comments | external link icon
- Tap → `Linking.openURL('https://reddit.com' + permalink)`

No `AddToLibraryButton`. No cover image (thumbnails unreliable).

---

## Phase 7 — Dashboard Section

**File:** `mobile/app/(tabs)/index.tsx`

Add below existing "Recently Added" section:

- Reuse existing `SectionHeader` component with title `"Trending on Reddit"`
- `FlatList` vertical (not horizontal) — threads are text-heavy
- Pass `useRedditThreads()` data
- Show `SkeletonLoader` while loading
- If `data.length === 0` after load: skip rendering entire section (Reddit may be down or first run not yet executed)

---

## Manual Setup Required (not automatable)

1. Create Reddit app at `https://www.reddit.com/prefs/apps` → type: **script**
2. Copy `client_id` and `secret`
3. Add to Supabase dashboard → Edge Functions env vars:
   - `REDDIT_CLIENT_ID`
   - `REDDIT_CLIENT_SECRET`
4. Update `User-Agent` string in Edge Function with your Reddit username

---

## Verification

1. Run migration: `supabase db push`
2. Deploy function: `supabase functions deploy fetch-reddit-threads`
3. Invoke manually: `supabase functions invoke fetch-reddit-threads`
4. Confirm rows in DB: `SELECT count(*), max(fetched_at) FROM reddit_threads;` → should return 10 rows
5. Run app, check dashboard for "Trending on Reddit" section with 10 threads
6. Tap a thread → opens Reddit in browser
7. Run `npx tsc --noEmit` — zero errors

---

## Files Touched

| File | Action |
|------|--------|
| `supabase/migrations/20260508000002_add_reddit_threads.sql` | New |
| `supabase/functions/fetch-reddit-threads/index.ts` | New |
| `supabase/config.toml` | Edit — add function schedule |
| `mobile/types/reddit.ts` | New |
| `mobile/types/supabase.ts` | Regenerate after migration |
| `mobile/hooks/useRedditThreads.ts` | New |
| `mobile/components/RedditThreadCard.tsx` | New |
| `mobile/app/(tabs)/index.tsx` | Edit — add section |
