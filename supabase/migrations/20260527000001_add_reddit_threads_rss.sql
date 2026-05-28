CREATE TABLE reddit_threads (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subreddit   text        NOT NULL,
  title       text        NOT NULL,
  url         text        NOT NULL,
  author      text        NOT NULL,
  thumbnail_url text,
  pub_date    timestamptz NOT NULL,
  rank        integer     NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reddit_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reddit_threads_public_read"
  ON reddit_threads FOR SELECT
  USING (true);

CREATE INDEX reddit_threads_subreddit_rank_idx ON reddit_threads (subreddit, rank);

CREATE OR REPLACE FUNCTION replace_reddit_threads(p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM reddit_threads;
  INSERT INTO reddit_threads (subreddit, title, url, author, thumbnail_url, pub_date, rank, fetched_at)
  SELECT
    elem->>'subreddit',
    elem->>'title',
    elem->>'url',
    elem->>'author',
    nullif(elem->>'thumbnail_url', ''),
    (elem->>'pub_date')::timestamptz,
    (elem->>'rank')::integer,
    (elem->>'fetched_at')::timestamptz
  FROM jsonb_array_elements(p_rows) AS elem;
END;
$$;

SELECT cron.schedule(
  'fetch-reddit-threads-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zjluauqdqockjswczndb.supabase.co/functions/v1/fetch-reddit-threads',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SUPABASE_ANON_KEY>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
