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

function selectSteamAppId(term: string, items: SteamStoreSearchItem[] | undefined): number | null {
  const normalizedTerm = term.toLowerCase()
  const match = items?.find(item => item.name.toLowerCase() === normalizedTerm)
  return match?.id ?? null
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

  const res = await fetch(buildSteamSearchUrl(term))
  if (!res.ok) {
    return jsonResponse(
      { error: `Steam search failed: ${res.status} ${res.statusText}` },
      502,
    )
  }

  const data = await res.json() as SteamStoreSearchResponse
  return jsonResponse({ steamAppId: selectSteamAppId(term, data.items) })
}

Deno.serve(async (req) => {
  try {
    return await handleRequest(req)
  } catch (error) {
    console.error(`Unexpected error: ${getErrorMessage(error)}`)
    return jsonResponse({ error: 'Unexpected error' }, 500)
  }
})
