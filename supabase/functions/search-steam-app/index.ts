const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const STEAM_SEARCH_URL = 'https://store.steampowered.com/api/storesearch/'

interface RequestBody {
  term?: unknown
}

interface SteamStoreSearchItem {
  id: number
  name: string
}

interface SteamStoreSearchResponse {
  items?: SteamStoreSearchItem[]
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  })
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function buildSteamSearchUrl(term: string): string {
  const query = new URLSearchParams({
    term,
    l: 'english',
    cc: 'us',
  })
  return `${STEAM_SEARCH_URL}?${query.toString()}`
}

// Strip trademark/copyright symbols and normalize whitespace.
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim()
}

// Strip "NUMBER:" subtitle separators that publishers sometimes drop on Steam.
// "Resident Evil 9: Requiem" → "Resident Evil Requiem"
// Leaves standalone numbers untouched: "NBA 2K24", "Resident Evil 2", "F1 2020".
function stripNumberedSubtitle(name: string): string {
  return name.replace(/\b\d+\s*:\s*/g, '').replace(/\s+/g, ' ').trim()
}

function findExactMatch(items: SteamStoreSearchItem[], normalizedTerm: string): number | null {
  const match = items.find(item => normalizeName(item.name) === normalizedTerm)
  return match?.id ?? null
}

async function fetchItems(term: string): Promise<{ items: SteamStoreSearchItem[]; ok: boolean; status: number; statusText: string }> {
  const res = await fetch(buildSteamSearchUrl(term))
  if (!res.ok) return { items: [], ok: false, status: res.status, statusText: res.statusText }
  const data = await res.json() as SteamStoreSearchResponse
  return { items: data.items ?? [], ok: true, status: res.status, statusText: res.statusText }
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const body = await req.json() as RequestBody
  const term = typeof body.term === 'string' ? body.term.trim() : ''
  if (term === '') {
    return jsonResponse({ error: 'Missing search term' }, 400)
  }

  const normalizedTerm = normalizeName(term)

  const primary = await fetchItems(term)
  if (!primary.ok) {
    return jsonResponse(
      { error: `Steam search failed: ${primary.status} ${primary.statusText}` },
      502,
    )
  }

  const match = findExactMatch(primary.items, normalizedTerm)
  if (match != null) return jsonResponse({ steamAppId: match })

  // No exact match. If the name contains a "NUMBER:" pattern that publishers
  // sometimes drop on Steam (e.g. "Resident Evil 9: Requiem" → "Resident Evil
  // Requiem"), retry with the stripped form regardless of whether the primary
  // search returned fuzzy results or none at all.
  const altTerm = normalizeName(stripNumberedSubtitle(term))
  if (altTerm !== normalizedTerm && altTerm.length > 0) {
    const fallback = await fetchItems(altTerm)
    if (!fallback.ok) {
      // Only propagate the error when the primary search was also empty — Steam
      // is likely down and returning null would be cached as "no app found".
      // If primary returned results Steam is working; degrade gracefully instead.
      if (primary.items.length === 0) {
        return jsonResponse(
          { error: `Steam search failed: ${fallback.status} ${fallback.statusText}` },
          502,
        )
      }
    } else {
      const fallbackMatch = findExactMatch(fallback.items, altTerm)
      if (fallbackMatch != null) return jsonResponse({ steamAppId: fallbackMatch })
    }
  }

  return jsonResponse({ steamAppId: null })
}

Deno.serve(async (req) => {
  try {
    return await handleRequest(req)
  } catch (error) {
    console.error(`Unexpected error: ${getErrorMessage(error)}`)
    return jsonResponse({ error: 'Unexpected error' }, 500)
  }
})
