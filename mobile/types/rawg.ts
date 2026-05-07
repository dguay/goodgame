export interface RawgGenre {
  id: number
  name: string
  slug: string
}

export interface RawgPlatformEntry {
  platform: {
    id: number
    name: string
    slug: string
  }
}

export interface RawgScreenshot {
  id: number
  image: string
}

export interface RawgGame {
  id: number
  name: string
  background_image: string | null
  released: string | null
  metacritic: number | null
  rating: number
  ratings_count: number
  genres: RawgGenre[] | null
  platforms: RawgPlatformEntry[] | null
  short_screenshots: RawgScreenshot[] | null
}

export interface RawgDeveloper {
  id: number
  name: string
}

export interface RawgPublisher {
  id: number
  name: string
}

export interface RawgGameDetail extends RawgGame {
  description_raw: string
  developers: RawgDeveloper[]
  publishers: RawgPublisher[]
  website: string
  playtime: number
  reddit_url: string | null
}

export interface RawgPaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface RawgMovie {
  id: number
  name: string
  preview: string
  data: Record<string, string>
}

export interface GetGamesParams {
  page?: number
  page_size?: number
  search?: string
  ordering?: string
  genres?: string
  dates?: string
  metacritic?: string
  platforms?: string
}
