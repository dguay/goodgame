import { useQuery } from '@tanstack/react-query'
import {
  getPcgwFeaturesBySteamAppId,
  type PcgwFeatureResult,
  type PcgwSupportState,
} from '@/lib/pcgamingwiki'
import { supabase } from '@/lib/supabase'
import { DAY_MS } from '@/lib/time'
import type { PcGamingWikiFeatures } from '@/types/database'

const REFRESH_AFTER_MS = 30 * DAY_MS
const STALE = 30 * 60 * 1000
const CACHE = 24 * 60 * 60 * 1000
// Migration guard: rows cached before these columns existed need one refresh to backfill them.
const FEATURE_FIELDS_ADDED_AT_MS = Date.parse('2026-06-07T23:32:07.000Z')

export interface PcGamingWikiFeaturesResult {
  controllerSupport: PcgwSupportState | null
  officialDiscordUrl: string | null
  oneTwentyFps: PcgwSupportState | null
  ultrawidescreen: PcgwSupportState | null
  pageName: string | null
  perspectives: string[]
  sixtyFps: PcgwSupportState | null
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
  const refreshedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('pcgamingwiki_features')
    .upsert({
      rawg_game_id: rawgGameId,
      steam_app_id: steamAppId,
      pcgw_page_id: result?.pageId ?? null,
      pcgw_page_name: result?.pageName ?? null,
      sixty_fps: result?.sixtyFps ?? null,
      one_twenty_fps: result?.oneTwentyFps ?? null,
      ultrawidescreen: result?.ultrawidescreen ?? null,
      controller_support: result?.controllerSupport ?? null,
      perspectives: result?.perspectives ?? [],
      official_discord_url: result?.officialDiscordUrl ?? null,
      refreshed_at: refreshedAt,
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

function toResult(row: PcGamingWikiFeatures | null): PcGamingWikiFeaturesResult {
  return {
    controllerSupport: row?.controller_support ?? null,
    officialDiscordUrl: row?.official_discord_url ?? null,
    oneTwentyFps: row?.one_twenty_fps ?? null,
    ultrawidescreen: row?.ultrawidescreen ?? null,
    pageName: row?.pcgw_page_name ?? null,
    perspectives: row?.perspectives ?? [],
    sixtyFps: row?.sixty_fps ?? null,
    isDocumented: row != null && row.pcgw_page_name != null,
  }
}

function toLiveResult(result: PcgwFeatureResult | null): PcGamingWikiFeaturesResult {
  return {
    controllerSupport: result?.controllerSupport ?? null,
    officialDiscordUrl: result?.officialDiscordUrl ?? null,
    oneTwentyFps: result?.oneTwentyFps ?? null,
    ultrawidescreen: result?.ultrawidescreen ?? null,
    pageName: result?.pageName ?? null,
    perspectives: result?.perspectives ?? [],
    sixtyFps: result?.sixtyFps ?? null,
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

  if (cached != null && isFresh(cached)) return toResult(cached)
  if (steamAppId == null) return toResult(cached)

  try {
    const pcgwResult = await getPcgwFeaturesBySteamAppId(steamAppId)
    try {
      const stored = await upsertFeatures(rawgGameId, steamAppId, pcgwResult)
      return toResult(stored)
    } catch (error) {
      console.warn('Could not cache PCGamingWiki features; using live data', error)
      return toLiveResult(pcgwResult)
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
