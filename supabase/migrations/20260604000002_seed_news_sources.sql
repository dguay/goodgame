-- Seed RSS news sources. Re-runnable: updates metadata if config changes.
INSERT INTO news_sources (id, name, category, feed_url, homepage_url, source_weight, next_fetch_at)
VALUES
  ('ign',              'IGN',              'general',        'https://feeds.feedburner.com/ign/games-all',  'https://www.ign.com',           1.05, now()),
  ('gamespot',         'GameSpot',         'general',        'https://www.gamespot.com/feeds/news/',        'https://www.gamespot.com',      1.05, now()),
  ('eurogamer',        'Eurogamer',        'general',        'https://www.eurogamer.net/feed/news',         'https://www.eurogamer.net',     1.15, now()),
  ('pc-gamer',         'PC Gamer',         'pc',             'https://www.pcgamer.com/rss/',                'https://www.pcgamer.com',       1.10, now()),
  ('gematsu',          'Gematsu',          'japanese-games', 'https://www.gematsu.com/feed',               'https://www.gematsu.com',       1.00, now()),
  ('playstation-blog', 'PlayStation Blog', 'official',       'https://blog.playstation.com/feed/',          'https://blog.playstation.com',  0.95, now()),
  ('xbox-wire',        'Xbox Wire',        'official',       'https://news.xbox.com/en-us/feed/',           'https://news.xbox.com',         0.95, now())
ON CONFLICT (id) DO UPDATE SET
  name                     = EXCLUDED.name,
  category                 = EXCLUDED.category,
  feed_url                 = EXCLUDED.feed_url,
  homepage_url             = EXCLUDED.homepage_url,
  source_weight            = EXCLUDED.source_weight,
  updated_at               = now();
