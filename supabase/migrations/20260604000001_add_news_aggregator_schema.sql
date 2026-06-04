-- Gaming News Aggregator: core schema

-- ─── news_sources ─────────────────────────────────────────────────────────────
CREATE TABLE news_sources (
  id                       text        PRIMARY KEY,
  name                     text        NOT NULL,
  category                 text        NOT NULL,
  feed_url                 text        NOT NULL,
  homepage_url             text,
  source_weight            numeric     NOT NULL DEFAULT 1.0,
  refresh_interval_minutes integer     NOT NULL DEFAULT 30,
  etag                     text,
  last_modified            text,
  last_fetched_at          timestamptz,
  next_fetch_at            timestamptz,
  consecutive_failures     integer     NOT NULL DEFAULT 0,
  is_enabled               boolean     NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE news_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_sources_public_read" ON news_sources FOR SELECT USING (true);

CREATE TRIGGER set_news_sources_updated_at
  BEFORE UPDATE ON news_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── news_story_clusters ──────────────────────────────────────────────────────
CREATE TABLE news_story_clusters (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_title text        NOT NULL,
  normalized_title     text        NOT NULL,
  primary_article_id   uuid,
  story_score          numeric     NOT NULL DEFAULT 0,
  article_count        integer     NOT NULL DEFAULT 1,
  unique_source_count  integer     NOT NULL DEFAULT 1,
  first_published_at   timestamptz,
  latest_published_at  timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE news_story_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_story_clusters_public_read" ON news_story_clusters FOR SELECT USING (true);

CREATE TRIGGER set_news_story_clusters_updated_at
  BEFORE UPDATE ON news_story_clusters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── news_articles ────────────────────────────────────────────────────────────
CREATE TABLE news_articles (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id        text        NOT NULL REFERENCES news_sources(id),
  title            text        NOT NULL,
  normalized_title text        NOT NULL,
  url              text        NOT NULL UNIQUE,
  canonical_url    text,
  excerpt          text,
  image_url        text,
  author           text,
  published_at     timestamptz,
  fetched_at       timestamptz NOT NULL DEFAULT now(),
  content_hash     text,
  cluster_id       uuid        REFERENCES news_story_clusters(id),
  raw              jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_articles_public_read" ON news_articles FOR SELECT USING (true);

CREATE INDEX news_articles_published_at_idx ON news_articles (published_at DESC);
CREATE INDEX news_articles_source_id_idx    ON news_articles (source_id);
CREATE INDEX news_articles_cluster_id_idx   ON news_articles (cluster_id);
CREATE INDEX news_articles_fetched_at_idx   ON news_articles (fetched_at DESC);

-- Back-fill FK on news_story_clusters.primary_article_id now that news_articles exists
ALTER TABLE news_story_clusters
  ADD CONSTRAINT news_story_clusters_primary_article_id_fkey
  FOREIGN KEY (primary_article_id) REFERENCES news_articles(id);

-- ─── news_games ───────────────────────────────────────────────────────────────
CREATE TABLE news_games (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rawg_id      text        UNIQUE,
  name         text        NOT NULL,
  slug         text        NOT NULL UNIQUE,
  released     date,
  image_url    text,
  platforms    text[]      NOT NULL DEFAULT '{}',
  genres       text[]      NOT NULL DEFAULT '{}',
  steam_app_id text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE news_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_games_public_read" ON news_games FOR SELECT USING (true);

CREATE INDEX news_games_name_fts_idx ON news_games USING gin (to_tsvector('english', name));

CREATE TRIGGER set_news_games_updated_at
  BEFORE UPDATE ON news_games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── news_game_aliases ────────────────────────────────────────────────────────
CREATE TABLE news_game_aliases (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id          uuid        NOT NULL REFERENCES news_games(id) ON DELETE CASCADE,
  alias            text        NOT NULL,
  normalized_alias text        NOT NULL,
  source           text        NOT NULL DEFAULT 'manual',
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, normalized_alias)
);

ALTER TABLE news_game_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_game_aliases_public_read" ON news_game_aliases FOR SELECT USING (true);

CREATE INDEX news_game_aliases_normalized_alias_idx ON news_game_aliases (normalized_alias);

-- ─── news_article_games ───────────────────────────────────────────────────────
CREATE TABLE news_article_games (
  article_id   uuid        NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  game_id      uuid        NOT NULL REFERENCES news_games(id) ON DELETE CASCADE,
  confidence   numeric     NOT NULL DEFAULT 1.0,
  match_method text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, game_id)
);

ALTER TABLE news_article_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_article_games_public_read" ON news_article_games FOR SELECT USING (true);

-- ─── news_game_trends ─────────────────────────────────────────────────────────
CREATE TABLE news_game_trends (
  game_id              uuid        PRIMARY KEY REFERENCES news_games(id) ON DELETE CASCADE,
  mentions_24h         integer     NOT NULL DEFAULT 0,
  mentions_72h         integer     NOT NULL DEFAULT 0,
  mentions_7d          integer     NOT NULL DEFAULT 0,
  unique_sources_72h   integer     NOT NULL DEFAULT 0,
  official_mentions_72h integer    NOT NULL DEFAULT 0,
  trending_score       numeric     NOT NULL DEFAULT 0,
  calculated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE news_game_trends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_game_trends_public_read" ON news_game_trends FOR SELECT USING (true);
