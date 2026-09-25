import { useQuery } from '@tanstack/react-query'
import {
  PCGW_FEATURES_GC_MS,
  PCGW_FEATURES_STALE_MS,
  pcFeatureCacheWrite,
  resolvePcGamingWikiFeatures,
  type PcGamingWikiFeaturesResult,
} from '@/lib/pcgamingwikiCache'
import {
  getPcgwFeaturesByGameName,
  getPcgwFeaturesBySteamAppId,
  getPcgwXboxGamePassByPageId,
  type PcGamingWikiInvoke,
  type PcgwFeatureResult,
} from '@/lib/pcgamingwiki'
import { supabase } from '@/lib/supabase'
import type { PcGamingWikiFeatures } from '@/types/database'

export type { PcGamingWikiFeaturesResult }

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
  steamAppId: number | null,
  result: PcgwFeatureResult | null
): Promise<PcGamingWikiFeatures | null> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('pcgamingwiki_features')
    .upsert(pcFeatureCacheWrite(rawgGameId, steamAppId, result, now))
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
    const xboxGamePass = await getPcgwXboxGamePassByPageId(row.pcgw_page_id!, invokePcGamingWiki)
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

const invokePcGamingWiki: PcGamingWikiInvoke = (body) =>
  supabase.functions.invoke('pcgamingwiki-features', { body })

const featureLookup = {
  bySteamAppId: (steamAppId: number) => getPcgwFeaturesBySteamAppId(steamAppId, invokePcGamingWiki),
  byGameName: (gameName: string) => getPcgwFeaturesByGameName(gameName, invokePcGamingWiki),
}

const featureStore = {
  read: getStoredFeatures,
  write: upsertFeatures,
  refreshXboxGamePass,
}

export function usePcGamingWikiFeatures(
  rawgGameId: number | null,
  steamAppId: number | null,
  gameName: string | null,
  steamLookupComplete: boolean,
) {
  return useQuery({
    queryKey: ['pcgamingwiki', 'features', rawgGameId, steamAppId, gameName] as const,
    queryFn: () => resolvePcGamingWikiFeatures(rawgGameId!, steamAppId, gameName, featureStore, featureLookup),
    enabled: rawgGameId != null && steamLookupComplete,
    staleTime: PCGW_FEATURES_STALE_MS,
    gcTime: PCGW_FEATURES_GC_MS,
  })
}
