import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RSS2JSON_BASE = 'https://api.rss2json.com/v1/api.json'
const FEED_RSS_URL = 'https://www.reddit.com/user/dggg/m/goodgame/hot.rss?limit=20'

interface Rss2JsonItem {
  title: string
  pubDate: string
  link: string
  author: string
  thumbnail: string
  enclosure?: { thumbnail?: string }
}

interface Rss2JsonResponse {
  status: string
  items?: Rss2JsonItem[]
}

interface RedditThreadRow {
  subreddit: string
  title: string
  url: string
  author: string
  thumbnail_url: string
  pub_date: string
  rank: number
  fetched_at: string
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function resolveThumbnail(item: Rss2JsonItem): string {
  const raw = item.thumbnail || item.enclosure?.thumbnail || ''
  return raw.replace(/&amp;/g, '&')
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function extractSubreddit(link: string): string {
  const match = link.match(/\/r\/([^/]+)\//)
  return match?.[1] ?? 'unknown'
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  const apiUrl = `${RSS2JSON_BASE}?rss_url=${encodeURIComponent(FEED_RSS_URL)}`
  const res = await fetch(apiUrl)
  if (!res.ok) {
    return new Response(
      JSON.stringify({ error: `rss2json fetch failed: ${res.status}` }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  const data = await res.json() as Rss2JsonResponse
  if (data.status !== 'ok' || data.items == null) {
    return new Response(
      JSON.stringify({ error: `rss2json bad response: ${data.status}` }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  const fetchedAt = new Date().toISOString()
  const rows: RedditThreadRow[] = data.items
    .filter((item) => item.author !== '/u/AutoModerator')
    .map((item, index) => ({
      subreddit: extractSubreddit(item.link),
      title: decodeHtmlEntities(item.title),
      url: item.link,
      author: item.author,
      thumbnail_url: resolveThumbnail(item),
      pub_date: new Date(item.pubDate).toISOString(),
      rank: index + 1,
      fetched_at: fetchedAt,
    }))

  if (rows.length > 0) {
    const { error } = await supabase.rpc('replace_reddit_threads', { p_rows: rows })
    if (error) {
      console.error('replace_reddit_threads failed:', error.message)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }
  }

  return new Response(
    JSON.stringify({ inserted: rows.length }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
  )
}

Deno.serve(async (req) => {
  try {
    return await handleRequest(req)
  } catch (error) {
    console.error('Unexpected error:', getErrorMessage(error))
    return new Response(
      JSON.stringify({ error: 'Unexpected error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
