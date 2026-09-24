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

export interface PcGamingWikiLookupBody {
  gameName?: string
  pageId?: number
  steamAppId?: number
}

export interface PcGamingWikiFunctionCall {
  data: unknown
  error: {
    context?: { json: () => Promise<unknown> }
    message: string
  } | null
}

export type PcGamingWikiInvoke = (body: PcGamingWikiLookupBody) => Promise<PcGamingWikiFunctionCall>

const SUPPORT_STATES = new Set<PcgwSupportState>([
  'always on',
  'false',
  'hackable',
  'limited',
  'true',
  'unknown',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function isSupportState(value: unknown): value is PcgwSupportState | null {
  return value == null || (typeof value === 'string' && SUPPORT_STATES.has(value as PcgwSupportState))
}

export function getPcgwPageUrl(pageName: string): string {
  return `https://www.pcgamingwiki.com/wiki/${encodeURIComponent(pageName.replaceAll(' ', '_'))}`
}

async function functionMessage(error: NonNullable<PcGamingWikiFunctionCall['error']>): Promise<string> {
  try {
    const payload = error.context ? await error.context.json() : null
    if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
      return payload.error.message
    }
  } catch {
    // The function body was not JSON. Fall through to the transport message.
  }
  return error.message
}

async function callFunction(invoke: PcGamingWikiInvoke, body: PcGamingWikiLookupBody): Promise<unknown> {
  const { data, error } = await invoke(body)
  if (error) throw new Error(await functionMessage(error))
  if (!isRecord(data)) throw new Error('PCGamingWiki schema error: empty function response')
  return data
}

function optionalString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string') throw new Error('PCGamingWiki schema error: feature result')
  return value
}

function optionalPageId(value: unknown): number | null {
  if (value == null) return null
  if (typeof value !== 'number') throw new Error('PCGamingWiki schema error: feature result')
  return value
}

function parseFeatureResult(value: unknown): PcgwFeatureResult | null {
  if (value == null) return null
  if (!isRecord(value)) throw new Error('PCGamingWiki schema error: feature result')
  const perspectives = value.perspectives
  if (
    !isSupportState(value.controllerSupport) ||
    !isSupportState(value.fourKUltraHd) ||
    !isSupportState(value.oneTwentyFps) ||
    !isSupportState(value.sixtyFps) ||
    !isSupportState(value.ultrawidescreen) ||
    !isSupportState(value.xboxGamePass) ||
    typeof value.pageSourceFetchFailed !== 'boolean' ||
    typeof value.xboxGamePassFetchFailed !== 'boolean' ||
    !Array.isArray(perspectives) ||
    perspectives.some((item) => typeof item !== 'string')
  ) {
    throw new Error('PCGamingWiki schema error: feature result')
  }
  return {
    controllerSupport: value.controllerSupport,
    fourKUltraHd: value.fourKUltraHd,
    officialDiscordUrl: optionalString(value.officialDiscordUrl),
    pageSourceFetchFailed: value.pageSourceFetchFailed,
    oneTwentyFps: value.oneTwentyFps,
    pageId: optionalPageId(value.pageId),
    pageName: optionalString(value.pageName),
    perspectives,
    sixtyFps: value.sixtyFps,
    ultrawidescreen: value.ultrawidescreen,
    xboxGamePass: value.xboxGamePass,
    xboxGamePassFetchFailed: value.xboxGamePassFetchFailed,
  }
}

export async function getPcgwFeaturesBySteamAppId(
  steamAppId: number,
  invoke: PcGamingWikiInvoke,
): Promise<PcgwFeatureResult | null> {
  const data = await callFunction(invoke, { steamAppId })
  if (!isRecord(data) || !('result' in data)) {
    throw new Error('PCGamingWiki schema error: feature result')
  }
  return parseFeatureResult(data.result)
}

export async function getPcgwFeaturesByGameName(
  gameName: string,
  invoke: PcGamingWikiInvoke,
): Promise<PcgwFeatureResult | null> {
  const data = await callFunction(invoke, { gameName })
  if (!isRecord(data) || !('result' in data)) {
    throw new Error('PCGamingWiki schema error: feature result')
  }
  return parseFeatureResult(data.result)
}

export async function getPcgwXboxGamePassByPageId(
  pageId: number,
  invoke: PcGamingWikiInvoke,
): Promise<PcgwSupportState | null> {
  const data = await callFunction(invoke, { pageId })
  if (!isRecord(data) || !('xboxGamePass' in data) || !isSupportState(data.xboxGamePass)) {
    throw new Error('PCGamingWiki schema error: xbox game pass')
  }
  return data.xboxGamePass
}
