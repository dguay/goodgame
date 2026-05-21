import { supabase } from '@/lib/supabase'

interface SteamAppSearchResponse {
  steamAppId: number | null
}

export function getSteamStoreUrl(steamAppId: number): string {
  return `https://store.steampowered.com/app/${steamAppId}`
}

export async function findSteamAppId(gameName: string): Promise<number | null> {
  const term = gameName.trim()
  if (term === '') return null

  const { data, error } = await supabase.functions.invoke<SteamAppSearchResponse>(
    'search-steam-app',
    { body: { term } },
  )

  if (error) throw new Error(error.message)
  return data?.steamAppId ?? null
}
