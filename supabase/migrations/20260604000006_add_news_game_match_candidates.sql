-- Queue low-confidence game matches for manual review.
-- Service-role only: RLS is intentionally enabled with no public policies until
-- an explicit admin review UI and authorization model are added.
CREATE TABLE news_game_match_candidates (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id            uuid        NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  candidate             text        NOT NULL,
  normalized_candidate  text        NOT NULL,
  best_rawg_id          text,
  best_rawg_name        text,
  best_rawg_slug        text,
  confidence            numeric,
  rawg_results          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  reason                text        NOT NULL,
  status                text        NOT NULL DEFAULT 'pending',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, normalized_candidate)
);

ALTER TABLE news_game_match_candidates ENABLE ROW LEVEL SECURITY; -- service role only

CREATE INDEX news_game_match_candidates_status_idx
  ON news_game_match_candidates (status, created_at DESC);

CREATE INDEX news_game_match_candidates_article_id_idx
  ON news_game_match_candidates (article_id);

CREATE TRIGGER set_news_game_match_candidates_updated_at
  BEFORE UPDATE ON news_game_match_candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
