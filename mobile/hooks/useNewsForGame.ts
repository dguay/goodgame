import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { NewsItem } from './useNews'

export interface NewsGame {
  id: string
  name: string
  slug: string
  imageUrl: string | null
  released: string | null
  platforms: string[]
  genres: string[]
}

async function fetchNewsGame(slug: string): Promise<NewsGame | null> {
  const { data, error } = await supabase
    .from('news_games')
    .select('id, name, slug, image_url, released, platforms, genres')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  if (data == null) return null

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    imageUrl: data.image_url,
    released: data.released,
    platforms: data.platforms ?? [],
    genres: data.genres ?? [],
  }
}

async function fetchArticlesForGame(gameId: string, limit = 50): Promise<NewsItem[]> {
  const { data: articleGameLinks, error: linkError } = await supabase
    .from('news_article_games')
    .select('article_id')
    .eq('game_id', gameId)

  if (linkError) throw linkError
  if (!articleGameLinks || articleGameLinks.length === 0) return []

  const articleIds = articleGameLinks.map((row) => row.article_id)

  const { data, error } = await supabase
    .from('news_articles')
    .select('id, title, url, excerpt, author, published_at, source_id, news_sources(name)')
    .in('id', articleIds)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    link: row.url,
    pubDate: row.published_at,
    description: row.excerpt ?? null,
    author: row.author ?? null,
    sourceName: (row.news_sources as { name: string } | null)?.name ?? row.source_id,
    sourceId: row.source_id,
  }))
}

export function useNewsGame(slug: string) {
  return useQuery({
    queryKey: ['news-game', slug],
    queryFn: () => fetchNewsGame(slug),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })
}

export function useNewsGameArticles(gameId: string | undefined) {
  return useQuery({
    queryKey: ['news-game-articles', gameId],
    queryFn: () => fetchArticlesForGame(gameId!),
    enabled: gameId != null,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}
