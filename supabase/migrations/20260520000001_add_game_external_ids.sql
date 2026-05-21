CREATE TABLE game_external_ids (
  rawg_game_id integer PRIMARY KEY,
  steam_app_id integer NULL CHECK (steam_app_id > 0),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE game_external_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view game external ids" ON game_external_ids
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage game external ids" ON game_external_ids
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER set_game_external_ids_updated_at BEFORE UPDATE ON game_external_ids
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
