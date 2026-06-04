import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface NewsItem {
  id: string
  title: string
  link: string
  pubDate: string | null
  description: string | null
  author: string | null
  sourceName: string
  sourceId: string
}

const MAX_ITEMS = 20

async function fetchNews(): Promise<NewsItem[]> {
  const { data, error } = await supabase
    .from('news_articles')
    .select('id, title, url, excerpt, author, published_at, source_id, news_sources(name)')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('fetched_at', { ascending: false })
    .limit(MAX_ITEMS)

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

export function useNews() {
  return useQuery({
    queryKey: ['news'],
    queryFn: fetchNews,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}
