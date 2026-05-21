import { useQuery } from '@tanstack/react-query'
import { findSteamAppId } from '@/lib/steam'
import { supabase } from '@/lib/supabase'

// Steam app IDs are stable once resolved, so keep them fresher than app state
// conventions require only when the backing row is absent or changed externally.
const STALE = 30 * 60 * 1000
const CACHE = 24 * 60 * 60 * 1000

interface CachedSteamAppId {
  found: boolean
  steamAppId: number | null
}

function isMissingExternalIdsTableError(message: string): boolean {
  return process.env.NODE_ENV !== 'production'
    && message.includes('game_external_ids')
    && message.includes('schema cache')
}

async function getStoredSteamAppId(rawgGameId: number): Promise<CachedSteamAppId> {
  const { data, error } = await supabase
    .from('game_external_ids')
    .select('steam_app_id')
    .eq('rawg_game_id', rawgGameId)
    .maybeSingle()

  if (error) {
    if (isMissingExternalIdsTableError(error.message)) {
      return { found: false, steamAppId: null }
    }
    throw new Error(error.message)
  }
  return {
    found: data != null,
    steamAppId: data?.steam_app_id ?? null,
  }
}

async function upsertSteamAppId(rawgGameId: number, steamAppId: number | null): Promise<void> {
  const { error } = await supabase
    .from('game_external_ids')
    .upsert({ rawg_game_id: rawgGameId, steam_app_id: steamAppId })

  if (error) {
    if (isMissingExternalIdsTableError(error.message)) return
    throw new Error(error.message)
  }
}

async function resolveSteamAppId(rawgGameId: number, gameName: string): Promise<number | null> {
  const cached = await getStoredSteamAppId(rawgGameId)
  if (cached.found) return cached.steamAppId

  const steamAppId = await findSteamAppId(gameName)
  await upsertSteamAppId(rawgGameId, steamAppId)
  return steamAppId
}

export function useSteamAppId(rawgGameId: number | null, gameName: string | null) {
  return useQuery({
    queryKey: ['steam', 'appId', rawgGameId] as const,
    queryFn: () => resolveSteamAppId(rawgGameId!, gameName!),
    enabled: rawgGameId != null && gameName != null && gameName.trim() !== '',
    staleTime: STALE,
    gcTime: CACHE,
  })
}
