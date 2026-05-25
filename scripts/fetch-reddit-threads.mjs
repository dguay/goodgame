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
const SCHEDULED_HOURS = new Set([6, 8, 10, 12, 14, 16, 18, 20])

function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim()
  if (value == null || value.length === 0) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function getUserAgent() {
  return process.env.REDDIT_USER_AGENT?.trim() || DEFAULT_USER_AGENT
}

function getEasternHour() {
  const hour = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'America/Toronto',
  }).format(new Date())

  return Number(hour)
}

function shouldRunNow() {
  if (process.env.GITHUB_EVENT_NAME !== 'schedule') {
    return true
  }

  return SCHEDULED_HOURS.has(getEasternHour())
}

function isValidUrl(value) {
  return value.startsWith('http://') || value.startsWith('https://')
}

function getSupabaseHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  }
}

async function logFetchError(supabaseUrl, serviceRoleKey, message, details) {
  console.error(`${message}: ${JSON.stringify(details)}`)

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/reddit_fetch_errors`, {
      method: 'POST',
      headers: {
        ...getSupabaseHeaders(serviceRoleKey),
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ message, details }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`Failed to log reddit fetch error: HTTP ${res.status}: ${body}`)
    }
  } catch (error) {
    console.error(`Failed to log reddit fetch error: ${error.message}`)
  }
}

async function fetchSubredditOnce(subreddit, host, userAgent) {
  try {
    const res = await fetch(`https://${host}/r/${subreddit}/hot.json?t=day&limit=25`, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': userAgent,
      },
    })

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

    const listing = await res.json()
    return {
      posts: listing.data.children
        .filter(child => child.kind === 't3')
        .map(child => child.data),
      error: null,
      shouldRetry: false,
    }
  } catch (error) {
    return {
      posts: [],
      error: error.message,
      shouldRetry: false,
    }
  }
}

async function fetchSubreddit(subreddit) {
  const userAgent = getUserAgent()
  const errors = []

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

function buildRows(posts) {
  const byUrl = new Map()

  for (const post of posts) {
    const existing = byUrl.get(post.url)
    if (existing == null || post.score > existing.score) {
      byUrl.set(post.url, post)
    }
  }

  const fetchedAt = new Date().toISOString()

  return [...byUrl.values()]
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
}

async function replaceRedditThreads(supabaseUrl, serviceRoleKey, rows) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/replace_reddit_threads`, {
    method: 'POST',
    headers: getSupabaseHeaders(serviceRoleKey),
    body: JSON.stringify({ p_rows: rows }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`RPC failed: HTTP ${res.status}: ${body}`)
  }
}

async function main() {
  if (!shouldRunNow()) {
    console.log('Skipping Reddit fetch outside the Eastern daytime schedule.')
    return
  }

  const supabaseUrl = getRequiredEnv('SUPABASE_URL').replace(/\/$/, '')
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  const results = []

  for (const subreddit of SUBREDDITS) {
    results.push(await fetchSubreddit(subreddit))
    await delay(SUBREDDIT_FETCH_DELAY_MS)
  }

  const failures = results.filter(result => result.error != null)
  const successfulSubreddits = results.length - failures.length

  if (successfulSubreddits < MIN_SUCCESSFUL_SUBREDDITS) {
    const reasons = failures.map(result => `${result.subreddit}: ${result.error}`)
    await logFetchError(supabaseUrl, serviceRoleKey, 'Reddit thread fetch failed', {
      successfulSubreddits,
      failures: reasons,
    })
    throw new Error(`Fetch failed: ${reasons.join('; ')}`)
  }

  if (failures.length > 0) {
    await logFetchError(supabaseUrl, serviceRoleKey, 'Reddit thread fetch skipped subreddits', {
      successfulSubreddits,
      failures: failures.map(result => `${result.subreddit}: ${result.error}`),
    })
  }

  const rows = buildRows(results.flatMap(result => result.posts))

  try {
    await replaceRedditThreads(supabaseUrl, serviceRoleKey, rows)
  } catch (error) {
    await logFetchError(supabaseUrl, serviceRoleKey, 'Reddit thread replace RPC failed', {
      error: error.message,
      rowCount: rows.length,
    })
    throw error
  }

  console.log(`Inserted ${rows.length} Reddit threads.`)
}

await main()
