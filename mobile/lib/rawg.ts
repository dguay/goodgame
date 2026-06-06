import type {
  GetGamesParams,
  RawgGame,
  RawgGameDetail,
  RawgPaginatedResponse,
  RawgScreenshot,
} from '@/types/rawg'
import { addLocalDays, formatLocalDate } from '@/lib/dates'

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

export async function getGameScreenshots(
  id: number,
): Promise<RawgPaginatedResponse<RawgScreenshot>> {
  return get<RawgPaginatedResponse<RawgScreenshot>>(`/games/${id}/screenshots`, {
    page_size: 12,
  })
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

export async function getNewReleases(
  platformId: number | null = null,
  page = 1,
): Promise<RawgPaginatedResponse<RawgGame>> {
  const today = new Date()
  const thirtyDaysAgo = addLocalDays(today, -30)
  const params: Record<string, string | number> = {
    dates: `${formatLocalDate(thirtyDaysAgo)},${formatLocalDate(today)}`,
    ordering: '-released',
    page,
    page_size: 20,
  }

  if (platformId !== null) params.platforms = platformId

  return get<RawgPaginatedResponse<RawgGame>>('/games', params)
}

export async function getReleaseCalendar(
  platformId: number | null = null,
  page = 1,
): Promise<RawgPaginatedResponse<RawgGame>> {
  const today = new Date()
  const tomorrow = addLocalDays(today, 1)
  const oneYearFromNow = new Date(today)
  oneYearFromNow.setFullYear(today.getFullYear() + 1)
  const params: Record<string, string | number> = {
    dates: `${formatLocalDate(tomorrow)},${formatLocalDate(oneYearFromNow)}`,
    ordering: 'released',
    page,
    page_size: 20,
  }

  if (platformId !== null) params.platforms = platformId

  return get<RawgPaginatedResponse<RawgGame>>('/games', params)
}
