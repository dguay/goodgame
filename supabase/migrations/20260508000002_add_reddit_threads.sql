CREATE TABLE reddit_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reddit_id text UNIQUE NOT NULL,
  subreddit text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  permalink text NOT NULL,
  score integer NOT NULL,
  num_comments integer NOT NULL,
  thumbnail_url text,
  created_utc timestamptz NOT NULL,
  rank_score numeric NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reddit_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reddit_threads_public_read"
  ON reddit_threads FOR SELECT
  USING (true);

CREATE INDEX reddit_threads_rank_idx ON reddit_threads (rank_score DESC);
