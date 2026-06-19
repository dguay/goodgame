import { useQuery } from '@tanstack/react-query'
import {
  getPcgwFeaturesBySteamAppId,
  getPcgwXboxGamePassByPageId,
  type PcgwFeatureResult,
  type PcgwSupportState,
} from '@/lib/pcgamingwiki'
import { supabase } from '@/lib/supabase'
import { DAY_MS, HOUR_MS, MINUTE_MS } from '@/lib/time'
import type { PcGamingWikiFeatures } from '@/types/database'

const REFRESH_AFTER_MS = 30 * DAY_MS
const XBOX_GAME_PASS_REFRESH_AFTER_MS = 7 * DAY_MS
const STALE = 30 * MINUTE_MS
const CACHE = 24 * HOUR_MS
// Migration guard: rows written before this cutoff lack newer PCGamingWiki fields.
const FEATURE_FIELDS_ADDED_AT_MS = Date.parse('2026-06-18T00:00:00.000Z')

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

interface SupabaseCacheError {
  code?: string
  details?: string | null
  message: string
}

function isMissingFeaturesTableError(error: SupabaseCacheError): boolean {
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    (
      error.message.includes('pcgamingwiki_features') &&
      (error.message.includes('schema cache') ||
        error.message.includes('Could not find the table') ||
        error.message.includes('does not exist') ||
        error.details?.includes('does not exist') === true)
    )
  )
}

function isFresh(row: PcGamingWikiFeatures): boolean {
  const refreshedAt = new Date(row.refreshed_at).getTime()
  return refreshedAt >= FEATURE_FIELDS_ADDED_AT_MS && Date.now() - refreshedAt < REFRESH_AFTER_MS
}

function needsXboxGamePassRefresh(row: PcGamingWikiFeatures): boolean {
  if (row.pcgw_page_id == null) return false
  if (row.xbox_game_pass_checked_at == null) return true
  return Date.now() - new Date(row.xbox_game_pass_checked_at).getTime() > XBOX_GAME_PASS_REFRESH_AFTER_MS
}

async function getStoredFeatures(rawgGameId: number): Promise<PcGamingWikiFeatures | null> {
  const { data, error } = await supabase
    .from('pcgamingwiki_features')
    .select('*')
    .eq('rawg_game_id', rawgGameId)
    .maybeSingle()

  if (error) {
    if (isMissingFeaturesTableError(error)) {
      console.warn('PCGamingWiki feature cache table is unavailable; using live data', error)
      return null
    }
    throw new Error(error.message)
  }
  return data
}

async function upsertFeatures(
  rawgGameId: number,
  steamAppId: number,
  result: Awaited<ReturnType<typeof getPcgwFeaturesBySteamAppId>>
): Promise<PcGamingWikiFeatures | null> {
  const now = new Date().toISOString()
  // result=null: primary lookup returned no page → clear page-specific fields explicitly
  // result!=null but secondary fetch failed → omit field to preserve existing cached value
  const primaryFound = result != null
  const xboxFetchSucceeded = primaryFound && !result.xboxGamePassFetchFailed
  const pageSourceFetchSucceeded = primaryFound && !result.pageSourceFetchFailed
  const { data, error } = await supabase
    .from('pcgamingwiki_features')
    .upsert({
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
    })
    .select()
    .single()

  if (error) {
    if (isMissingFeaturesTableError(error)) {
      console.warn('PCGamingWiki feature cache table is unavailable; skipping cache write', error)
      return null
    }
    throw new Error(error.message)
  }
  return data
}

async function refreshXboxGamePass(row: PcGamingWikiFeatures): Promise<PcGamingWikiFeatures> {
  try {
    const xboxGamePass = await getPcgwXboxGamePassByPageId(row.pcgw_page_id!)
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('pcgamingwiki_features')
      .update({ xbox_game_pass: xboxGamePass, xbox_game_pass_checked_at: now })
      .eq('rawg_game_id', row.rawg_game_id)
      .select()
      .single()
    if (error) {
      if (!isMissingFeaturesTableError(error)) {
        console.warn('Could not update Xbox Game Pass cache', error)
      }
      return row
    }
    return data ?? row
  } catch (error) {
    console.warn('Could not refresh Xbox Game Pass; using cached value', error)
    return row
  }
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

function toLiveResult(result: PcgwFeatureResult | null, fallback?: PcGamingWikiFeatures | null): PcGamingWikiFeaturesResult {
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

async function resolvePcGamingWikiFeatures(
  rawgGameId: number,
  steamAppId: number | null
): Promise<PcGamingWikiFeaturesResult> {
  let cached: PcGamingWikiFeatures | null = null
  try {
    cached = await getStoredFeatures(rawgGameId)
  } catch (error) {
    console.warn('Could not read PCGamingWiki feature cache; using live data', error)
  }

  if (cached != null && isFresh(cached)) {
    if (needsXboxGamePassRefresh(cached)) {
      cached = await refreshXboxGamePass(cached)
    }
    return toResult(cached)
  }

  if (steamAppId == null) return toResult(cached)

  try {
    const pcgwResult = await getPcgwFeaturesBySteamAppId(steamAppId)
    try {
      const stored = await upsertFeatures(rawgGameId, steamAppId, pcgwResult)
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

export function usePcGamingWikiFeatures(rawgGameId: number | null, steamAppId: number | null) {
  return useQuery({
    queryKey: ['pcgamingwiki', 'features', rawgGameId, steamAppId] as const,
    queryFn: () => resolvePcGamingWikiFeatures(rawgGameId!, steamAppId),
    enabled: rawgGameId != null,
    staleTime: STALE,
    gcTime: CACHE,
  })
}
