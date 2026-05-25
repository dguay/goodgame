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

DROP FUNCTION IF EXISTS replace_reddit_threads(jsonb);
DROP TABLE IF EXISTS reddit_fetch_errors;
DROP TABLE IF EXISTS reddit_threads;
