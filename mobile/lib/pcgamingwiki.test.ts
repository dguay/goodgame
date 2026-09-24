import {
  getPcgwFeaturesByGameName,
  getPcgwFeaturesBySteamAppId,
  getPcgwXboxGamePassByPageId,
  type PcGamingWikiFunctionCall,
  type PcGamingWikiInvoke,
  type PcGamingWikiLookupBody,
  type PcgwFeatureResult,
} from './pcgamingwiki'

declare const require: (module: string) => unknown

const assert = require('node:assert/strict') as {
  deepEqual: (actual: unknown, expected: unknown) => void
  equal: (actual: unknown, expected: unknown) => void
  rejects: (block: () => Promise<unknown>, error?: RegExp) => Promise<void>
}
const test = require('node:test') as (name: string, fn: () => void | Promise<void>) => void

const FEATURE: PcgwFeatureResult = {
  controllerSupport: 'true',
  fourKUltraHd: 'limited',
  officialDiscordUrl: 'https://discord.gg/eldenring',
  pageSourceFetchFailed: false,
  oneTwentyFps: 'true',
  pageId: 146683,
  pageName: 'Elden Ring',
  perspectives: ['Third-person'],
  sixtyFps: 'true',
  ultrawidescreen: 'hackable',
  xboxGamePass: 'true',
  xboxGamePassFetchFailed: false,
}

function invokeWith(response: PcGamingWikiFunctionCall): PcGamingWikiInvoke & { bodies: PcGamingWikiLookupBody[] } {
  const bodies: PcGamingWikiLookupBody[] = []
  const invoke = (async (body: PcGamingWikiLookupBody) => {
    bodies.push(body)
    return response
  }) as PcGamingWikiInvoke & { bodies: PcGamingWikiLookupBody[] }
  invoke.bodies = bodies
  return invoke
}

test('Steam lookup asks the function for the app id and returns its typed result', async () => {
  const invoke = invokeWith({ data: { result: FEATURE }, error: null })
  assert.deepEqual(await getPcgwFeaturesBySteamAppId(1245620, invoke), FEATURE)
  assert.deepEqual(invoke.bodies, [{ steamAppId: 1245620 }])
})

test('an authenticated no-match stays null instead of an error', async () => {
  const invoke = invokeWith({ data: { result: null }, error: null })
  assert.equal(await getPcgwFeaturesBySteamAppId(1245620, invoke), null)
})

test('permission, authentication, and rate-limit responses reject and are not cached as no-match', async () => {
  for (const message of [
    'PCGamingWiki permissiondenied: cargo',
    'PCGamingWiki authentication failed: assertuserfailed',
    'PCGamingWiki rate limit: HTTP 429',
  ]) {
    const invoke = invokeWith({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: { kind: 'permission', message } }) } },
    })
    await assert.rejects(() => getPcgwFeaturesByGameName('Elden Ring', invoke), new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.deepEqual(invoke.bodies, [{ gameName: 'Elden Ring' }])
  }
})

test('a malformed feature payload is a schema error', async () => {
  const invoke = invokeWith({ data: { result: { pageName: 'Elden Ring' } }, error: null })
  await assert.rejects(() => getPcgwFeaturesBySteamAppId(1245620, invoke), /schema error/)
})

test('Xbox Game Pass refresh asks the function for the page id only', async () => {
  const invoke = invokeWith({ data: { xboxGamePass: 'limited' }, error: null })
  assert.equal(await getPcgwXboxGamePassByPageId(146683, invoke), 'limited')
  assert.deepEqual(invoke.bodies, [{ pageId: 146683 }])
})
