SELECT cron.unschedule('fetch-reddit-threads-hourly');
DROP FUNCTION IF EXISTS replace_reddit_threads(jsonb);
DROP TABLE IF EXISTS reddit_threads;
