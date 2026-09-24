import type { PcgwFeatureResult, PcgwSupportState } from './pcgamingwiki'
import { DAY_MS, HOUR_MS, MINUTE_MS } from './time'
import type { PcGamingWikiFeatures } from '../types/database'

const REFRESH_AFTER_MS = 30 * DAY_MS
const XBOX_GAME_PASS_REFRESH_AFTER_MS = 7 * DAY_MS
export const PCGW_FEATURES_STALE_MS = 30 * MINUTE_MS
export const PCGW_FEATURES_GC_MS = 24 * HOUR_MS
// Rows before this cutoff lack newer fields or may contain false negatives from Steam-only lookup.
const MINIMUM_PCGW_REFRESH_AT_MS = Date.parse('2026-06-19T00:00:00.000Z')

export interface PcGamingWikiFeaturesResult {
  controllerSupport: PcgwSupportState | null
  fourKUltraHd: PcgwSupportState | null
  officialDiscordUrl: string | null
  oneTwentyFps: PcgwSupportState | null
  ultrawidescreen: PcgwSupportState | null
  pageName: string | null
  perspectives: string[]
  sixtyFps: PcgwSupportState | null
  xboxGamePass: PcgwSupportState | null
  isDocumented: boolean
}

export function pcFeatureCacheWrite(
  rawgGameId: number,
  steamAppId: number | null,
  result: PcgwFeatureResult | null,
  now: string,
) {
  const primaryFound = result != null
  const xboxFetchSucceeded = primaryFound && !result.xboxGamePassFetchFailed
  const pageSourceFetchSucceeded = primaryFound && !result.pageSourceFetchFailed
  return {
    rawg_game_id: rawgGameId,
    steam_app_id: steamAppId,
    pcgw_page_id: result?.pageId ?? null,
    pcgw_page_name: result?.pageName ?? null,
    four_k_ultra_hd: result?.fourKUltraHd ?? null,
    sixty_fps: result?.sixtyFps ?? null,
    one_twenty_fps: result?.oneTwentyFps ?? null,
    ultrawidescreen: result?.ultrawidescreen ?? null,
    controller_support: result?.controllerSupport ?? null,
    perspectives: result?.perspectives ?? [],
    ...(pageSourceFetchSucceeded
      ? { official_discord_url: result.officialDiscordUrl }
      : !primaryFound
        ? { official_discord_url: null }
        : {}),
    ...(xboxFetchSucceeded
      ? { xbox_game_pass: result.xboxGamePass, xbox_game_pass_checked_at: now }
      : !primaryFound
        ? { xbox_game_pass: null, xbox_game_pass_checked_at: null }
        : {}),
    refreshed_at: now,
  }
}

export function pcFeatureQueryInput(input: {
  isPcGame: boolean
  gameId: number | null
  gameName: string | null
  steamAppId: number | null
  steamLookupComplete: boolean
}): {
  rawgGameId: number | null
  steamAppId: number | null
  gameName: string | null
  enabled: boolean
} {
  if (!input.isPcGame || input.gameId == null) {
    return { rawgGameId: null, steamAppId: null, gameName: null, enabled: false }
  }
  return {
    rawgGameId: input.gameId,
    steamAppId: input.steamAppId,
    gameName: input.gameName,
    enabled: input.steamLookupComplete,
  }
}

export interface PcGamingWikiLiveLookup {
  byGameName(gameName: string): Promise<PcgwFeatureResult | null>
  bySteamAppId(steamAppId: number): Promise<PcgwFeatureResult | null>
}

export interface PcGamingWikiFeatureStore {
  read(rawgGameId: number): Promise<PcGamingWikiFeatures | null>
  write(
    rawgGameId: number,
    steamAppId: number | null,
    result: PcgwFeatureResult | null,
  ): Promise<PcGamingWikiFeatures | null>
  refreshXboxGamePass(row: PcGamingWikiFeatures): Promise<PcGamingWikiFeatures>
}

function isFresh(row: PcGamingWikiFeatures): boolean {
  const refreshedAt = new Date(row.refreshed_at).getTime()
  return refreshedAt >= MINIMUM_PCGW_REFRESH_AT_MS && Date.now() - refreshedAt < REFRESH_AFTER_MS
}

function needsXboxGamePassRefresh(row: PcGamingWikiFeatures): boolean {
  if (row.pcgw_page_id == null) return false
  if (row.xbox_game_pass_checked_at == null) return true
  return Date.now() - new Date(row.xbox_game_pass_checked_at).getTime() > XBOX_GAME_PASS_REFRESH_AFTER_MS
}

function toResult(row: PcGamingWikiFeatures | null): PcGamingWikiFeaturesResult {
  return {
    controllerSupport: row?.controller_support ?? null,
    fourKUltraHd: row?.four_k_ultra_hd ?? null,
    officialDiscordUrl: row?.official_discord_url ?? null,
    oneTwentyFps: row?.one_twenty_fps ?? null,
    ultrawidescreen: row?.ultrawidescreen ?? null,
    pageName: row?.pcgw_page_name ?? null,
    perspectives: row?.perspectives ?? [],
    sixtyFps: row?.sixty_fps ?? null,
    xboxGamePass: row?.xbox_game_pass ?? null,
    isDocumented: row != null && row.pcgw_page_name != null,
  }
}

function toLiveResult(
  result: PcgwFeatureResult | null,
  fallback?: PcGamingWikiFeatures | null,
): PcGamingWikiFeaturesResult {
  return {
    controllerSupport: result?.controllerSupport ?? null,
    fourKUltraHd: result?.fourKUltraHd ?? null,
    officialDiscordUrl: result?.pageSourceFetchFailed
      ? (fallback?.official_discord_url ?? null)
      : (result?.officialDiscordUrl ?? null),
    oneTwentyFps: result?.oneTwentyFps ?? null,
    ultrawidescreen: result?.ultrawidescreen ?? null,
    pageName: result?.pageName ?? null,
    perspectives: result?.perspectives ?? [],
    sixtyFps: result?.sixtyFps ?? null,
    xboxGamePass: result?.xboxGamePassFetchFailed
      ? (fallback?.xbox_game_pass ?? null)
      : (result?.xboxGamePass ?? null),
    isDocumented: result != null && result.pageName != null,
  }
}

export async function resolvePcGamingWikiFeatures(
  rawgGameId: number,
  steamAppId: number | null,
  gameName: string | null,
  store: PcGamingWikiFeatureStore,
  lookup: PcGamingWikiLiveLookup,
): Promise<PcGamingWikiFeaturesResult> {
  let cached: PcGamingWikiFeatures | null = null
  try {
    cached = await store.read(rawgGameId)
  } catch (error) {
    console.warn('Could not read PCGamingWiki feature cache; using live data', error)
  }

  if (cached != null && isFresh(cached)) {
    if (needsXboxGamePassRefresh(cached)) {
      cached = await store.refreshXboxGamePass(cached)
    }
    return toResult(cached)
  }

  if (steamAppId == null && gameName == null) return toResult(cached)

  try {
    const pcgwResult = steamAppId != null
      ? await lookup.bySteamAppId(steamAppId)
      : gameName != null
        ? await lookup.byGameName(gameName)
        : null
    if (pcgwResult?.pageSourceFetchFailed || pcgwResult?.xboxGamePassFetchFailed) {
      return toLiveResult(pcgwResult, cached)
    }
    try {
      const stored = await store.write(rawgGameId, steamAppId, pcgwResult)
      if (stored == null) return toLiveResult(pcgwResult, cached)
      return toResult(stored)
    } catch (error) {
      console.warn('Could not cache PCGamingWiki features; using live data', error)
      return toLiveResult(pcgwResult, cached)
    }
  } catch (error) {
    if (cached != null) {
      console.warn('Could not refresh PCGamingWiki features; using cached data', error)
      return toResult(cached)
    }
    throw error
  }
}
