import { useEffect } from 'react'
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { syncLibraryReleaseDateFromRawg } from '@/hooks/useLibrary'
import {
  searchGames,
  getGameAdditions,
  getGameDetail,
  getGameScreenshots,
  getGameSeries,
  getNewReleases,
  getReleaseCalendar,
  getTopRated,
} from '@/lib/rawg'
import { useAuthStore } from '@/stores/authStore'

const STALE = 5 * 60 * 1000
const CACHE = 30 * 60 * 1000

export function useGameSearch(query: string) {
  return useQuery({
    queryKey: ['rawg', 'search', query],
    queryFn: () => searchGames(query),
    enabled: query.length > 1,
    staleTime: STALE,
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
    staleTime: STALE,
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
    staleTime: STALE,
    gcTime: CACHE,
  })

  useEffect(() => {
    if (userId == null || query.data?.released == null) return

    void syncLibraryReleaseDateFromRawg(
      queryClient,
      userId,
      query.data.id,
      query.data.released,
    )
  }, [query.data?.id, query.data?.released, queryClient, userId])

  return query
}

export function useGameAdditions(id: number | null) {
  return useQuery({
    queryKey: ['rawg', 'game', id, 'additions'],
    queryFn: () => getGameAdditions(id!),
    enabled: id !== null,
    staleTime: STALE,
    gcTime: CACHE,
  })
}

export function useGameSeries(id: number | null) {
  return useQuery({
    queryKey: ['rawg', 'game', id, 'series'],
    queryFn: () => getGameSeries(id!),
    enabled: id !== null,
    staleTime: STALE,
    gcTime: CACHE,
  })
}

export function useGameScreenshots(id: number | null) {
  return useQuery({
    queryKey: ['rawg', 'game', id, 'screenshots'],
    queryFn: () => getGameScreenshots(id!),
    enabled: id !== null,
    staleTime: STALE,
    gcTime: CACHE,
  })
}

export type ReleaseCalendarMode = 'upcoming' | 'new'

export function useReleasePreview(mode: ReleaseCalendarMode) {
  return useQuery({
    queryKey: ['rawg', 'releasePreview', mode],
    queryFn: () => (mode === 'new' ? getNewReleases() : getReleaseCalendar()),
    staleTime: STALE,
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
    staleTime: STALE,
    gcTime: CACHE,
  })
}

export function useTopRated() {
  return useQuery({
    queryKey: ['rawg', 'topRated'],
    queryFn: getTopRated,
    staleTime: STALE,
    gcTime: CACHE,
  })
}
