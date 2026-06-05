import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { decodeHtmlEntities } from '@/lib/htmlEntities'

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

const HOMEPAGE_LIMIT = 5
const LATEST_PAGE_SIZE = 30

function mapRow(row: {
  id: string
  title: string
  url: string
  excerpt: string | null
  author: string | null
  published_at: string | null
  source_id: string
  news_sources: unknown
}): NewsItem {
  return {
    id: row.id,
    title: decodeHtmlEntities(row.title),
    link: row.url,
    pubDate: row.published_at,
    description: row.excerpt ?? null,
    author: row.author ?? null,
    sourceName: (row.news_sources as { name: string } | null)?.name ?? row.source_id,
    sourceId: row.source_id,
  }
}

async function fetchNews(limit = HOMEPAGE_LIMIT): Promise<NewsItem[]> {
  const { data, error } = await supabase
    .from('news_articles')
    .select('id, title, url, excerpt, author, published_at, source_id, news_sources(name)')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('fetched_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map(mapRow)
}

async function fetchNewsPage({ pageParam }: { pageParam: string | null }): Promise<{ items: NewsItem[]; nextCursor: string | null }> {
  let query = supabase
    .from('news_articles')
    .select('id, title, url, excerpt, author, published_at, source_id, news_sources(name)')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('fetched_at', { ascending: false })
    .limit(LATEST_PAGE_SIZE)

  if (pageParam != null) {
    query = query.lt('published_at', pageParam)
  }

  const { data, error } = await query
  if (error) throw error

  const items = (data ?? []).map(mapRow)
  const lastItem = items[items.length - 1]
  const nextCursor = items.length === LATEST_PAGE_SIZE ? (lastItem?.pubDate ?? null) : null

  return { items, nextCursor }
}

export function useNews(limit = HOMEPAGE_LIMIT) {
  return useQuery({
    queryKey: ['news', limit],
    queryFn: () => fetchNews(limit),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

export function useLatestNews() {
  return useInfiniteQuery({
    queryKey: ['news-latest'],
    queryFn: fetchNewsPage,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}
