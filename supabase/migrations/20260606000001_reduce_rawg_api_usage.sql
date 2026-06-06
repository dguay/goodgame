-- Reduce RAWG API usage via two mechanisms:
-- 1. game_match_attempted_at: each article is RAWG-queried at most once.
--    Previously, unmatched articles were re-queried on every ingest cycle
--    for the entire 72-hour window, causing ~542k RAWG calls/month.
-- 2. Nighttime cron pause: ingest-news only fires during waking hours (UTC
--    11:00–03:59, roughly 6 AM–11 PM EST), saving ~33% of invocations.
--    Morning's first run picks up overnight RSS articles in one pass.

-- 1. Add attempt-tracking column.
ALTER TABLE news_articles
  ADD COLUMN IF NOT EXISTS game_match_attempted_at TIMESTAMPTZ;

-- 2. Backfill: mark articles already matched or queued so they are not
--    re-attempted on the next ingest cycle.
UPDATE news_articles
SET game_match_attempted_at = NOW()
WHERE id IN (
  SELECT article_id FROM news_article_games
  UNION
  SELECT article_id FROM news_game_match_candidates
);

-- 3. Restrict ingest-news cron to active hours (UTC 11–23 and 0–3).
DO $outer$
BEGIN
  BEGIN
    PERFORM cron.unschedule('ingest-news');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM cron.schedule(
    'ingest-news',
    '*/10 11-23,0-3 * * *',
    $cron$
    SELECT net.http_post(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_functions_url' LIMIT 1) || '/ingest-news',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1),
        'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
      ),
      body    := '{}'::jsonb
    ) AS request_id;
    $cron$
  );
END $outer$;
