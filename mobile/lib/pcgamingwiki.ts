export type PcgwSupportState =
  | 'always on'
  | 'false'
  | 'hackable'
  | 'limited'
  | 'true'
  | 'unknown'

export interface PcgwFeatureResult {
  controllerSupport: PcgwSupportState | null
  officialDiscordUrl: string | null
  oneTwentyFps: PcgwSupportState | null
  pageId: number | null
  pageName: string | null
  perspectives: string[]
  sixtyFps: PcgwSupportState | null
  ultrawidescreen: PcgwSupportState | null
}

interface CargoQueryRow {
  title?: {
    ControllerSupport?: string | null
    OneTwentyFps?: string | null
    PageID?: string | null
    PageName?: string | null
    Perspectives?: string | null
    SixtyFps?: string | null
    Ultrawidescreen?: string | null
  }
}

interface CargoQueryResponse {
  cargoquery?: CargoQueryRow[]
}

interface PageSourceResponse {
  query?: {
    pages?: Record<string, {
      revisions?: {
        slots?: {
          main?: {
            '*'?: string
          }
        }
      }[]
    }>
  }
}

const PCGW_API_URL = 'https://www.pcgamingwiki.com/w/api.php'
const PCGW_USER_AGENT = 'Goodgame/1.0'
const FEATURE_SUPPORT_VALUES = new Set<PcgwSupportState>([
  'always on',
  'false',
  'hackable',
  'limited',
  'true',
  'unknown',
])

function parsePageId(value: string | null | undefined): number | null {
  if (value == null) return null
  const pageId = Number(value)
  return Number.isInteger(pageId) && pageId > 0 ? pageId : null
}

export function parsePcgwFeatureSupport(value: string | null | undefined): PcgwSupportState | null {
  if (value == null) return null
  const normalized = value.trim().toLowerCase()
  if (normalized.length === 0) return null
  return FEATURE_SUPPORT_VALUES.has(normalized as PcgwSupportState)
    ? (normalized as PcgwSupportState)
    : 'unknown'
}

export function parsePcgwList(value: string | null | undefined): string[] {
  if (value == null) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

export function parseOfficialDiscordUrl(pageSource: string): string | null {
  const generalInformation = pageSource.match(
    /'''General information'''(?<content>[\s\S]*?)(?:\n==|$)/
  )?.groups?.content
  if (generalInformation == null) return null

  const officialDiscordLink = generalInformation.match(
    /\[(?<url>https?:\/\/(?:discord\.gg|discord(?:app)?\.com\/invite)\/[^\]\s|]+)[^\]]*official discord[^\]]*\]/i
  )
  return officialDiscordLink?.groups?.url ?? null
}

export function getPcgwPageUrl(pageName: string): string {
  return `https://www.pcgamingwiki.com/wiki/${encodeURIComponent(pageName.replaceAll(' ', '_'))}`
}

async function fetchPcgwJson<T>(params: URLSearchParams): Promise<T> {
  const response = await fetch(`${PCGW_API_URL}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': PCGW_USER_AGENT,
    },
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `PCGamingWiki request failed: ${response.status} ${response.statusText} ${body.slice(0, 160)}`
    )
  }

  return (await response.json()) as T
}

async function getPcgwPageSource(pageName: string): Promise<string | null> {
  const params = new URLSearchParams({
    origin: '*',
    action: 'query',
    format: 'json',
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    titles: pageName,
  })

  const body = await fetchPcgwJson<PageSourceResponse>(params)
  const page = Object.values(body.query?.pages ?? {})[0]
  return page?.revisions?.[0]?.slots?.main?.['*'] ?? null
}

export async function getPcgwFeaturesBySteamAppId(
  steamAppId: number
): Promise<PcgwFeatureResult | null> {
  const params = new URLSearchParams({
    origin: '*',
    action: 'cargoquery',
    format: 'json',
    tables: 'Infobox_game,Video,Input',
    fields: [
      'Infobox_game._pageID=PageID',
      'Infobox_game._pageName=PageName',
      'Video.60_FPS=SixtyFps',
      'Video.120_FPS=OneTwentyFps',
      'Video.Ultrawidescreen',
      'Input.Controller_support=ControllerSupport',
      'Infobox_game.Perspectives=Perspectives',
    ].join(','),
    join_on: 'Infobox_game._pageID=Video._pageID,Infobox_game._pageID=Input._pageID',
    where: `Infobox_game.Steam_AppID HOLDS "${steamAppId}"`,
    limit: '1',
  })

  const body = await fetchPcgwJson<CargoQueryResponse>(params)
  const title = body.cargoquery?.[0]?.title
  if (title == null) return null
  const pageName = title.PageName ?? null
  const pageSource = pageName != null ? await getPcgwPageSource(pageName) : null

  return {
    controllerSupport: parsePcgwFeatureSupport(title.ControllerSupport),
    officialDiscordUrl: pageSource != null ? parseOfficialDiscordUrl(pageSource) : null,
    oneTwentyFps: parsePcgwFeatureSupport(title.OneTwentyFps),
    pageId: parsePageId(title.PageID),
    pageName,
    perspectives: parsePcgwList(title.Perspectives),
    sixtyFps: parsePcgwFeatureSupport(title.SixtyFps),
    ultrawidescreen: parsePcgwFeatureSupport(title.Ultrawidescreen),
  }
}
