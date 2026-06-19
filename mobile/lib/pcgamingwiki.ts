export type PcgwSupportState =
  | 'always on'
  | 'false'
  | 'hackable'
  | 'limited'
  | 'true'
  | 'unknown'

export interface PcgwFeatureResult {
  controllerSupport: PcgwSupportState | null
  fourKUltraHd: PcgwSupportState | null
  officialDiscordUrl: string | null
  pageSourceFetchFailed: boolean
  oneTwentyFps: PcgwSupportState | null
  pageId: number | null
  pageName: string | null
  perspectives: string[]
  sixtyFps: PcgwSupportState | null
  ultrawidescreen: PcgwSupportState | null
  xboxGamePass: PcgwSupportState | null
  xboxGamePassFetchFailed: boolean
}

interface CargoQueryRow {
  title?: {
    ControllerSupport?: string | null
    FourKUltraHd?: string | null
    OneTwentyFps?: string | null
    PageID?: string | null
    PageName?: string | null
    Perspectives?: string | null
    SixtyFps?: string | null
    Ultrawidescreen?: string | null
    XboxGamePass?: string | null
  }
}

interface CargoQueryResponse {
  cargoquery?: CargoQueryRow[]
}

interface SearchResponse {
  query?: {
    search?: {
      ns?: number
      title?: string
    }[]
  }
}

interface RedirectResponse {
  query?: {
    redirects?: {
      from?: string
      to?: string
    }[]
    pages?: Record<string, {
      missing?: string
      ns?: number
      pageid?: number
      title?: string
    }>
  }
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
const PCGW_TITLE_SEARCH_LIMIT = 5
const PCGW_FEATURE_FIELDS = [
  'Infobox_game._pageID=PageID',
  'Infobox_game._pageName=PageName',
  'Video.4K_Ultra_HD=FourKUltraHd',
  'Video.60_FPS=SixtyFps',
  'Video.120_FPS=OneTwentyFps',
  'Video.Ultrawidescreen',
  'Input.Controller_support=ControllerSupport',
  'Infobox_game.Perspectives=Perspectives',
].join(',')
const PCGW_FEATURE_JOIN = 'Infobox_game._pageID=Video._pageID,Infobox_game._pageID=Input._pageID'
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

export function getUniquePcgwPageNames(pageNames: string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const pageName of pageNames) {
    const normalized = pageName.trim()
    if (normalized === '' || normalized.includes('|') || seen.has(normalized)) continue
    seen.add(normalized)
    unique.push(normalized)
  }
  return unique
}

export function sortPcgwResolvedPageNamesByInput(
  resolvedPageNames: string[],
  inputPageNames: string[],
  redirects: { from?: string; to?: string }[],
): string[] {
  const priorityByPageName = new Map<string, number>()
  const redirectToByFrom = new Map(
    redirects
      .filter((redirect): redirect is { from: string; to: string } =>
        redirect.from != null && redirect.to != null
      )
      .map((redirect) => [redirect.from, redirect.to] as const),
  )

  getUniquePcgwPageNames(inputPageNames).forEach((pageName, index) => {
    const resolvedPageName = redirectToByFrom.get(pageName) ?? pageName
    const currentPriority = priorityByPageName.get(resolvedPageName)
    if (currentPriority == null || index < currentPriority) {
      priorityByPageName.set(resolvedPageName, index)
    }
  })

  return getUniquePcgwPageNames(resolvedPageNames).sort((a, b) =>
    (priorityByPageName.get(a) ?? Number.POSITIVE_INFINITY) -
    (priorityByPageName.get(b) ?? Number.POSITIVE_INFINITY)
  )
}

function escapeCargoString(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
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

async function resolvePcgwPageNames(pageNames: string[]): Promise<string[]> {
  const uniquePageNames = getUniquePcgwPageNames(pageNames)
  if (uniquePageNames.length === 0) return []

  const params = new URLSearchParams({
    origin: '*',
    action: 'query',
    format: 'json',
    redirects: '1',
    titles: uniquePageNames.join('|'),
  })

  const body = await fetchPcgwJson<RedirectResponse>(params)
  const resolvedPageNames = Object.values(body.query?.pages ?? {})
    .filter((page) => page.missing == null && page.ns === 0 && page.pageid != null)
    .map((page) => page.title)
    .filter((title): title is string => title != null)

  return sortPcgwResolvedPageNamesByInput(
    resolvedPageNames,
    uniquePageNames,
    body.query?.redirects ?? [],
  )
}

async function searchPcgwPageNames(gameName: string): Promise<string[]> {
  const term = gameName.trim()
  if (term === '') return []

  const params = new URLSearchParams({
    origin: '*',
    action: 'query',
    format: 'json',
    list: 'search',
    srsearch: term,
    srlimit: PCGW_TITLE_SEARCH_LIMIT.toString(),
  })

  const body = await fetchPcgwJson<SearchResponse>(params)
  return getUniquePcgwPageNames(
    (body.query?.search ?? [])
      .filter((result) => result.ns === 0)
      .map((result) => result.title)
      .filter((title): title is string => title != null),
  )
}

async function getPcgwFeaturesFromTitle(
  title: CargoQueryRow['title'] | undefined
): Promise<PcgwFeatureResult | null> {
  if (title == null) return null
  const pageId = parsePageId(title.PageID)
  const pageName = title.PageName ?? null

  const [pageSourceResult, xboxGamePassResult] = await Promise.allSettled([
    pageName != null ? getPcgwPageSource(pageName) : Promise.resolve(null),
    pageId != null ? getPcgwXboxGamePassByPageId(pageId) : Promise.resolve(null),
  ])

  const pageSourceFetchFailed = pageSourceResult.status === 'rejected'
  const pageSource = pageSourceResult.status === 'fulfilled' ? pageSourceResult.value : null
  const xboxGamePassFetchFailed = xboxGamePassResult.status === 'rejected'
  const xboxGamePass = xboxGamePassResult.status === 'fulfilled' ? xboxGamePassResult.value : null

  return {
    controllerSupport: parsePcgwFeatureSupport(title.ControllerSupport),
    fourKUltraHd: parsePcgwFeatureSupport(title.FourKUltraHd),
    officialDiscordUrl: pageSource != null ? parseOfficialDiscordUrl(pageSource) : null,
    pageSourceFetchFailed,
    oneTwentyFps: parsePcgwFeatureSupport(title.OneTwentyFps),
    pageId,
    pageName,
    perspectives: parsePcgwList(title.Perspectives),
    sixtyFps: parsePcgwFeatureSupport(title.SixtyFps),
    ultrawidescreen: parsePcgwFeatureSupport(title.Ultrawidescreen),
    xboxGamePass,
    xboxGamePassFetchFailed,
  }
}

const GAME_PASS_SUPPORT_PRIORITY: Record<PcgwSupportState, number> = {
  'always on': 6,
  'true': 5,
  'limited': 4,
  'hackable': 3,
  'unknown': 2,
  'false': 1,
}

export async function getPcgwXboxGamePassByPageId(pageId: number): Promise<PcgwSupportState | null> {
  const params = new URLSearchParams({
    origin: '*',
    action: 'cargoquery',
    format: 'json',
    tables: 'Availability',
    fields: 'Availability.Xbox_Game_Pass=XboxGamePass',
    where: `Availability._pageID="${pageId}"`,
    limit: '50',
  })
  const body = await fetchPcgwJson<CargoQueryResponse>(params)
  let best: PcgwSupportState | null = null
  for (const row of body.cargoquery ?? []) {
    const value = parsePcgwFeatureSupport(row.title?.XboxGamePass)
    if (value == null) continue
    if (best == null || GAME_PASS_SUPPORT_PRIORITY[value] > GAME_PASS_SUPPORT_PRIORITY[best]) {
      best = value
    }
  }
  return best
}

export async function getPcgwFeaturesBySteamAppId(
  steamAppId: number
): Promise<PcgwFeatureResult | null> {
  const params = new URLSearchParams({
    origin: '*',
    action: 'cargoquery',
    format: 'json',
    tables: 'Infobox_game,Video,Input',
    fields: PCGW_FEATURE_FIELDS,
    join_on: PCGW_FEATURE_JOIN,
    where: `Infobox_game.Steam_AppID HOLDS "${steamAppId}"`,
    limit: '1',
  })

  const body = await fetchPcgwJson<CargoQueryResponse>(params)
  return getPcgwFeaturesFromTitle(body.cargoquery?.[0]?.title)
}

export async function getPcgwFeaturesByGameName(gameName: string): Promise<PcgwFeatureResult | null> {
  // Non-Steam fallback is slower: search page titles, resolve redirects, then query Cargo.
  const [directPageNames, searchPageNames] = await Promise.all([
    resolvePcgwPageNames([gameName]),
    searchPcgwPageNames(gameName),
  ])
  const candidatePageNames = getUniquePcgwPageNames([
    ...directPageNames,
    ...await resolvePcgwPageNames(searchPageNames),
  ])
  if (candidatePageNames.length === 0) return null

  const quotedPageNames = candidatePageNames
    .map((pageName) => `"${escapeCargoString(pageName)}"`)
    .join(',')
  const params = new URLSearchParams({
    origin: '*',
    action: 'cargoquery',
    format: 'json',
    tables: 'Infobox_game,Video,Input',
    fields: PCGW_FEATURE_FIELDS,
    join_on: PCGW_FEATURE_JOIN,
    where: `Infobox_game._pageName IN (${quotedPageNames})`,
    limit: candidatePageNames.length.toString(),
  })

  const body = await fetchPcgwJson<CargoQueryResponse>(params)
  const rowByPageName = new Map(
    (body.cargoquery ?? [])
      .map((row) => [row.title?.PageName, row] as const)
      .filter((entry): entry is readonly [string, CargoQueryRow] => entry[0] != null),
  )
  const selectedRow = candidatePageNames
    .map((pageName) => rowByPageName.get(pageName))
    .find((row): row is CargoQueryRow => row != null)

  return getPcgwFeaturesFromTitle(selectedRow?.title)
}
