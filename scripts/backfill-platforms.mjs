#!/usr/bin/env node
// One-time script: populate library_entries.platforms from RAWG for all rows where platforms IS NULL.
// Usage: SUPABASE_SERVICE_KEY=<key> RAWG_API_KEY=<key> node scripts/backfill-platforms.mjs
//
// Get service key from: Supabase dashboard → Project Settings → API → service_role key
// Or run: supabase status (if local) / check supabase dashboard

const SUPABASE_URL = process.env.SUPABASE_URL
const RAWG_API_KEY = process.env.RAWG_API_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SERVICE_KEY) {
  console.error('Set SUPABASE_SERVICE_KEY env var (service_role key from Supabase dashboard)')
  process.exit(1)
}
if (!SUPABASE_URL) {
  console.error('Set SUPABASE_SERVICE_KEY env var (service_role key from Supabase dashboard)')
  process.exit(1)
}
if (!RAWG_API_KEY) {
  console.error('Set RAWG_API_KEY env var')
  process.exit(1)
}

const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { ...opts, headers: { ...sbHeaders, ...(opts.headers ?? {}) } })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Supabase ${opts.method ?? 'GET'} ${path} → ${res.status}: ${body}`)
  }
  return res.json()
}

async function getRawgPlatforms(rawgGameId) {
  const url = `https://api.rawg.io/api/games/${rawgGameId}?key=${RAWG_API_KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`RAWG ${rawgGameId} → ${res.status}`)
  const data = await res.json()
  return (data.platforms ?? []).map(p => p.platform.slug)
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  console.log('Fetching library entries with null platforms...')
  const all = await sbFetch('/library_entries?select=id,rawg_game_id,game_title,platforms')
  console.log(`Total rows: ${all.length}`)
  const entries = all.filter(e => e.platforms == null || e.platforms.length === 0)
  console.log(`Found ${entries.length} entries to backfill`)

  let success = 0
  let failed = 0

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    process.stdout.write(`[${i + 1}/${entries.length}] ${entry.game_title} (rawg:${entry.rawg_game_id})... `)

    try {
      const platforms = await getRawgPlatforms(entry.rawg_game_id)
      await sbFetch(`/library_entries?id=eq.${entry.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ platforms }),
      })
      console.log(`✓ [${platforms.join(', ') || 'none'}]`)
      success++
    } catch (err) {
      console.log(`✗ ${err.message}`)
      failed++
    }

    // Avoid hammering RAWG (free tier: ~20 req/s)
    if (i < entries.length - 1) await sleep(60)
  }

  console.log(`\nDone. ${success} updated, ${failed} failed.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
