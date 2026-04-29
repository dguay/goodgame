import { useQuery, useQueries } from '@tanstack/react-query'
import { getGameDetail, getGames } from '@/lib/rawg'
import { useLibraryEntries } from '@/hooks/useLibrary'
import type { RawgGame } from '@/types/rawg'

const AGGRESSIVE_STALE = 30 * 60 * 1000

export function useRecommendations() {
  const { data: entries } = useLibraryEntries()

  const relevantEntries = (entries ?? [])
    .filter(e => e.status === 'done' || e.status === 'playing')
    .slice(0, 10)

  const gameDetailResults = useQueries({
    queries: relevantEntries.map(entry => ({
      queryKey: ['rawg', 'game', entry.rawg_game_id] as const,
      queryFn: () => getGameDetail(entry.rawg_game_id),
      staleTime: AGGRESSIVE_STALE,
    })),
  })

  const genreFrequency = new Map<string, number>()
  for (const result of gameDetailResults) {
    if (result.data != null) {
      for (const genre of result.data.genres ?? []) {
        genreFrequency.set(genre.slug, (genreFrequency.get(genre.slug) ?? 0) + 1)
      }
    }
  }

  const topGenres = [...genreFrequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([slug]) => slug)

  const libraryGameIds = new Set((entries ?? []).map(e => e.rawg_game_id))
  const genreKey = [...topGenres].sort().join(',')

  const { data: rawgData, isLoading: isRecommendationsLoading } = useQuery({
    queryKey: ['rawg', 'recommendations', genreKey] as const,
    queryFn: () =>
      getGames({
        genres: topGenres.join(','),
        ordering: '-metacritic',
        page_size: 20,
      }),
    enabled: topGenres.length > 0,
    staleTime: AGGRESSIVE_STALE,
  })

  const recommendations = (rawgData?.results ?? []).filter(
    (g: RawgGame) => !libraryGameIds.has(g.id),
  )

  const isDetailLoading = gameDetailResults.some(r => r.isLoading)

  return {
    data: recommendations,
    isLoading: isDetailLoading || isRecommendationsLoading,
    hasEnoughData: (entries?.length ?? 0) >= 3,
  }
}
