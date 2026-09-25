-- Drop PC Features rows emptied while anonymous Cargo queries were rejected.
-- The predicate matches mobile/lib/pcFeaturesRecovery.ts.
--
-- Window start is the 2026-08-23 API change. Window end is 2026-09-24 17:15:00Z,
-- after the production recheck at 2026-09-24 17:14:59Z. That recheck found 9 fully
-- empty rows inside the window, 23 documented rows, and 8 fully empty rows from
-- before the cutoff. Only the 9 are deleted.
--
-- Running this again deletes a row only when it still matches the same window,
-- so a successful no-match cached by the repaired lookup stays in place.
-- Do not apply this file to production until that has been approved.

DELETE FROM public.pcgamingwiki_features
WHERE refreshed_at >= timestamptz '2026-08-23 00:00:00+00'
  AND refreshed_at < timestamptz '2026-09-24 17:15:00+00'
  AND pcgw_page_id IS NULL
  AND pcgw_page_name IS NULL
  AND four_k_ultra_hd IS NULL
  AND sixty_fps IS NULL
  AND one_twenty_fps IS NULL
  AND ultrawidescreen IS NULL
  AND controller_support IS NULL
  AND official_discord_url IS NULL
  AND xbox_game_pass IS NULL
  AND xbox_game_pass_checked_at IS NULL
  AND coalesce(cardinality(perspectives), 0) = 0;
