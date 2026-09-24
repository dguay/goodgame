import {
  getPcgwFeaturesByGameName,
  getPcgwFeaturesBySteamAppId,
  getUniquePcgwPageNames,
  parseOfficialDiscordUrl,
  parsePcgwFeatureSupport,
  parsePcgwList,
  sortPcgwResolvedPageNamesByInput,
} from './pcgamingwiki'

declare const require: (module: string) => unknown

const assert = require('node:assert/strict') as {
  deepEqual: (actual: unknown, expected: unknown) => void
  equal: (actual: unknown, expected: unknown) => void
  rejects: (block: () => Promise<unknown>, error?: RegExp) => Promise<void>
}
const test = require('node:test') as (name: string, fn: () => void | Promise<void>) => void

const PERMISSION_DENIED = {
  error: {
    code: 'permissiondenied',
    info: 'The action you have requested is limited to users in the group: user',
  },
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function withFetch(responseBody: unknown, run: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch
  globalThis.fetch = (async () => jsonResponse(responseBody)) as typeof fetch
  try {
    await run()
  } finally {
    globalThis.fetch = original
  }
}

test('parsePcgwFeatureSupport accepts all PCGamingWiki tickcross values', () => {
  assert.equal(parsePcgwFeatureSupport('always on'), 'always on')
  assert.equal(parsePcgwFeatureSupport('false'), 'false')
  assert.equal(parsePcgwFeatureSupport('hackable'), 'hackable')
  assert.equal(parsePcgwFeatureSupport('limited'), 'limited')
  assert.equal(parsePcgwFeatureSupport('true'), 'true')
  assert.equal(parsePcgwFeatureSupport('unknown'), 'unknown')
})

test('parsePcgwFeatureSupport normalizes casing and whitespace', () => {
  assert.equal(parsePcgwFeatureSupport(' TRUE '), 'true')
  assert.equal(parsePcgwFeatureSupport(' Always On '), 'always on')
})

test('parsePcgwFeatureSupport handles missing and unrecognized values', () => {
  assert.equal(parsePcgwFeatureSupport(null), null)
  assert.equal(parsePcgwFeatureSupport(undefined), null)
  assert.equal(parsePcgwFeatureSupport(''), null)
  assert.equal(parsePcgwFeatureSupport('unsupported'), 'unknown')
})

test('parsePcgwList removes empty entries from comma-separated Cargo lists', () => {
  assert.deepEqual(parsePcgwList('First-person, Third-person,'), [
    'First-person',
    'Third-person',
  ])
  assert.deepEqual(parsePcgwList(null), [])
})

test('getUniquePcgwPageNames trims, deduplicates, and drops title delimiters', () => {
  assert.deepEqual(getUniquePcgwPageNames([
    ' Diablo III ',
    'Diablo III',
    'Diablo II: Resurrected',
    'Invalid|Title',
    '',
  ]), [
    'Diablo III',
    'Diablo II: Resurrected',
  ])
})

test('sortPcgwResolvedPageNamesByInput preserves input priority after redirects', () => {
  assert.deepEqual(
    sortPcgwResolvedPageNamesByInput(
      ['Diablo II: Resurrected', 'Diablo III'],
      ['Diablo 3', 'Diablo 2: Resurrected'],
      [
        { from: 'Diablo 3', to: 'Diablo III' },
        { from: 'Diablo 2: Resurrected', to: 'Diablo II: Resurrected' },
      ],
    ),
    ['Diablo III', 'Diablo II: Resurrected'],
  )
})

test('parseOfficialDiscordUrl returns the official Discord link from General information', () => {
  const source = [
    "'''General information'''",
    '{{mm}} [https://discord.gg/cyberpunkgame Official Discord server]',
    '{{mm}} [https://steamcommunity.com/app/1091500/discussions/ Steam Community Discussions]',
    '',
    '==Availability==',
  ].join('\n')

  assert.equal(parseOfficialDiscordUrl(source), 'https://discord.gg/cyberpunkgame')
})

test('getPcgwFeaturesBySteamAppId rejects an HTTP 200 permissiondenied envelope', async () => {
  await withFetch(PERMISSION_DENIED, async () => {
    await assert.rejects(
      () => getPcgwFeaturesBySteamAppId(1245620),
      /permissiondenied/,
    )
  })
})

test('getPcgwFeaturesBySteamAppId rejects a MediaWiki errors array', async () => {
  await withFetch({ errors: [{ code: 'permissiondenied', info: 'readapidenied' }] }, async () => {
    await assert.rejects(
      () => getPcgwFeaturesBySteamAppId(1245620),
      /permissiondenied/,
    )
  })
})

test('getPcgwFeaturesByGameName rejects an HTTP 200 permissiondenied envelope', async () => {
  await withFetch(PERMISSION_DENIED, async () => {
    await assert.rejects(
      () => getPcgwFeaturesByGameName('Elden Ring'),
      /permissiondenied/,
    )
  })
})

test('getPcgwFeaturesBySteamAppId still returns null for a successful empty Cargo result', async () => {
  await withFetch({ cargoquery: [] }, async () => {
    assert.equal(await getPcgwFeaturesBySteamAppId(1245620), null)
  })
})

test('parseOfficialDiscordUrl ignores Discord links outside General information', () => {
  const source = [
    '==Issues fixed==',
    '{{ii}} Join [https://discord.gg/not-official Discord] for troubleshooting.',
  ].join('\n')

  assert.equal(parseOfficialDiscordUrl(source), null)
})
