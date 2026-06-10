# PCGamingWiki API Notes

PCGamingWiki exposes structured game data through the MediaWiki Action API with
the Cargo extension.

Base endpoint:

```txt
https://www.pcgamingwiki.com/w/api.php
```

For browser/web requests, include `origin=*` so MediaWiki returns CORS headers:

```txt
origin=*
```

## Cargo Query

Use `action=cargoquery` for structured fields.

Common parameters:

```txt
action=cargoquery
format=json
tables=Infobox_game,Video,Input
fields=Infobox_game._pageID=PageID,Infobox_game._pageName=PageName,Video.60_FPS=SixtyFps,Video.120_FPS=OneTwentyFps,Video.Ultrawidescreen,Input.Controller_support=ControllerSupport,Infobox_game.Perspectives=Perspectives
join_on=Infobox_game._pageID=Video._pageID,Infobox_game._pageID=Input._pageID
where=Infobox_game.Steam_AppID HOLDS "1245620"
limit=1
origin=*
```

Example request:

```txt
https://www.pcgamingwiki.com/w/api.php?origin=*&action=cargoquery&format=json&tables=Infobox_game,Video,Input&fields=Infobox_game._pageID=PageID,Infobox_game._pageName=PageName,Video.60_FPS=SixtyFps,Video.120_FPS=OneTwentyFps,Video.Ultrawidescreen,Input.Controller_support=ControllerSupport,Infobox_game.Perspectives=Perspectives&join_on=Infobox_game._pageID=Video._pageID,Infobox_game._pageID=Input._pageID&where=Infobox_game.Steam_AppID%20HOLDS%20%221245620%22&limit=1
```

Verified response for Elden Ring / Steam AppID `1245620`:

```json
{
  "cargoquery": [
    {
      "title": {
        "PageID": "146683",
        "PageName": "Elden Ring",
        "SixtyFps": "true",
        "OneTwentyFps": "true",
        "Ultrawidescreen": "hackable",
        "ControllerSupport": "true",
        "Perspectives": "Third-person,"
      }
    }
  ]
}
```

## Discover cargo fields

Example: https://www.pcgamingwiki.com/w/api.php?action=cargofields&table=Availability&format=json

## Support Values

Goodgame uses the same support-state parser for these PCGamingWiki fields:

```txt
Video.60_FPS
Video.120_FPS
Video.Ultrawidescreen
Input.Controller_support
```

Verified values from PCGamingWiki tick/cross fields:

```ts
type PcgwSupportState =
  | null
  | 'always on'
  | 'false'
  | 'hackable'
  | 'limited'
  | 'true'
  | 'unknown'
```

Suggested display mapping:

```txt
true       -> Supported
false      -> Unsupported
hackable   -> Hackable
limited    -> Limited
always on  -> Always on
unknown    -> Unknown
null       -> Not documented
```

Normalize values by trimming whitespace and lowercasing before validation.
Empty values should become `null`. Non-empty unrecognized values should become
`unknown` so unexpected PCGamingWiki values do not break rendering.

## Perspectives

`Infobox_game.Perspectives` is a Cargo list serialized as comma-separated text,
often with a trailing comma.

Example:

```txt
First-person,
First-person, Third-person,
```

Parse by splitting on commas, trimming each item, and dropping empty entries.

## Official Discord URL

The official Discord link is not stored in `Infobox_game` Cargo data. Fetch the
page source after the Cargo query when `PageName` is available:

```txt
action=query
format=json
prop=revisions
rvprop=content
rvslots=main
titles=<PageName>
origin=*
```

Goodgame only extracts an official Discord invite from the `'''General
information'''` block, matching Discord invite URLs whose link label contains
`official discord`.

Supported URL forms:

```txt
https://discord.gg/<invite>
https://discord.com/invite/<invite>
https://discordapp.com/invite/<invite>
```

Ignore Discord links outside the General information block to avoid capturing
community troubleshooting links, mod links, or other unofficial references.

## Useful Tables

Structured Cargo tables worth exploring:

```txt
Infobox_game       Game identity, developers, publishers, release dates, genres, Steam AppID, GOG ID
Video              Ultrawide, HDR, ray tracing, borderless windowed, FOV, upscaling
Input              Controller support, prompts, Steam Input, DualSense features
Multiplayer        Local/LAN/online support, player counts, crossplay
Availability       Storefronts, DRM, subscriptions
Cloud              Cloud save support by platform
Audio              Subtitles, closed captions, surround sound
L10n               Per-language interface/audio/subtitle support
API                Direct3D/OpenGL/Vulkan/Metal and executable architecture
VR_support         VR runtimes and tracking support
Middleware         Physics/audio/input/cutscene/anti-cheat middleware
Tags               Data quality and feature-section flags
```

Most per-game tables can be joined by `_pageID`. Association-style tables such
as `L10n` and `Infobox_game_engine` may return multiple rows and are better
queried separately when needed.

## Current Goodgame Integration

Goodgame currently uses PCGamingWiki only for PC feature enrichment on game
details. Do not run the Steam AppID lookup, PCGamingWiki query, or render
`PcFeaturesSection` unless RAWG game detail includes platform slug `pc`.

Flow:

```txt
RAWG game detail
  -> check platforms for slug "pc"
  -> resolve/cache Steam AppID
  -> read pcgamingwiki_features cache by rawg_game_id
  -> if missing, stale, or cached before the feature-field migration, query PCGamingWiki by Steam AppID
  -> fetch page source by PageName to extract official Discord URL
  -> upsert cache with refreshed_at
  -> render PC feature rows
```

Cache table:

```txt
pcgamingwiki_features
  rawg_game_id primary key
  steam_app_id
  pcgw_page_id
  pcgw_page_name
  sixty_fps
  one_twenty_fps
  ultrawidescreen
  controller_support
  perspectives
  official_discord_url
  refreshed_at
  created_at
  updated_at
```

`sixty_fps`, `one_twenty_fps`, `ultrawidescreen`, and `controller_support` use
the `PcgwSupportState` values above. `perspectives` is stored as `text[]`.

The UI should treat cache writes as best effort. If PCGamingWiki returns live
data but Supabase cache write fails, show the live data and log the cache
failure.

If the cache table is unavailable during rollout, handle known missing-table
errors by Supabase/Postgres code first (`42P01`, `PGRST205`) and log the full
Supabase error object before falling back to live data. String matching on error
messages should only be a fallback.

Rows cached before new feature columns were added need one forced refresh to
backfill the new data. The app tracks this with a migration timestamp guard in
`usePcGamingWiki.ts`; update that guard whenever new cached PCGW columns need to
invalidate existing fresh rows.

## Limits And Caveats

The PCGamingWiki API can return structured Cargo data, but not every wiki
section is structured. Some high-value data, such as config/save locations, may
require fetching page wikitext with `action=parse&prop=wikitext` and parsing the
section manually. Avoid that unless there is a clear product need.

PCGamingWiki should enrich RAWG data, not replace it. RAWG remains the primary
catalog/search/detail provider for Goodgame.
