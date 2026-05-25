# Reddit Gaming Threads — Archived Plan

This was the original implementation plan for the dashboard "Trending on Reddit"
section. It has been superseded.

## Current Approach

The project now fetches public subreddit listings through Reddit's `.json`
listing URLs from GitHub Actions:

```text
https://www.reddit.com/r/{subreddit}/hot.json?t=day&limit=25
```

The app never calls Reddit directly. The GitHub Action caches the top ranked
threads in `reddit_threads`, and the dashboard reads from Supabase.

## Why This Changed

The original plan used Reddit app-only OAuth and required Reddit client
credentials from a script app.

That setup is no longer required for this feature.

## Current Operational Notes

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required GitHub repository
  secrets so the action can replace cached rows.
- `REDDIT_USER_AGENT` is an optional GitHub repository secret. If set, it
  overrides the default user-agent sent to Reddit.
- Fetch errors are persisted in `reddit_fetch_errors`.
- The cron job runs every two hours from 6 AM through 8 PM Eastern time.
- Reddit `403` and `429` responses are retried once after a short delay.

## Relevant Files

| File | Purpose |
| --- | --- |
| `.github/workflows/fetch-reddit-threads.yml` | Schedules and manually runs Reddit ingestion on GitHub Actions |
| `scripts/fetch-reddit-threads.mjs` | Fetches Reddit `.json`, ranks posts, logs failures, replaces cached rows |
| `supabase/migrations/20260508000002_add_reddit_threads.sql` | Creates `reddit_threads` |
| `supabase/migrations/20260508000003_add_replace_reddit_threads_rpc.sql` | Adds atomic replacement RPC |
| `supabase/migrations/20260524000001_update_reddit_fetch_schedule_and_errors.sql` | Adds error logging and current cron schedule |
| `supabase/migrations/20260525000001_disable_supabase_reddit_fetch_cron.sql` | Disables Supabase-hosted Reddit fetch cron |
| `mobile/hooks/useRedditThreads.ts` | Reads cached threads from Supabase |
| `mobile/components/RedditThreadCard.tsx` | Renders dashboard cards |
| `mobile/app/(tabs)/index.tsx` | Shows the dashboard section |

## Failure Inspection

```sql
select created_at, message, details
from reddit_fetch_errors
order by created_at desc
limit 20;
```
