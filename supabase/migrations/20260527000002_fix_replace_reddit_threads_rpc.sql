CREATE OR REPLACE FUNCTION replace_reddit_threads(p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  TRUNCATE TABLE reddit_threads;
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
