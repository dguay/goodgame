import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLibraryEntries } from '@/hooks/useLibrary'
import { syncAllReleaseNotifications } from '@/lib/notifications'
import { getGameDetail } from '@/lib/rawg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { LibraryEntry } from '@/types/database'

async function enrichMissingReleaseDates(
  entries: LibraryEntry[],
): Promise<{ enriched: LibraryEntry[]; anyUpdated: boolean }> {
  const needEnrich = entries.filter(e => e.release_date == null)
  if (needEnrich.length === 0) return { enriched: entries, anyUpdated: false }

  const enriched = [...entries]
  let anyUpdated = false

  for (const entry of needEnrich) {
    try {
      const game = await getGameDetail(entry.rawg_game_id)
      if (game.released == null) continue
      await supabase
        .from('library_entries')
        .update({ release_date: game.released })
        .eq('id', entry.id)
      const idx = enriched.findIndex(e => e.id === entry.id)
      if (idx !== -1) {
        enriched[idx] = { ...enriched[idx], release_date: game.released }
        anyUpdated = true
      }
    } catch {
      // skip individual failures, will retry next session
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

    const enrichmentKey = entries
      .filter(e => e.release_date == null)
      .map(e => `${e.id}:${e.updated_at}`)
      .sort()
      .join('|')
    if (enrichmentKey.length === 0 || enrichmentKey === lastEnrichmentKey.current) return
    lastEnrichmentKey.current = enrichmentKey

    void (async () => {
      const { enriched, anyUpdated } = await enrichMissingReleaseDates(entries)
      if (!anyUpdated) return
      await syncAllReleaseNotifications(enriched)
      if (user != null) {
        await queryClient.invalidateQueries({ queryKey: ['library', user.id] })
      }
    })()
  }, [entries, queryClient, user])
}
