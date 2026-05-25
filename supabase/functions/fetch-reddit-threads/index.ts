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

const DEFAULT_USER_AGENT = 'goodgame/1.0 by goodgame'
const MIN_SUCCESSFUL_SUBREDDITS = 5
const MAX_ERROR_BODY_LENGTH = 200
const SUBREDDIT_FETCH_DELAY_MS = 500
const RATE_LIMIT_RETRY_DELAY_MS = 2_000
const RATE_LIMIT_STATUSES = new Set([403, 429])
const REDDIT_HOSTS = ['www.reddit.com', 'old.reddit.com']

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

interface FetchAttempt {
  posts: RedditPost[]
  error: string | null
  shouldRetry: boolean
}

type SupabaseClient = ReturnType<typeof createClient>

function isValidUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

function getUserAgent(): string {
  const userAgent = Deno.env.get('REDDIT_USER_AGENT')?.trim()
  return userAgent != null && userAgent.length > 0 ? userAgent : DEFAULT_USER_AGENT
}

async function sendAlert(message: string, details: Record<string, unknown>): Promise<void> {
  const webhookUrl = Deno.env.get('REDDIT_ALERT_WEBHOOK_URL')
  if (webhookUrl == null || webhookUrl.trim().length === 0) {
    return
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'fetch-reddit-threads',
        message,
        details,
      }),
    })

    if (!res.ok) {
      console.error(`Alert webhook failed: HTTP ${res.status}`)
    }
  } catch (error) {
    console.error(`Alert webhook failed: ${getErrorMessage(error)}`)
  }
}

async function logFetchError(
  supabase: SupabaseClient,
  message: string,
  details: Record<string, unknown>,
): Promise<void> {
  console.error(`${message}: ${JSON.stringify(details)}`)

  const { error } = await supabase
    .from('reddit_fetch_errors')
    .insert({
      message,
      details,
    })

  if (error) {
    console.error(`Failed to log reddit fetch error: ${error.message}`)
  }

  await sendAlert(message, details)
}

async function fetchSubredditOnce(
  subreddit: string,
  host: string,
  userAgent: string,
): Promise<FetchAttempt> {
  try {
    const res = await fetch(
      `https://${host}/r/${subreddit}/hot.json?t=day&limit=25`,
      {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': userAgent,
        },
      },
    )

    if (!res.ok) {
      const body = await res.text()
      const bodyPreview = body.trim().slice(0, MAX_ERROR_BODY_LENGTH)
      const error = bodyPreview.length > 0
        ? `${host} HTTP ${res.status}: ${bodyPreview}`
        : `${host} HTTP ${res.status}`
      return {
        posts: [],
        error,
        shouldRetry: RATE_LIMIT_STATUSES.has(res.status),
      }
    }

    const listing = await res.json() as RedditListing
    return {
      posts: listing.data.children
        .filter(c => c.kind === 't3')
        .map(c => c.data),
      error: null,
      shouldRetry: false,
    }
  } catch (error) {
    return {
      posts: [],
      error: getErrorMessage(error),
      shouldRetry: false,
    }
  }
}

async function fetchSubreddit(subreddit: string): Promise<SubredditResult> {
  const userAgent = getUserAgent()
  const errors: string[] = []

  for (let i = 0; i < REDDIT_HOSTS.length; i += 1) {
    const host = REDDIT_HOSTS[i]
    const attempt = await fetchSubredditOnce(subreddit, host, userAgent)

    if (attempt.error == null) {
      return { subreddit, posts: attempt.posts, error: null }
    }

    errors.push(attempt.error)
    if (!attempt.shouldRetry) {
      break
    }

    if (i < REDDIT_HOSTS.length - 1) {
      console.warn(
        `Rate-limited fetching r/${subreddit} from ${host}; trying fallback after ${RATE_LIMIT_RETRY_DELAY_MS}ms`,
      )
      await delay(RATE_LIMIT_RETRY_DELAY_MS)
    }
  }

  return { subreddit, posts: [], error: errors.join(' | ') }
}

async function handleRequest(): Promise<Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('Missing env vars', { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const results: SubredditResult[] = []
  for (const subreddit of SUBREDDITS) {
    results.push(await fetchSubreddit(subreddit))
    await delay(SUBREDDIT_FETCH_DELAY_MS)
  }
  const failures = results.filter(result => result.error != null)
  const successfulSubreddits = results.length - failures.length

  if (successfulSubreddits < MIN_SUCCESSFUL_SUBREDDITS) {
    const reasons = failures.map(result => `${result.subreddit}: ${result.error}`)
    await logFetchError(supabase, 'Reddit thread fetch failed', {
      successfulSubreddits,
      failures: reasons,
    })
    return new Response(`Fetch failed: ${reasons.join('; ')}`, { status: 502 })
  }

  if (failures.length > 0) {
    await logFetchError(supabase, 'Reddit thread fetch skipped subreddits', {
      successfulSubreddits,
      failures: failures.map(result => `${result.subreddit}: ${result.error}`),
    })
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

  const { error } = await supabase.rpc('replace_reddit_threads', { p_rows: rows })
  if (error) {
    await logFetchError(supabase, 'Reddit thread replace RPC failed', {
      error: error.message,
      rowCount: rows.length,
    })
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
