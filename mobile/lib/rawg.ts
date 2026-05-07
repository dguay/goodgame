import type {
  GetGamesParams,
  RawgGame,
  RawgGameDetail,
  RawgMovie,
  RawgPaginatedResponse,
  RawgScreenshot,
} from '@/types/rawg'

const BASE = 'https://api.rawg.io/api'

function apiKey(): string {
  const key = process.env.EXPO_PUBLIC_RAWG_API_KEY
  if (!key) throw new Error('EXPO_PUBLIC_RAWG_API_KEY is not set')
  return key
}

function buildUrl(path: string, params: Record<string, string | number> = {}): string {
  const query = new URLSearchParams({ key: apiKey() })
  for (const [k, v] of Object.entries(params)) {
    query.set(k, String(v))
  }
  return `${BASE}${path}?${query.toString()}`
}

async function get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = buildUrl(path, params)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`RAWG request failed: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function searchGames(
  query: string,
  page = 1,
): Promise<RawgPaginatedResponse<RawgGame>> {
  return get<RawgPaginatedResponse<RawgGame>>('/games', {
    search: query,
    page,
    page_size: 20,
  })
}

export async function getGameDetail(id: number): Promise<RawgGameDetail> {
  return get<RawgGameDetail>(`/games/${id}`)
}

export async function getGameAdditions(id: number): Promise<RawgPaginatedResponse<RawgGame>> {
  return get<RawgPaginatedResponse<RawgGame>>(`/games/${id}/additions`, {
    page_size: 10,
  })
}

export async function getGameSeries(id: number): Promise<RawgPaginatedResponse<RawgGame>> {
  return get<RawgPaginatedResponse<RawgGame>>(`/games/${id}/game-series`, {
    page_size: 10,
  })
}

export async function getGameScreenshots(
  id: number,
): Promise<RawgPaginatedResponse<RawgScreenshot>> {
  return get<RawgPaginatedResponse<RawgScreenshot>>(`/games/${id}/screenshots`, {
    page_size: 12,
  })
}

export async function getGameMovies(id: number): Promise<RawgPaginatedResponse<RawgMovie>> {
  return get<RawgPaginatedResponse<RawgMovie>>(`/games/${id}/movies`)
}

export async function getGames(
  params: GetGamesParams,
): Promise<RawgPaginatedResponse<RawgGame>> {
  const mapped: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) mapped[k] = v
  }
  return get<RawgPaginatedResponse<RawgGame>>('/games', mapped)
}

export async function getNewReleases(): Promise<RawgPaginatedResponse<RawgGame>> {
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return get<RawgPaginatedResponse<RawgGame>>('/games', {
    dates: `${fmt(thirtyDaysAgo)},${fmt(today)}`,
    ordering: '-released',
    page_size: 20,
  })
}

export async function getTopRated(): Promise<RawgPaginatedResponse<RawgGame>> {
  return get<RawgPaginatedResponse<RawgGame>>('/games', {
    ordering: '-metacritic',
    metacritic: '80,100',
    page_size: 20,
  })
}
