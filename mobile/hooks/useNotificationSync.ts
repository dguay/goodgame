import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLibraryEntries } from '@/hooks/useLibrary'
import { syncAllReleaseNotifications } from '@/lib/notifications'
import { getGameDetail } from '@/lib/rawg'
import {
  classifyMetadataPersistence,
  selectEntriesToRefresh,
} from '@/lib/rawgMetadataRefresh'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { LibraryEntry } from '@/types/database'

function getRawgPlatformSlugs(entry: Awaited<ReturnType<typeof getGameDetail>>): string[] | null {
  return entry.platforms != null ? entry.platforms.map(p => p.platform.slug) : null
}

async function syncStaleRawgMetadata(
  entries: LibraryEntry[],
): Promise<{ enriched: LibraryEntry[]; anyUpdated: boolean }> {
  const needEnrich = selectEntriesToRefresh(entries)
  if (needEnrich.length === 0) return { enriched: entries, anyUpdated: false }

  const enriched = [...entries]
  let anyUpdated = false

  for (const entry of needEnrich) {
    try {
      const game = await getGameDetail(entry.rawg_game_id)
      const rawgMetadataSyncedAt = new Date().toISOString()
      const platforms = getRawgPlatformSlugs(game)
      const persistence = classifyMetadataPersistence(
        await supabase
          .from('library_entries')
          .update({
            release_date: game.released,
            platforms,
            rawg_metadata_synced_at: rawgMetadataSyncedAt,
          })
          .eq('id', entry.id)
          .eq('user_id', entry.user_id)
          .select('id')
          .maybeSingle(),
      )

      if (persistence.outcome !== 'updated') {
        throw new Error(
          persistence.outcome === 'error'
            ? persistence.message
            : `Library entry ${entry.id} was not updated`,
        )
      }

      const idx = enriched.findIndex(e => e.id === entry.id)
      if (idx !== -1) {
        enriched[idx] = {
          ...enriched[idx],
          platforms,
          rawg_metadata_synced_at: rawgMetadataSyncedAt,
          release_date: game.released,
        }
        anyUpdated = true
      }
    } catch (error) {
      console.warn('Could not refresh RAWG metadata for library entry', error)
    }
  }

  return { enriched, anyUpdated }
}

export function useNotificationSync() {
  const { data: entries } = useLibraryEntries()
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)
  const lastEnrichmentKey = useRef<string | null>(null)

  useEffect(() => {
    if (entries == null) return

    void syncAllReleaseNotifications(entries)

    const enrichmentKey = selectEntriesToRefresh(entries)
      .map(e => `${e.id}:${e.updated_at}:${e.rawg_metadata_synced_at ?? ''}`)
      .sort()
      .join('|')
    if (enrichmentKey.length === 0 || enrichmentKey === lastEnrichmentKey.current) return
    lastEnrichmentKey.current = enrichmentKey

    void (async () => {
      const { enriched, anyUpdated } = await syncStaleRawgMetadata(entries)
      if (!anyUpdated) return
      await syncAllReleaseNotifications(enriched)
      if (user != null) {
        await queryClient.invalidateQueries({ queryKey: ['library', user.id] })
      }
    })()
  }, [entries, queryClient, user])
}
