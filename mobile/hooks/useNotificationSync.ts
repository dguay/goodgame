import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLibraryEntries } from '@/hooks/useLibrary'
import { syncAllReleaseNotifications } from '@/lib/notifications'
import { getGameDetail } from '@/lib/rawg'
import { supabase } from '@/lib/supabase'
import { DAY_MS, HOUR_MS } from '@/lib/time'
import { useAuthStore } from '@/stores/authStore'
import type { LibraryEntry } from '@/types/database'

const DEFAULT_METADATA_STALE_MS = DAY_MS
const NEAR_RELEASE_METADATA_STALE_MS = 12 * HOUR_MS
const NEAR_RELEASE_WINDOW_MS = 14 * DAY_MS

function getRawgPlatformSlugs(entry: Awaited<ReturnType<typeof getGameDetail>>): string[] | null {
  return entry.platforms != null ? entry.platforms.map(p => p.platform.slug) : null
}

function parseTodayAndRelease(
  releaseDate: string | null,
): { todayMs: number; releaseMs: number } | null {
  if (releaseDate == null) return null
  const releaseMs = new Date(`${releaseDate}T00:00:00`).getTime()
  if (Number.isNaN(releaseMs)) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return { todayMs: today.getTime(), releaseMs }
}

function isFutureRelease(releaseDate: string | null): boolean {
  const parsed = parseTodayAndRelease(releaseDate)
  if (parsed == null) return false
  return parsed.releaseMs > parsed.todayMs
}

function isNearRelease(releaseDate: string | null): boolean {
  const parsed = parseTodayAndRelease(releaseDate)
  if (parsed == null) return false
  const diff = parsed.releaseMs - parsed.todayMs
  return diff > 0 && diff <= NEAR_RELEASE_WINDOW_MS
}

function isMetadataStale(entry: LibraryEntry): boolean {
  if (entry.rawg_metadata_synced_at == null) return true

  const syncedAt = new Date(entry.rawg_metadata_synced_at).getTime()
  if (Number.isNaN(syncedAt)) return true

  const staleMs = isNearRelease(entry.release_date)
    ? NEAR_RELEASE_METADATA_STALE_MS
    : DEFAULT_METADATA_STALE_MS

  return Date.now() - syncedAt >= staleMs
}

function shouldRefreshMutableRawgMetadata(entry: LibraryEntry): boolean {
  if (entry.status !== 'want_to_play') return false
  if (entry.release_date == null) return isMetadataStale(entry)
  if (isFutureRelease(entry.release_date)) return isMetadataStale(entry)
  return false
}

async function syncStaleRawgMetadata(
  entries: LibraryEntry[],
): Promise<{ enriched: LibraryEntry[]; anyUpdated: boolean }> {
  const needEnrich = entries.filter(shouldRefreshMutableRawgMetadata)
  if (needEnrich.length === 0) return { enriched: entries, anyUpdated: false }

  const enriched = [...entries]
  let anyUpdated = false

  for (const entry of needEnrich) {
    try {
      const game = await getGameDetail(entry.rawg_game_id)
      const rawgMetadataSyncedAt = new Date().toISOString()
      const platforms = getRawgPlatformSlugs(game)
      await supabase
        .from('library_entries')
        .update({
          release_date: game.released,
          platforms,
          rawg_metadata_synced_at: rawgMetadataSyncedAt,
        })
        .eq('id', entry.id)
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
      .filter(shouldRefreshMutableRawgMetadata)
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
