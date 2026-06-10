ALTER TABLE pcgamingwiki_features
  ADD COLUMN xbox_game_pass text NULL CHECK (
    xbox_game_pass IS NULL OR xbox_game_pass IN (
      'always on',
      'false',
      'hackable',
      'limited',
      'true',
      'unknown'
    )
  );
