CREATE TABLE pcgamingwiki_features (
  rawg_game_id integer PRIMARY KEY,
  steam_app_id integer NULL CHECK (steam_app_id IS NULL OR steam_app_id > 0),
  pcgw_page_id integer NULL CHECK (pcgw_page_id IS NULL OR pcgw_page_id > 0),
  pcgw_page_name text NULL,
  ultrawidescreen text NULL CHECK (
    ultrawidescreen IS NULL OR ultrawidescreen IN (
      'always on',
      'false',
      'hackable',
      'limited',
      'true',
      'unknown'
    )
  ),
  refreshed_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE pcgamingwiki_features ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON pcgamingwiki_features TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON pcgamingwiki_features TO authenticated;

CREATE POLICY "Anyone can view pcgamingwiki features" ON pcgamingwiki_features
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage pcgamingwiki features" ON pcgamingwiki_features
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER set_pcgamingwiki_features_updated_at BEFORE UPDATE ON pcgamingwiki_features
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
