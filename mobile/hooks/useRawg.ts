import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import {
  searchGames,
  getGameAdditions,
  getGameDetail,
  getGameMovies,
  getGameScreenshots,
  getGameSeries,
  getNewReleases,
  getTopRated,
} from '@/lib/rawg'

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
  return useQuery({
    queryKey: ['rawg', 'game', id],
    queryFn: () => getGameDetail(id!),
    enabled: id !== null,
    staleTime: STALE,
    gcTime: CACHE,
  })
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

export function useGameMovies(id: number | null) {
  return useQuery({
    queryKey: ['rawg', 'game', id, 'movies'],
    queryFn: () => getGameMovies(id!),
    enabled: id !== null,
    staleTime: STALE,
    gcTime: CACHE,
  })
}

export function useNewReleases() {
  return useQuery({
    queryKey: ['rawg', 'newReleases'],
    queryFn: getNewReleases,
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
