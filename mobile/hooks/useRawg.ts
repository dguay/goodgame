import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import {
  searchGames,
  getGameDetail,
  getNewReleases,
  getTopRated,
} from '@/lib/rawg'

const STALE = 5 * 60 * 1000

export function useGameSearch(query: string) {
  return useQuery({
    queryKey: ['rawg', 'search', query],
    queryFn: () => searchGames(query),
    enabled: query.length > 1,
    staleTime: STALE,
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
  })
}

export function useGameDetail(id: number | null) {
  return useQuery({
    queryKey: ['rawg', 'game', id],
    queryFn: () => getGameDetail(id!),
    enabled: id !== null,
    staleTime: STALE,
  })
}

export function useNewReleases() {
  return useQuery({
    queryKey: ['rawg', 'newReleases'],
    queryFn: getNewReleases,
    staleTime: STALE,
  })
}

export function useTopRated() {
  return useQuery({
    queryKey: ['rawg', 'topRated'],
    queryFn: getTopRated,
    staleTime: STALE,
  })
}
