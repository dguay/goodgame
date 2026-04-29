import { useQuery } from '@tanstack/react-query'
import {
  searchGames,
  getGameDetail,
  getNewReleases,
  getTopRated,
  getSuggestedGames,
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

export function useSuggestedGames(id: number | null) {
  return useQuery({
    queryKey: ['rawg', 'suggested', id],
    queryFn: () => getSuggestedGames(id!),
    enabled: id !== null,
    staleTime: STALE,
  })
}
