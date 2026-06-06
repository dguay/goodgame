import { useEffect } from 'react'
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { syncLibraryRawgMetadata } from '@/hooks/useLibrary'
import {
  searchGames,
  getGameDetail,
  getGameScreenshots,
  getNewReleases,
  getReleaseCalendar,
} from '@/lib/rawg'
import { DAY_MS, HOUR_MS } from '@/lib/time'
import { useAuthStore } from '@/stores/authStore'

const SEARCH_STALE = 2 * HOUR_MS
const RELEASE_STALE = HOUR_MS
const GAME_DETAIL_STALE = DAY_MS
const STATIC_METADATA_STALE = 30 * DAY_MS
const CACHE = 30 * DAY_MS

function getPlatformSlugs(
  platforms: Awaited<ReturnType<typeof getGameDetail>>['platforms'],
): string[] | null {
  return platforms != null ? platforms.map(p => p.platform.slug) : null
}

export function useGameSearch(query: string) {
  return useQuery({
    queryKey: ['rawg', 'search', query],
    queryFn: () => searchGames(query),
    enabled: query.length > 1,
    staleTime: SEARCH_STALE,
    gcTime: CACHE,
  })
}

export function useGameSearchInfinite(query: string) {
  return useInfiniteQuery({
    queryKey: ['rawg', 'search', 'infinite', query],
    queryFn: ({ pageParam }) => searchGames(query, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.next != null ? lastPageParam + 1 : undefined,
    enabled: query.length > 1,
    staleTime: SEARCH_STALE,
    gcTime: CACHE,
  })
}

export function useGameDetail(id: number | null) {
  const queryClient = useQueryClient()
  const userId = useAuthStore(s => s.user?.id)
  const query = useQuery({
    queryKey: ['rawg', 'game', id],
    queryFn: () => getGameDetail(id!),
    enabled: id !== null,
    staleTime: GAME_DETAIL_STALE,
    gcTime: CACHE,
  })
  const gameId = query.data?.id
  const released = query.data?.released
  const platforms = query.data?.platforms

  useEffect(() => {
    if (userId == null || gameId == null) return

    void syncLibraryRawgMetadata(
      queryClient,
      userId,
      gameId,
      released ?? null,
      getPlatformSlugs(platforms ?? null),
    )
  }, [gameId, platforms, queryClient, released, userId])

  return query
}

export function useGameScreenshots(id: number | null) {
  return useQuery({
    queryKey: ['rawg', 'game', id, 'screenshots'],
    queryFn: () => getGameScreenshots(id!),
    enabled: id !== null,
    staleTime: STATIC_METADATA_STALE,
    gcTime: CACHE,
  })
}

export type ReleaseCalendarMode = 'upcoming' | 'new'

export function useReleasePreview(mode: ReleaseCalendarMode) {
  return useQuery({
    queryKey: ['rawg', 'releasePreview', mode],
    queryFn: () => (mode === 'new' ? getNewReleases() : getReleaseCalendar()),
    staleTime: RELEASE_STALE,
    gcTime: CACHE,
  })
}

export function useReleaseCalendar(
  platformId: number | null,
  mode: ReleaseCalendarMode = 'upcoming',
  enabled = true
) {
  return useInfiniteQuery({
    queryKey: ['rawg', 'releaseCalendar', mode, platformId],
    queryFn: ({ pageParam }) => {
      const page = typeof pageParam === 'number' ? pageParam : 1
      return mode === 'new'
        ? getNewReleases(platformId, page)
        : getReleaseCalendar(platformId, page)
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.next != null ? lastPageParam + 1 : undefined,
    enabled,
    staleTime: RELEASE_STALE,
    gcTime: CACHE,
  })
}
