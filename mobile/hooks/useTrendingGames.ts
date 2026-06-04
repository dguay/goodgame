import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface TrendingGame {
  id: string
  name: string
  slug: string
  imageUrl: string | null
  mentions24h: number
  mentions72h: number
  mentions7d: number
  uniqueSources72h: number
  trendingScore: number
  calculatedAt: string
}

async function fetchTrendingGames(limit = 25): Promise<TrendingGame[]> {
  const { data, error } = await supabase
    .from('news_game_trends')
    .select('trending_score, mentions_24h, mentions_72h, mentions_7d, unique_sources_72h, calculated_at, news_games(id, name, slug, image_url)')
    .order('trending_score', { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data ?? [])
    .filter((row) => row.news_games != null)
    .map((row) => {
      const game = row.news_games as { id: string; name: string; slug: string; image_url: string | null }
      return {
        id: game.id,
        name: game.name,
        slug: game.slug,
        imageUrl: game.image_url,
        mentions24h: row.mentions_24h,
        mentions72h: row.mentions_72h,
        mentions7d: row.mentions_7d,
        uniqueSources72h: row.unique_sources_72h,
        trendingScore: row.trending_score,
        calculatedAt: row.calculated_at,
      }
    })
}

export function useTrendingGames(limit = 25) {
  return useQuery({
    queryKey: ['trending-games', limit],
    queryFn: () => fetchTrendingGames(limit),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}
