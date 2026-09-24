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

Cargo queries require a logged-in bot. Goodgame performs that login only in the
`pcgamingwiki-features` edge function. See [Setup](#setup).

## Cargo Query

Use `action=cargoquery` for structured fields.

Common parameters:

```txt
action=cargoquery
format=json
tables=Game,Video,Input
fields=Game._pageID=PageID,Game._pageName=PageName,Video.4K_Ultra_HD=FourKUltraHd,Video.60_FPS=SixtyFps,Video.120_FPS=OneTwentyFps,Video.Ultrawidescreen,Input.Controller_support=ControllerSupport,Game.Perspectives=Perspectives
join_on=Game._pageID=Video._pageID,Game._pageID=Input._pageID
where=Game.Steam_AppID HOLDS "1245620"
limit=1
origin=*
```

Example request:

```txt
https://www.pcgamingwiki.com/w/api.php?action=cargoquery&format=json&tables=Game,Video,Input&fields=Game._pageID=PageID,Game._pageName=PageName,Video.4K_Ultra_HD=FourKUltraHd,Video.60_FPS=SixtyFps,Video.120_FPS=OneTwentyFps,Video.Ultrawidescreen,Input.Controller_support=ControllerSupport,Game.Perspectives=Perspectives&join_on=Game._pageID=Video._pageID,Game._pageID=Input._pageID&where=Game.Steam_AppID%20HOLDS%20%221245620%22&limit=1
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
Game               Game identity, developers, publishers, release dates, genres, Steam AppID, GOG ID
StoreFeature       Subscription flags, including Xbox_Game_Pass
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
as `L10n` and `GameEngine` may return multiple rows and are better
queried separately when needed.

## Setup

PCGamingWiki requires a [bot password](https://www.mediawiki.org/wiki/Manual:Bot_passwords)
and [`action=login`](https://www.mediawiki.org/wiki/API:Login#Using_action=login)
before `cargoquery` will succeed. Anonymous Cargo queries return `permissiondenied`.

Create a bot password whose grants include **Create, query and delete data through the Cargo extension**. The login name is `Username@bot-password-name`.

Store these as Supabase edge function secrets. Do not put them in Expo, `EXPO_PUBLIC_*`, or the git repository. Do not deploy the function or push the secrets until that has been approved.

```txt
PCGW_BOT_USERNAME   Username@bot-password-name
PCGW_BOT_PASSWORD   the bot password
PCGW_CONTACT        optional contact used in the user agent; defaults to https://github.com/dguay/goodgame
```

```bash
supabase secrets set PCGW_BOT_USERNAME=Username@bot-password-name PCGW_BOT_PASSWORD=... PCGW_CONTACT=you@example.com
```

The user agent sent with every request is `Goodgame/1.0 (<contact>)`.

PCGamingWiki's current limit is **60 requests per minute**. A game lookup logs in, runs the Cargo query, then reads the page source and the `StoreFeature` row. HTTP 429 blocks the caller for 60 seconds. Cache hits avoid that traffic.

Local checks, with no live call:

```bash
deno test supabase/functions/pcgamingwiki-features/lookup.test.ts
```

Live smoke for Elden Ring, Steam AppID `1245620`. It exits with an error when the secrets are absent, and prints the page name plus a documented-feature count when they are set:

```bash
PCGW_BOT_USERNAME=Username@bot-password-name PCGW_BOT_PASSWORD=... deno run --allow-net --allow-env scripts/pcgamingwiki-features-smoke.ts
```

`Xbox_Game_Pass` now lives on `StoreFeature`, not `Availability`. The feature query uses `Game`, `Video`, and `Input`.

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
  -> if missing, stale, or cached before the feature-field migration, call the pcgamingwiki-features edge function
  -> the function logs in with the bot password, queries Cargo, and reads the page source for the official Discord URL
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
