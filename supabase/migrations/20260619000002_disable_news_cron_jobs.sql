-- Disable the legacy gaming news pipeline. ARPG Events use the arpg-timeline
-- calendar feed in the app and do not depend on these Supabase cron jobs.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'ingest-news'
  ) THEN
    PERFORM cron.unschedule('ingest-news');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'calculate-news-trends'
  ) THEN
    PERFORM cron.unschedule('calculate-news-trends');
  END IF;
END $$;
