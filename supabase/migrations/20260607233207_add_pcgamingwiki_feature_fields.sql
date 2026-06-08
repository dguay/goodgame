ALTER TABLE pcgamingwiki_features
  ADD COLUMN sixty_fps text NULL CHECK (
    sixty_fps IS NULL OR sixty_fps IN (
      'always on',
      'false',
      'hackable',
      'limited',
      'true',
      'unknown'
    )
  ),
  ADD COLUMN one_twenty_fps text NULL CHECK (
    one_twenty_fps IS NULL OR one_twenty_fps IN (
      'always on',
      'false',
      'hackable',
      'limited',
      'true',
      'unknown'
    )
  ),
  ADD COLUMN controller_support text NULL CHECK (
    controller_support IS NULL OR controller_support IN (
      'always on',
      'false',
      'hackable',
      'limited',
      'true',
      'unknown'
    )
  ),
  ADD COLUMN perspectives text[] NOT NULL DEFAULT '{}',
  ADD COLUMN official_discord_url text NULL;
