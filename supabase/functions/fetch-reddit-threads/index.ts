import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUBREDDITS = [
  'games',
  'gaming',
  'pcgaming',
  'PS5',
  'pcmasterrace',
  'GamingLeaksAndRumours',
  'patientgamers',
  'playstation',
  'Steam',
]

const USER_AGENT = 'goodgame-app/1.0'

interface RedditPost {
  id: string
  subreddit: string
  title: string
  url: string
  permalink: string
  score: number
  num_comments: number
  thumbnail: string
  created_utc: number
}

interface RedditListing {
  data: {
    children: Array<{ kind: string; data: RedditPost }>
  }
}

function isValidUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('Missing env vars', { status: 500 })
  }

  // P2: use allSettled so we can detect partial failures
  const results = await Promise.allSettled(
    SUBREDDITS.map(async (sub) => {
      const res = await fetch(
        `https://www.reddit.com/r/${sub}/hot.json?t=day&limit=25`,
        { headers: { 'User-Agent': USER_AGENT } },
      )
      if (!res.ok) throw new Error(`${sub}: HTTP ${res.status}`)
      const listing = await res.json() as RedditListing
      return listing.data.children
        .filter(c => c.kind === 't3')
        .map(c => c.data)
    }),
  )

  // Abort before any DB write if any subreddit failed — preserve existing cache
  const failures = results.filter(r => r.status === 'rejected')
  if (failures.length > 0) {
    const reasons = (failures as PromiseRejectedResult[]).map(r => String(r.reason))
    return new Response(`Fetch failed: ${reasons.join('; ')}`, { status: 502 })
  }

  const allPosts = (results as PromiseFulfilledResult<RedditPost[]>[]).flatMap(r => r.value)

  // Dedupe by URL — keep highest-score post per URL
  const byUrl = new Map<string, RedditPost>()
  for (const post of allPosts) {
    const existing = byUrl.get(post.url)
    if (existing == null || post.score > existing.score) {
      byUrl.set(post.url, post)
    }
  }

  const fetchedAt = new Date().toISOString()

  // Compute rank_score, sort, take top 10
  const rows = [...byUrl.values()]
    .map(post => ({ post, rankScore: post.score + post.num_comments * 3 }))
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 10)
    .map(({ post, rankScore }) => ({
      reddit_id: post.id,
      subreddit: post.subreddit,
      title: post.title,
      url: post.url,
      permalink: post.permalink,
      score: post.score,
      num_comments: post.num_comments,
      thumbnail_url: isValidUrl(post.thumbnail) ? post.thumbnail : null,
      created_utc: new Date(post.created_utc * 1000).toISOString(),
      rank_score: rankScore,
      fetched_at: fetchedAt,  // P3: always update fetched_at on refresh
    }))

  // P1: atomic delete + insert via SQL transaction in RPC
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { error } = await supabase.rpc('replace_reddit_threads', { p_rows: rows })
  if (error) {
    return new Response(`RPC failed: ${error.message}`, { status: 500 })
  }

  return new Response(JSON.stringify({ inserted: rows.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
