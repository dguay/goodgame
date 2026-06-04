import { useQuery } from '@tanstack/react-query'

const RSS2JSON_URL =
  'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Ffeeds.feedburner.com%2Fign%2Fgames-all'

const ALLOWED_HOSTS = new Set(['www.ign.com', 'ign.com'])

const MAX_ITEMS = 10

export interface NewsItem {
  title: string
  link: string
  pubDate: string
  description: string
  author: string
}

export interface NewsFeed {
  feedTitle: string
  items: NewsItem[]
}

async function fetchNews(): Promise<NewsFeed> {
  const res = await fetch(RSS2JSON_URL)
  if (!res.ok) throw new Error(`News fetch failed: ${res.status}`)
  const json = (await res.json()) as {
    status: string
    feed: { title: string; link: string }
    items: Array<{
      title: string
      link: string
      pubDate: string
      description: string
      author: string
    }>
  }
  if (json.status !== 'ok') throw new Error('RSS parse failed')

  return {
    feedTitle: json.feed.title,
    items: json.items
      .filter((item) => {
        try {
          const url = new URL(item.link)
          return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname)
        } catch {
          return false
        }
      })
      .slice(0, MAX_ITEMS)
      .map((item) => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        description: item.description,
        author: item.author,
      })),
  }
}

export function useNews() {
  return useQuery({
    queryKey: ['news'],
    queryFn: fetchNews,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}
