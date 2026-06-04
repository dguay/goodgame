-- Before this migration, set RAWG_API_KEY as a Supabase Edge Function secret:
--   supabase secrets set RAWG_API_KEY=<your_key>
-- Without it, RAWG game matching is skipped (only local alias/name matching runs).

-- Schedule news ingestion every 10 minutes.
-- Each source controls its own next_fetch_at (30 min default), so most runs are no-ops.
SELECT cron.schedule(
  'ingest-news',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://zjluauqdqockjswczndb.supabase.co/functions/v1/ingest-news',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SUPABASE_ANON_KEY>"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Recalculate trending scores every 30 minutes.
SELECT cron.schedule(
  'calculate-news-trends',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://zjluauqdqockjswczndb.supabase.co/functions/v1/calculate-news-trends',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SUPABASE_ANON_KEY>"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
