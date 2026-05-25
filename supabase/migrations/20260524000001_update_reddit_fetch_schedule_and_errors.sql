CREATE TABLE reddit_fetch_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reddit_fetch_errors ENABLE ROW LEVEL SECURITY;

CREATE INDEX reddit_fetch_errors_created_at_idx
  ON reddit_fetch_errors (created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'fetch-reddit-threads-hourly'
  ) THEN
    PERFORM cron.unschedule('fetch-reddit-threads-hourly');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'fetch-reddit-threads-daytime'
  ) THEN
    PERFORM cron.unschedule('fetch-reddit-threads-daytime');
  END IF;
END;
$$;

-- Supabase cron runs in UTC, so gate execution by Eastern local time to keep
-- the fetch window stable across daylight saving changes.
SELECT cron.schedule(
  'fetch-reddit-threads-daytime',
  '0 * * * *',
  $$
  WITH current_eastern AS (
    SELECT now() AT TIME ZONE 'America/Toronto' AS run_at
  )
  SELECT net.http_post(
      url := 'https://zjluauqdqockjswczndb.supabase.co/functions/v1/fetch-reddit-threads',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id
  FROM current_eastern
  WHERE EXTRACT(HOUR FROM run_at)::integer BETWEEN 6 AND 20
    AND MOD(EXTRACT(HOUR FROM run_at)::integer - 6, 2) = 0;
  $$
);
