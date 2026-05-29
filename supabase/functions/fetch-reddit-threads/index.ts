import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RSS2JSON_BASE = 'https://api.rss2json.com/v1/api.json'
const FEED_RSS_URL = 'https://www.reddit.com/user/dggg/m/goodgame/hot.rss?limit=20'
const ALERT_EMAIL = 'davidguay01@gmail.com'

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

async function sendAlert(subject: string, message: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.error('RESEND_API_KEY not set, skipping alert')
    return
  }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: ALERT_EMAIL,
        subject: `[fetch-reddit-threads] ${subject}`,
        text: message,
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    console.error('Failed to send alert email:', getErrorMessage(err))
  }
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
  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(25_000) })
  if (!res.ok) {
    const msg = `rss2json fetch failed: ${res.status}`
    await sendAlert('rss2json fetch failed', msg)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  const data = await res.json() as Rss2JsonResponse
  if (data.status !== 'ok' || data.items == null) {
    const msg = `rss2json bad response: ${data.status}`
    await sendAlert('rss2json bad response', msg)
    return new Response(
      JSON.stringify({ error: msg }),
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
      await sendAlert('DB upsert failed', `replace_reddit_threads error: ${error.message}`)
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
    const msg = getErrorMessage(error)
    console.error('Unexpected error:', msg)
    await sendAlert('Unexpected error', msg)
    return new Response(
      JSON.stringify({ error: 'Unexpected error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
