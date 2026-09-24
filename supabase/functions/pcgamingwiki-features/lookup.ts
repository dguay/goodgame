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

export type PcgwFailureKind =
  | 'authentication'
  | 'permission'
  | 'rate_limit'
  | 'transport'
  | 'schema'
  | 'configuration'

export class PcgwLookupError extends Error {
  readonly kind: PcgwFailureKind

  constructor(kind: PcgwFailureKind, message: string) {
    super(message)
    this.name = 'PcgwLookupError'
    this.kind = kind
  }
}

export interface PcgwCredentials {
  username: string
  password: string
  contact?: string
}

export const PCGW_API_URL = 'https://www.pcgamingwiki.com/w/api.php'
export const DEFAULT_PCGW_CONTACT = 'https://github.com/dguay/goodgame'

const FEATURE_SUPPORT_VALUES = new Set<PcgwSupportState>([
  'always on',
  'false',
  'hackable',
  'limited',
  'true',
  'unknown',
])
const TITLE_SEARCH_LIMIT = 5
const FEATURE_FIELDS = [
  'Game._pageID=PageID',
  'Game._pageName=PageName',
  'Video.4K_Ultra_HD=FourKUltraHd',
  'Video.60_FPS=SixtyFps',
  'Video.120_FPS=OneTwentyFps',
  'Video.Ultrawidescreen',
  'Input.Controller_support=ControllerSupport',
  'Game.Perspectives=Perspectives',
].join(',')
const FEATURE_JOIN = 'Game._pageID=Video._pageID,Game._pageID=Input._pageID'
const AUTHENTICATION_CODES = new Set([
  'assertuserfailed',
  'badtoken',
  'mustbeloggedin',
  'notloggedin',
  'readapidenied',
])
const GAME_PASS_SUPPORT_PRIORITY: Record<PcgwSupportState, number> = {
  'always on': 6,
  'true': 5,
  'limited': 4,
  'hackable': 3,
  'unknown': 2,
  'false': 1,
}

interface CargoTitle {
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

interface LookupOptions {
  credentials: PcgwCredentials
  fetch?: typeof fetch
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

export function pcgwUserAgent(contact: string | undefined): string {
  const value = (contact?.trim() || DEFAULT_PCGW_CONTACT)
  if (/[\r\n]/.test(value) || value.includes(')')) {
    throw new PcgwLookupError('configuration', 'PCGW_CONTACT cannot contain newlines or a closing parenthesis')
  }
  return `Goodgame/1.0 (${value})`
}

export function credentialsFromEnv(env: { get(name: string): string | undefined }): PcgwCredentials {
  const username = env.get('PCGW_BOT_USERNAME')?.trim() ?? ''
  const password = env.get('PCGW_BOT_PASSWORD') ?? ''
  if (username === '' || password === '') {
    throw new PcgwLookupError(
      'configuration',
      'PCGW_BOT_USERNAME and PCGW_BOT_PASSWORD are required',
    )
  }
  const contact = env.get('PCGW_CONTACT')?.trim()
  return { username, password, contact: contact || undefined }
}

export function parsePcgwFeatureSupport(value: unknown): PcgwSupportState | null {
  if (value == null) return null
  if (typeof value !== 'string') {
    throw new PcgwLookupError('schema', 'PCGamingWiki schema error: support value is not a string')
  }
  const normalized = value.trim().toLowerCase()
  if (normalized.length === 0) return null
  return FEATURE_SUPPORT_VALUES.has(normalized as PcgwSupportState)
    ? (normalized as PcgwSupportState)
    : 'unknown'
}

export function parsePcgwList(value: unknown): string[] {
  if (value == null) return []
  if (typeof value !== 'string') {
    throw new PcgwLookupError('schema', 'PCGamingWiki schema error: list value is not a string')
  }
  return value.split(',').map((item) => item.trim()).filter((item) => item.length > 0)
}

export function parseOfficialDiscordUrl(pageSource: string): string | null {
  const generalInformation = pageSource.match(
    /'''General information'''(?<content>[\s\S]*?)(?:\n==|$)/,
  )?.groups?.content
  if (generalInformation == null) return null
  const officialDiscordLink = generalInformation.match(
    /\[(?<url>https?:\/\/(?:discord\.gg|discord(?:app)?\.com\/invite)\/[^\]\s|]+)[^\]]*official discord[^\]]*\]/i,
  )
  return officialDiscordLink?.groups?.url ?? null
}

function parsePageId(value: string | null | undefined): number | null {
  if (value == null) return null
  const pageId = Number(value)
  return Number.isInteger(pageId) && pageId > 0 ? pageId : null
}

function escapeCargoString(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
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
  return getUniquePcgwPageNames(resolvedPageNames).sort((left, right) =>
    (priorityByPageName.get(left) ?? Number.POSITIVE_INFINITY) -
    (priorityByPageName.get(right) ?? Number.POSITIVE_INFINITY)
  )
}

class CookieJar {
  private readonly cookies = new Map<string, string>()

  store(response: Response): void {
    const headerList = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : []
    const lines = headerList.length > 0
      ? headerList
      : (response.headers.get('set-cookie')?.split(/,(?=[^;]+=)/) ?? [])
    for (const line of lines) {
      const pair = line.split(';', 1)[0] ?? ''
      const separator = pair.indexOf('=')
      if (separator <= 0) continue
      this.cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim())
    }
  }

  header(): string | null {
    if (this.cookies.size === 0) return null
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ')
  }
}

class PcgwSession {
  private readonly jar = new CookieJar()
  private readonly fetchImpl: typeof fetch
  private readonly userAgent: string
  private loggedIn = false

  constructor(private readonly credentials: PcgwCredentials, fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? fetch
    this.userAgent = pcgwUserAgent(credentials.contact)
  }

  async login(): Promise<void> {
    const tokenBody = await this.request({
      action: 'query',
      meta: 'tokens',
      type: 'login',
      format: 'json',
    }, 'GET')
    const token = isRecord(tokenBody) && isRecord(tokenBody.query) && isRecord(tokenBody.query.tokens)
      ? tokenBody.query.tokens.logintoken
      : null
    if (typeof token !== 'string' || token === '') {
      throw new PcgwLookupError('schema', 'PCGamingWiki login token was missing')
    }
    const loginBody = await this.request({
      action: 'login',
      format: 'json',
      lgname: this.credentials.username,
      lgpassword: this.credentials.password,
      lgtoken: token,
    }, 'POST')
    const result = isRecord(loginBody) && isRecord(loginBody.login) ? loginBody.login.result : null
    if (result === 'Success') {
      this.loggedIn = true
      return
    }
    if (result === 'Throttled' || result === 'RateLimited') {
      throw new PcgwLookupError('rate_limit', `PCGamingWiki login rate limited: ${String(result)}`)
    }
    throw new PcgwLookupError('authentication', `PCGamingWiki login failed: ${String(result ?? 'unknown')}`)
  }

  async request(params: Record<string, string>, method: 'GET' | 'POST'): Promise<unknown> {
    const query = new URLSearchParams(params)
    const headers = new Headers({
      Accept: 'application/json',
      'User-Agent': this.userAgent,
    })
    const cookie = this.jar.header()
    if (cookie != null) headers.set('Cookie', cookie)
    let url = PCGW_API_URL
    let body: string | undefined
    if (method === 'GET') {
      url = `${PCGW_API_URL}?${query.toString()}`
    } else {
      headers.set('Content-Type', 'application/x-www-form-urlencoded')
      body = query.toString()
    }
    let response: Response
    try {
      response = await this.fetchImpl(url, { method, headers, body })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new PcgwLookupError('transport', `PCGamingWiki request failed: ${message}`)
    }
    this.jar.store(response)
    if (response.status === 429) {
      throw new PcgwLookupError('rate_limit', 'PCGamingWiki rate limit: HTTP 429')
    }
    if (response.status === 401) {
      throw new PcgwLookupError('authentication', 'PCGamingWiki authentication failed: HTTP 401')
    }
    if (!response.ok) {
      const text = await response.text()
      let parsed: unknown = null
      try {
        parsed = JSON.parse(text.slice(0, 8000)) as unknown
      } catch {
        parsed = null
      }
      const failure = classifyMediaWikiBody(parsed)
      if (failure != null) throw failure
      throw new PcgwLookupError(
        'transport',
        `PCGamingWiki request failed: ${response.status} ${response.statusText} ${text.slice(0, 160)}`,
      )
    }
    const raw = await response.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(raw) as unknown
    } catch {
      throw new PcgwLookupError('schema', 'PCGamingWiki returned malformed JSON')
    }
    const failure = classifyMediaWikiBody(parsed)
    if (failure != null) throw failure
    return parsed
  }

  requireLogin(): void {
    if (!this.loggedIn) {
      throw new PcgwLookupError('authentication', 'PCGamingWiki login failed: not logged in')
    }
  }
}

function mediaWikiCodes(body: unknown): { code: string; info?: string }[] {
  if (!isRecord(body)) return []
  const codes: { code: string; info?: string }[] = []
  if (typeof body.error === 'string' && body.error.trim() !== '') {
    codes.push({ code: body.error.trim().toLowerCase() })
  } else if (isRecord(body.error) && typeof body.error.code === 'string') {
    codes.push({
      code: body.error.code.toLowerCase(),
      info: typeof body.error.info === 'string' ? body.error.info : undefined,
    })
  }
  if (Array.isArray(body.errors)) {
    for (const item of body.errors) {
      if (!isRecord(item) || typeof item.code !== 'string') continue
      codes.push({
        code: item.code.toLowerCase(),
        info: typeof item.info === 'string' ? item.info : undefined,
      })
    }
  }
  return codes
}

function classifyMediaWikiBody(body: unknown): PcgwLookupError | null {
  const codes = mediaWikiCodes(body)
  if (codes.length === 0) return null
  const selected = codes.find((item) =>
    item.code === 'permissiondenied' ||
    item.code === 'ratelimited' ||
    item.code === 'throttled' ||
    AUTHENTICATION_CODES.has(item.code)
  ) ?? codes[0]
  const detail = `${selected.code}${selected.info ? ` ${selected.info}` : ''}`
  if (selected.code === 'permissiondenied') {
    return new PcgwLookupError('permission', `PCGamingWiki permissiondenied: ${detail}`)
  }
  if (selected.code === 'ratelimited' || selected.code === 'throttled') {
    return new PcgwLookupError('rate_limit', `PCGamingWiki rate limit: ${detail}`)
  }
  if (AUTHENTICATION_CODES.has(selected.code)) {
    return new PcgwLookupError('authentication', `PCGamingWiki authentication failed: ${detail}`)
  }
  return new PcgwLookupError('schema', `PCGamingWiki schema error: ${detail}`)
}

async function openSession(options: LookupOptions): Promise<PcgwSession> {
  if (options.credentials.username.trim() === '' || options.credentials.password === '') {
    throw new PcgwLookupError('configuration', 'PCGW_BOT_USERNAME and PCGW_BOT_PASSWORD are required')
  }
  const session = new PcgwSession(options.credentials, options.fetch)
  await session.login()
  session.requireLogin()
  return session
}

async function cargoTitles(session: PcgwSession, params: Record<string, string>): Promise<CargoTitle[]> {
  const body = await session.request({
    action: 'cargoquery',
    format: 'json',
    ...params,
  }, 'GET')
  if (!isRecord(body) || !Array.isArray(body.cargoquery)) {
    throw new PcgwLookupError('schema', 'PCGamingWiki schema error: cargoquery missing')
  }
  return body.cargoquery.map((row) => {
    if (!isRecord(row) || !isRecord(row.title)) {
      throw new PcgwLookupError('schema', 'PCGamingWiki schema error: cargo row missing title')
    }
    return row.title as CargoTitle
  })
}

async function getPageSource(session: PcgwSession, pageName: string): Promise<string | null> {
  const body = await session.request({
    action: 'query',
    format: 'json',
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    titles: pageName,
  }, 'GET')
  if (!isRecord(body) || !isRecord(body.query) || !isRecord(body.query.pages)) {
    throw new PcgwLookupError('schema', 'PCGamingWiki schema error: page source missing')
  }
  const page = Object.values(body.query.pages)[0]
  if (!isRecord(page)) throw new PcgwLookupError('schema', 'PCGamingWiki schema error: page source missing')
  if (page.missing != null) return null
  if (!Array.isArray(page.revisions) || page.revisions.length === 0) {
    throw new PcgwLookupError('schema', 'PCGamingWiki schema error: page source missing revisions')
  }
  const revision = page.revisions[0]
  if (!isRecord(revision) || !isRecord(revision.slots) || !isRecord(revision.slots.main) || typeof revision.slots.main['*'] !== 'string') {
    throw new PcgwLookupError('schema', 'PCGamingWiki schema error: page source missing')
  }
  return revision.slots.main['*']
}

async function lookupXboxGamePass(session: PcgwSession, pageId: number): Promise<PcgwSupportState | null> {
  const titles = await cargoTitles(session, {
    tables: 'StoreFeature',
    fields: 'StoreFeature.Xbox_Game_Pass=XboxGamePass',
    where: `StoreFeature._pageID="${pageId}"`,
    limit: '50',
  })
  let best: PcgwSupportState | null = null
  for (const title of titles) {
    const value = parsePcgwFeatureSupport(title.XboxGamePass)
    if (value == null) continue
    if (best == null || GAME_PASS_SUPPORT_PRIORITY[value] > GAME_PASS_SUPPORT_PRIORITY[best]) {
      best = value
    }
  }
  return best
}

function secondaryFailed(result: PromiseSettledResult<unknown>): boolean {
  if (result.status === 'fulfilled') return false
  if (result.reason instanceof PcgwLookupError && result.reason.kind !== 'transport') throw result.reason
  return true
}

function requirePageIdentity(title: CargoTitle): { pageId: number; pageName: string } {
  const pageId = parsePageId(title.PageID)
  const pageName = typeof title.PageName === 'string' && title.PageName.trim() !== '' ? title.PageName : null
  if (pageId == null || pageName == null) {
    throw new PcgwLookupError('schema', 'PCGamingWiki schema error: cargo row missing page identity')
  }
  return { pageId, pageName }
}

async function featuresFromTitle(session: PcgwSession, title: CargoTitle | undefined): Promise<PcgwFeatureResult | null> {
  if (title == null) return null
  const { pageId, pageName } = requirePageIdentity(title)
  const [pageSourceResult, xboxGamePassResult] = await Promise.allSettled([
    pageName != null ? getPageSource(session, pageName) : Promise.resolve(null),
    pageId != null ? lookupXboxGamePass(session, pageId) : Promise.resolve(null),
  ])
  const pageSourceFetchFailed = secondaryFailed(pageSourceResult)
  const xboxGamePassFetchFailed = secondaryFailed(xboxGamePassResult)
  const pageSource = pageSourceResult.status === 'fulfilled' ? pageSourceResult.value : null
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

async function featureTitles(session: PcgwSession, where: string, limit: string): Promise<CargoTitle[]> {
  return cargoTitles(session, {
    tables: 'Game,Video,Input',
    fields: FEATURE_FIELDS,
    join_on: FEATURE_JOIN,
    where,
    limit,
  })
}

export async function lookupFeaturesBySteamAppId(
  steamAppId: number,
  options: LookupOptions,
): Promise<PcgwFeatureResult | null> {
  if (!Number.isInteger(steamAppId) || steamAppId <= 0) {
    throw new PcgwLookupError('schema', 'PCGamingWiki schema error: steamAppId must be a positive integer')
  }
  const session = await openSession(options)
  const titles = await featureTitles(session, `Game.Steam_AppID HOLDS "${steamAppId}"`, '1')
  return featuresFromTitle(session, titles[0])
}

async function resolvePageNames(session: PcgwSession, pageNames: string[]): Promise<string[]> {
  const uniquePageNames = getUniquePcgwPageNames(pageNames)
  if (uniquePageNames.length === 0) return []
  const body = await session.request({
    action: 'query',
    format: 'json',
    redirects: '1',
    titles: uniquePageNames.join('|'),
  }, 'GET')
  if (!isRecord(body) || !isRecord(body.query) || !isRecord(body.query.pages)) {
    throw new PcgwLookupError('schema', 'PCGamingWiki schema error: page resolution missing')
  }
  const resolved: string[] = []
  for (const page of Object.values(body.query.pages)) {
    if (!isRecord(page)) {
      throw new PcgwLookupError('schema', 'PCGamingWiki schema error: page resolution missing fields')
    }
    if (page.missing != null) continue
    if (typeof page.ns !== 'number') {
      throw new PcgwLookupError('schema', 'PCGamingWiki schema error: page resolution missing fields')
    }
    if (page.ns !== 0) continue
    if (typeof page.pageid !== 'number' || typeof page.title !== 'string' || page.title.trim() === '') {
      throw new PcgwLookupError('schema', 'PCGamingWiki schema error: page resolution missing fields')
    }
    resolved.push(page.title)
  }
  if (body.query.redirects != null && !Array.isArray(body.query.redirects)) {
    throw new PcgwLookupError('schema', 'PCGamingWiki schema error: page resolution missing fields')
  }
  const redirects = (Array.isArray(body.query.redirects) ? body.query.redirects : []).map((redirect) => {
    if (!isRecord(redirect) || typeof redirect.from !== 'string' || typeof redirect.to !== 'string') {
      throw new PcgwLookupError('schema', 'PCGamingWiki schema error: page resolution missing fields')
    }
    return { from: redirect.from, to: redirect.to }
  })
  return sortPcgwResolvedPageNamesByInput(resolved, uniquePageNames, redirects)
}

async function searchPageNames(session: PcgwSession, gameName: string): Promise<string[]> {
  const body = await session.request({
    action: 'query',
    format: 'json',
    list: 'search',
    srsearch: gameName,
    srlimit: TITLE_SEARCH_LIMIT.toString(),
  }, 'GET')
  if (!isRecord(body) || !isRecord(body.query) || !Array.isArray(body.query.search)) {
    throw new PcgwLookupError('schema', 'PCGamingWiki schema error: search results missing')
  }
  const titles: string[] = []
  for (const result of body.query.search) {
    if (!isRecord(result) || typeof result.ns !== 'number' || typeof result.title !== 'string' || result.title.trim() === '') {
      throw new PcgwLookupError('schema', 'PCGamingWiki schema error: search result missing fields')
    }
    if (result.ns === 0) titles.push(result.title)
  }
  return getUniquePcgwPageNames(titles)
}

export async function lookupFeaturesByGameName(
  gameName: string,
  options: LookupOptions,
): Promise<PcgwFeatureResult | null> {
  const term = gameName.trim()
  if (term === '') return null
  const session = await openSession(options)
  const [directPageNames, searchResults] = await Promise.all([
    resolvePageNames(session, [term]),
    searchPageNames(session, term),
  ])
  const candidatePageNames = getUniquePcgwPageNames([
    ...directPageNames,
    ...await resolvePageNames(session, searchResults),
  ])
  if (candidatePageNames.length === 0) return null
  const quoted = candidatePageNames.map((pageName) => `"${escapeCargoString(pageName)}"`).join(',')
  const titles = await featureTitles(
    session,
    `Game._pageName IN (${quoted})`,
    candidatePageNames.length.toString(),
  )
  for (const title of titles) requirePageIdentity(title)
  const rowByPageName = new Map(titles.flatMap((title) =>
    title.PageName != null ? [[title.PageName, title] as const] : []
  ))
  const selected = candidatePageNames
    .map((pageName) => rowByPageName.get(pageName))
    .find((title): title is CargoTitle => title != null)
  return featuresFromTitle(session, selected)
}

export async function lookupXboxGamePassByPageId(
  pageId: number,
  options: LookupOptions,
): Promise<PcgwSupportState | null> {
  if (!Number.isInteger(pageId) || pageId <= 0) {
    throw new PcgwLookupError('schema', 'PCGamingWiki schema error: pageId must be a positive integer')
  }
  const session = await openSession(options)
  return lookupXboxGamePass(session, pageId)
}

const STATUS_BY_KIND: Record<PcgwFailureKind, number> = {
  authentication: 401,
  permission: 403,
  rate_limit: 429,
  transport: 502,
  schema: 502,
  configuration: 500,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json',
    },
  })
}

function errorResponse(error: PcgwLookupError): Response {
  return jsonResponse(
    { error: { kind: error.kind, message: error.message } },
    STATUS_BY_KIND[error.kind],
  )
}

export async function handlePcGamingWikiFeaturesRequest(
  req: Request,
  options: LookupOptions,
): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: jsonResponse({}).headers })
  if (req.method !== 'POST') {
    return errorResponse(new PcgwLookupError('schema', 'PCGamingWiki schema error: method not allowed'))
  }
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return errorResponse(new PcgwLookupError('schema', 'PCGamingWiki schema error: malformed request'))
  }
  try {
    if (!isRecord(payload)) {
      throw new PcgwLookupError('schema', 'PCGamingWiki schema error: malformed request')
    }
    if (typeof payload.steamAppId === 'number') {
      return jsonResponse({ result: await lookupFeaturesBySteamAppId(payload.steamAppId, options) })
    }
    if (typeof payload.gameName === 'string') {
      return jsonResponse({ result: await lookupFeaturesByGameName(payload.gameName, options) })
    }
    if (typeof payload.pageId === 'number') {
      return jsonResponse({ xboxGamePass: await lookupXboxGamePassByPageId(payload.pageId, options) })
    }
    throw new PcgwLookupError('schema', 'PCGamingWiki schema error: expected steamAppId, gameName, or pageId')
  } catch (error) {
    if (error instanceof PcgwLookupError) return errorResponse(error)
    const message = error instanceof Error ? error.message : String(error)
    return errorResponse(new PcgwLookupError('transport', `PCGamingWiki request failed: ${message}`))
  }
}
