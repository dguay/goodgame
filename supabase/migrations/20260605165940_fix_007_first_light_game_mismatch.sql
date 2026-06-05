-- Fix: "007 First Light" articles incorrectly linked to "First Light (itch)".
-- Root cause: alias "first light" -> "First Light (itch)" matched extracted
-- phrase "First Light" from "007 First Light" headlines before numeric prefixes
-- were captured.

-- Step 1: Remove the overly broad "First Light" alias from "First Light (itch)".
DELETE FROM news_game_aliases
WHERE normalized_alias = 'first light'
  AND game_id = (SELECT id FROM news_games WHERE rawg_id = '117102');

-- Step 2: Remove wrong links to "First Light (itch)".
DELETE FROM news_article_games
WHERE game_id = (SELECT id FROM news_games WHERE rawg_id = '117102')
  AND article_id IN (
    SELECT id FROM news_articles
    WHERE title ILIKE '%007%first light%'
       OR title ILIKE '%first light%007%'
       OR title ILIKE '%IO Interactive%first light%'
       OR title ILIKE '%first light%IO Interactive%'
       OR title ILIKE '%James Bond%first light%'
       OR title ILIKE '%first light%James Bond%'
       OR title ILIKE '%playstation store%may 2026%top downloads%'
  );

-- Step 3: Add correct links to "007 First Light" for those same articles.
INSERT INTO news_article_games (article_id, game_id, confidence, match_method)
SELECT na.id,
       (SELECT id FROM news_games WHERE rawg_id = '1004298'),
       1.0,
       'manual_fix'
FROM news_articles na
WHERE na.title ILIKE '%007%first light%'
   OR na.title ILIKE '%first light%007%'
   OR na.title ILIKE '%IO Interactive%first light%'
   OR na.title ILIKE '%first light%IO Interactive%'
   OR na.title ILIKE '%James Bond%first light%'
   OR na.title ILIKE '%first light%James Bond%'
   OR na.title ILIKE '%playstation store%may 2026%top downloads%'
ON CONFLICT (article_id, game_id) DO NOTHING;

-- Step 4: Ensure "007: First Light" colon-variant alias exists for future matches.
INSERT INTO news_game_aliases (game_id, alias, normalized_alias, source)
VALUES (
  (SELECT id FROM news_games WHERE rawg_id = '1004298'),
  '007: First Light',
  '007 first light',
  'manual_fix'
)
ON CONFLICT (game_id, normalized_alias) DO NOTHING;
