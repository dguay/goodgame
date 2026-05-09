CREATE OR REPLACE FUNCTION replace_reddit_threads(p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM reddit_threads;
  INSERT INTO reddit_threads (
    reddit_id, subreddit, title, url, permalink,
    score, num_comments, thumbnail_url, created_utc, rank_score, fetched_at
  )
  SELECT
    elem->>'reddit_id',
    elem->>'subreddit',
    elem->>'title',
    elem->>'url',
    elem->>'permalink',
    (elem->>'score')::integer,
    (elem->>'num_comments')::integer,
    nullif(elem->>'thumbnail_url', ''),
    (elem->>'created_utc')::timestamptz,
    (elem->>'rank_score')::numeric,
    (elem->>'fetched_at')::timestamptz
  FROM jsonb_array_elements(p_rows) AS elem;
END;
$$;
