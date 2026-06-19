ALTER TABLE pcgamingwiki_features
  ADD COLUMN four_k_ultra_hd text NULL CHECK (
    four_k_ultra_hd IS NULL OR four_k_ultra_hd IN (
      'always on',
      'false',
      'hackable',
      'limited',
      'true',
      'unknown'
    )
  );
