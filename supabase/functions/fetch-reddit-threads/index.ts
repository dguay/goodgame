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
const MIN_SUCCESSFUL_SUBREDDITS = 5
const MAX_ERROR_BODY_LENGTH = 200

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

interface SubredditResult {
  subreddit: string
  posts: RedditPost[]
  error: string | null
}

function isValidUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function fetchSubreddit(subreddit: string): Promise<SubredditResult> {
  try {
    const res = await fetch(
      `https://www.reddit.com/r/${subreddit}/hot.json?t=day&limit=25`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
      },
    )

    if (!res.ok) {
      const body = await res.text()
      const bodyPreview = body.trim().slice(0, MAX_ERROR_BODY_LENGTH)
      const error = bodyPreview.length > 0
        ? `HTTP ${res.status}: ${bodyPreview}`
        : `HTTP ${res.status}`
      return { subreddit, posts: [], error }
    }

    const listing = await res.json() as RedditListing
    return {
      subreddit,
      posts: listing.data.children
        .filter(c => c.kind === 't3')
        .map(c => c.data),
      error: null,
    }
  } catch (error) {
    return { subreddit, posts: [], error: getErrorMessage(error) }
  }
}

async function handleRequest(): Promise<Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('Missing env vars', { status: 500 })
  }

  const results = await Promise.all(SUBREDDITS.map(fetchSubreddit))
  const failures = results.filter(result => result.error != null)
  const successfulSubreddits = results.length - failures.length

  if (successfulSubreddits < MIN_SUCCESSFUL_SUBREDDITS) {
    const reasons = failures.map(result => `${result.subreddit}: ${result.error}`)
    console.error(`Fetch failed: ${reasons.join('; ')}`)
    return new Response(`Fetch failed: ${reasons.join('; ')}`, { status: 502 })
  }

  if (failures.length > 0) {
    console.warn(
      `Skipped subreddits: ${failures
        .map(result => `${result.subreddit}: ${result.error}`)
        .join('; ')}`,
    )
  }

  const allPosts = results.flatMap(result => result.posts)

  // Dedupe by URL, keeping the highest-score post per URL.
  const byUrl = new Map<string, RedditPost>()
  for (const post of allPosts) {
    const existing = byUrl.get(post.url)
    if (existing == null || post.score > existing.score) {
      byUrl.set(post.url, post)
    }
  }

  const fetchedAt = new Date().toISOString()

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
      fetched_at: fetchedAt,
    }))

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { error } = await supabase.rpc('replace_reddit_threads', { p_rows: rows })
  if (error) {
    console.error(error)
    return new Response(`RPC failed: ${error.message}`, { status: 500 })
  }

  return new Response(
    JSON.stringify({
      inserted: rows.length,
      skipped: failures.map(result => result.subreddit),
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}

Deno.serve(async () => {
  try {
    return await handleRequest()
  } catch (error) {
    console.error(`Unexpected error: ${getErrorMessage(error)}`)
    return new Response('Unexpected error', { status: 500 })
  }
})
