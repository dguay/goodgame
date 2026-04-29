import { useQueries } from '@tanstack/react-query'
import { getGameDetail } from '@/lib/rawg'
import { useLibraryEntries } from '@/hooks/useLibrary'
import type { LibraryStatus } from '@/types'

export interface ProfileStats {
  totalGames: number
  byStatus: Record<LibraryStatus, number>
  totalPlaytimeMinutes: number
  averageRating: number | null
  topGenres: string[]
}

const EMPTY_STATS: ProfileStats = {
  totalGames: 0,
  byStatus: { want_to_play: 0, playing: 0, done: 0, did_not_finish: 0 },
  totalPlaytimeMinutes: 0,
  averageRating: null,
  topGenres: [],
}

const STALE = 30 * 60 * 1000

export function useProfileStats(): { data: ProfileStats; isLoading: boolean } {
  const { data: entries, isLoading: entriesLoading } = useLibraryEntries()

  const genreSourceEntries = (entries ?? [])
    .filter(e => e.status === 'done' || e.status === 'playing')
    .slice(0, 10)

  const gameDetailResults = useQueries({
    queries: genreSourceEntries.map(entry => ({
      queryKey: ['rawg', 'game', entry.rawg_game_id] as const,
      queryFn: () => getGameDetail(entry.rawg_game_id),
      staleTime: STALE,
    })),
  })

  if (entries == null) return { data: EMPTY_STATS, isLoading: entriesLoading }

  const byStatus: Record<LibraryStatus, number> = {
    want_to_play: 0,
    playing: 0,
    done: 0,
    did_not_finish: 0,
  }
  let totalPlaytimeMinutes = 0
  const ratings: number[] = []

  for (const entry of entries) {
    byStatus[entry.status as LibraryStatus] += 1
    if (entry.personal_playtime_minutes != null) {
      totalPlaytimeMinutes += entry.personal_playtime_minutes
    }
    if (entry.personal_rating != null) {
      ratings.push(Number(entry.personal_rating))
    }
  }

  const averageRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null

  const genreFreq = new Map<string, number>()
  for (const result of gameDetailResults) {
    if (result.data != null) {
      for (const genre of result.data.genres ?? []) {
        genreFreq.set(genre.name, (genreFreq.get(genre.name) ?? 0) + 1)
      }
    }
  }

  const topGenres = [...genreFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name)

  return {
    data: {
      totalGames: entries.length,
      byStatus,
      totalPlaytimeMinutes,
      averageRating,
      topGenres,
    },
    isLoading: entriesLoading || gameDetailResults.some(r => r.isLoading),
  }
}
