import { assertEquals, assertRejects, assertStringIncludes } from 'jsr:@std/assert'
import {
  credentialsFromEnv,
  handlePcGamingWikiFeaturesRequest,
  lookupFeaturesByGameName,
  lookupFeaturesBySteamAppId,
  parseOfficialDiscordUrl,
  parsePcgwFeatureSupport,
  parsePcgwList,
  PcgwLookupError,
  type PcgwCredentials,
} from './lookup.ts'

const CREDENTIALS: PcgwCredentials = {
  username: 'GoodgameBot@cargo',
  password: 'bot-secret-value',
  contact: 'https://github.com/dguay/goodgame',
}

const ELDEN_RING_TITLE = {
  PageID: '146683',
  PageName: 'Elden Ring',
  SixtyFps: 'true',
  OneTwentyFps: 'true',
  Ultrawidescreen: 'hackable',
  ControllerSupport: 'true',
  FourKUltraHd: 'limited',
  Perspectives: 'Third-person,',
}

function jsonResponse(body: unknown, status = 200, cookie?: string): Response {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (cookie != null) headers.append('set-cookie', cookie)
  return new Response(JSON.stringify(body), { status, headers })
}

function route(request: Request, url: URL): Response {
  if (url.searchParams.get('meta') === 'tokens') {
    return jsonResponse(
      { query: { tokens: { logintoken: 'login-token+\\' } } },
      200,
      'pcgw_session=session-token; Path=/; HttpOnly',
    )
  }
  if (url.searchParams.get('action') === 'login' || request.method === 'POST') {
    return jsonResponse({ login: { result: 'Success' } })
  }
  if (url.searchParams.get('list') === 'search') {
    return jsonResponse({ query: { search: [{ ns: 0, title: 'Elden Ring' }] } })
  }
  if (url.searchParams.get('redirects') === '1') {
    return jsonResponse({
      query: {
        pages: { '146683': { pageid: 146683, ns: 0, title: 'Elden Ring' } },
      },
    })
  }
  if (url.searchParams.get('prop') === 'revisions') {
    return jsonResponse({
      query: {
        pages: {
          '146683': {
            revisions: [{
              slots: {
                main: {
                  '*': "'''General information'''\n{{mm}} [https://discord.gg/eldenring Official Discord]\n\n==Availability==",
                },
              },
            }],
          },
        },
      },
    })
  }
  if (url.searchParams.get('tables') === 'StoreFeature') {
    return jsonResponse({ cargoquery: [{ title: { XboxGamePass: 'true' } }] })
  }
  if (url.searchParams.get('action') === 'cargoquery') {
    return jsonResponse({ cargoquery: [{ title: ELDEN_RING_TITLE }] })
  }
  return jsonResponse({ error: { code: 'unexpected', info: url.search } }, 200)
}

async function withFetch(
  handler: (request: Request, url: URL, body: string) => Response,
  run: (seen: Request[]) => Promise<void>,
): Promise<void> {
  const seen: Request[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    seen.push(request.clone())
    const body = await request.clone().text()
    return handler(request, new URL(request.url), body)
  }) as typeof fetch
  try {
    await run(seen)
  } finally {
    globalThis.fetch = original
  }
}

function assertLoggedInCargo(requests: Request[], bodies: string[]): void {
  const cargo = requests.find((request) => new URL(request.url).searchParams.get('tables')?.includes('Game'))
  if (cargo == null) throw new Error('missing Game cargo request')
  const params = new URL(cargo.url).searchParams
  assertEquals(params.get('tables'), 'Game,Video,Input')
  assertStringIncludes(params.get('fields') ?? '', 'Game._pageID=PageID')
  assertStringIncludes(params.get('fields') ?? '', 'Video.4K_Ultra_HD=FourKUltraHd')
  assertStringIncludes(params.get('fields') ?? '', 'Input.Controller_support=ControllerSupport')
  assertEquals(params.get('join_on'), 'Game._pageID=Video._pageID,Game._pageID=Input._pageID')
  assertEquals(cargo.headers.get('cookie'), 'pcgw_session=session-token')
  assertEquals(cargo.headers.get('user-agent'), 'Goodgame/1.0 (https://github.com/dguay/goodgame)')
  assertEquals(bodies.some((body) => body.includes('lgpassword=bot-secret-value')), true)
  assertEquals(cargo.url.includes('bot-secret-value'), false)
  assertEquals(cargo.url.includes('Infobox_game'), false)
}

Deno.test('parsePcgwFeatureSupport accepts tickcross values and rejects surprises', () => {
  assertEquals(parsePcgwFeatureSupport(' TRUE '), 'true')
  assertEquals(parsePcgwFeatureSupport(' Always On '), 'always on')
  assertEquals(parsePcgwFeatureSupport(''), null)
  assertEquals(parsePcgwFeatureSupport('unsupported'), 'unknown')
  assertEquals(parsePcgwList('First-person, Third-person,'), ['First-person', 'Third-person'])
})

Deno.test('parseOfficialDiscordUrl keeps only the official invite in General information', () => {
  assertEquals(
    parseOfficialDiscordUrl("'''General information'''\n[https://discord.gg/cyberpunkgame Official Discord]\n\n==Other=="),
    'https://discord.gg/cyberpunkgame',
  )
  assertEquals(
    parseOfficialDiscordUrl('==Issues fixed==\n[https://discord.gg/not-official Discord]'),
    null,
  )
})

Deno.test('authenticated Steam lookup returns Elden Ring features', async () => {
  await withFetch((request, url) => route(request, url), async (seen) => {
    const result = await lookupFeaturesBySteamAppId(1245620, { credentials: CREDENTIALS })
    const cargoBodies = await Promise.all(seen.map((request) => request.clone().text()))
    assertLoggedInCargo(seen, cargoBodies)
    assertEquals(result?.pageName, 'Elden Ring')
    assertEquals(result?.pageId, 146683)
    assertEquals(result?.sixtyFps, 'true')
    assertEquals(result?.ultrawidescreen, 'hackable')
    assertEquals(result?.xboxGamePass, 'true')
    assertEquals(result?.officialDiscordUrl, 'https://discord.gg/eldenring')
    assertEquals(result?.perspectives, ['Third-person'])
    const cargo = seen.find((request) => new URL(request.url).searchParams.get('where')?.includes('1245620'))
    assertStringIncludes(new URL(cargo?.url ?? '').searchParams.get('where') ?? '', 'Game.Steam_AppID HOLDS "1245620"')
    const xbox = seen.find((request) => new URL(request.url).searchParams.get('tables') === 'StoreFeature')
    assertStringIncludes(new URL(xbox?.url ?? '').searchParams.get('fields') ?? '', 'StoreFeature.Xbox_Game_Pass=XboxGamePass')
  })
})

Deno.test('authenticated empty Cargo result is a no-match', async () => {
  await withFetch((request, url) => {
    if (url.searchParams.get('action') === 'cargoquery') return jsonResponse({ cargoquery: [] })
    return route(request, url)
  }, async () => {
    assertEquals(await lookupFeaturesBySteamAppId(1245620, { credentials: CREDENTIALS }), null)
  })
})

Deno.test('expired login is an authentication failure, not a no-match', async () => {
  await withFetch((request, url) => {
    if (url.searchParams.get('action') === 'cargoquery') {
      return jsonResponse({ error: { code: 'assertuserfailed', info: 'session expired' } })
    }
    return route(request, url)
  }, async () => {
    const error = await assertRejects(
      () => lookupFeaturesBySteamAppId(1245620, { credentials: CREDENTIALS }),
      PcgwLookupError,
    )
    assertEquals(error.kind, 'authentication')
  })
})

Deno.test('permissiondenied stays a permission failure for Steam and name lookup', async () => {
  await withFetch((request, url) => {
    if (url.searchParams.get('action') === 'cargoquery' || url.searchParams.get('list') === 'search') {
      return jsonResponse({
        error: {
          code: 'permissiondenied',
          info: "You don't have permission to run arbitrary Cargo queries.",
        },
      })
    }
    return route(request, url)
  }, async () => {
    const steam = await assertRejects(
      () => lookupFeaturesBySteamAppId(1245620, { credentials: CREDENTIALS }),
      PcgwLookupError,
    )
    const name = await assertRejects(
      () => lookupFeaturesByGameName('Elden Ring', { credentials: CREDENTIALS }),
      PcgwLookupError,
    )
    assertEquals(steam.kind, 'permission')
    assertEquals(name.kind, 'permission')
    assertStringIncludes(steam.message, 'permissiondenied')
  })
})

Deno.test('HTTP 429 is a rate limit', async () => {
  await withFetch((_request, url) => {
    if (url.searchParams.get('action') === 'cargoquery') return jsonResponse({ error: 'slow down' }, 429)
    return route(_request, url)
  }, async () => {
    const error = await assertRejects(
      () => lookupFeaturesBySteamAppId(1245620, { credentials: CREDENTIALS }),
      PcgwLookupError,
    )
    assertEquals(error.kind, 'rate_limit')
  })
})

Deno.test('malformed upstream JSON is a schema failure', async () => {
  await withFetch((_request, url) => {
    if (url.searchParams.get('action') === 'cargoquery') {
      return new Response('<html>blocked</html>', { status: 200, headers: { 'content-type': 'text/html' } })
    }
    return route(_request, url)
  }, async () => {
    const error = await assertRejects(
      () => lookupFeaturesBySteamAppId(1245620, { credentials: CREDENTIALS }),
      PcgwLookupError,
    )
    assertEquals(error.kind, 'schema')
  })
})

Deno.test('a failed bot login does not query Cargo', async () => {
  await withFetch((request, url, body) => {
    if (request.method === 'POST') {
      assertStringIncludes(body, 'lgname=GoodgameBot%40cargo')
      assertStringIncludes(body, 'lgpassword=bot-secret-value')
      return jsonResponse({ login: { result: 'Failed', reason: 'Wrong password' } })
    }
    return route(request, url)
  }, async (seen) => {
    const error = await assertRejects(
      () => lookupFeaturesBySteamAppId(1245620, { credentials: CREDENTIALS }),
      PcgwLookupError,
    )
    assertEquals(error.kind, 'authentication')
    assertEquals(seen.some((request) => new URL(request.url).searchParams.get('action') === 'cargoquery'), false)
  })
})

Deno.test('game-name fallback queries the Game table and returns the same feature shape', async () => {
  await withFetch((request, url) => route(request, url), async (seen) => {
    const result = await lookupFeaturesByGameName('Elden Ring', { credentials: CREDENTIALS })
    assertEquals(result?.pageName, 'Elden Ring')
    assertEquals(result?.sixtyFps, 'true')
    const cargo = seen.find((request) => new URL(request.url).searchParams.get('where')?.includes('_pageName'))
    assertStringIncludes(new URL(cargo?.url ?? '').searchParams.get('where') ?? '', 'Game._pageName')
    assertEquals((cargo?.url ?? '').includes('Infobox_game'), false)
  })
})

Deno.test('missing credentials fail before any request', async () => {
  let called = false
  const original = globalThis.fetch
  globalThis.fetch = (() => {
    called = true
    return Promise.resolve(jsonResponse({}))
  }) as typeof fetch
  try {
    const error = await assertRejects(
      () => lookupFeaturesBySteamAppId(1245620, { credentials: { username: '', password: '' } }),
      PcgwLookupError,
    )
    assertEquals(error.kind, 'configuration')
    assertEquals(called, false)
    try {
      credentialsFromEnv({ get: () => undefined })
      throw new Error('expected configuration failure')
    } catch (envError) {
      if (!(envError instanceof PcgwLookupError) || envError.kind !== 'configuration') throw envError
    }
  } finally {
    globalThis.fetch = original
  }
})

Deno.test('a Cargo row without page identity is a schema error, not a cached no-match', async () => {
  await withFetch((request, url) => {
    if (url.searchParams.get('action') === 'cargoquery') return jsonResponse({ cargoquery: [{ title: {} }] })
    return route(request, url)
  }, async () => {
    const error = await assertRejects(
      () => lookupFeaturesBySteamAppId(1245620, { credentials: CREDENTIALS }),
      PcgwLookupError,
    )
    assertEquals(error.kind, 'schema')
  })
})

Deno.test('a nameless Cargo row on the name lookup is a schema error, not a no-match', async () => {
  await withFetch((request, url) => {
    if (url.searchParams.get('action') === 'cargoquery' && url.searchParams.get('tables')?.includes('Game')) {
      return jsonResponse({ cargoquery: [{ title: {} }] })
    }
    return route(request, url)
  }, async () => {
    const error = await assertRejects(
      () => lookupFeaturesByGameName('Elden Ring', { credentials: CREDENTIALS }),
      PcgwLookupError,
    )
    assertEquals(error.kind, 'schema')
  })
})

Deno.test('malformed name search and page resolution are schema errors', async () => {
  await withFetch((request, url) => {
    if (url.searchParams.get('list') === 'search' || url.searchParams.get('redirects') === '1') {
      return jsonResponse({ query: {} })
    }
    return route(request, url)
  }, async () => {
    const error = await assertRejects(
      () => lookupFeaturesByGameName('Elden Ring', { credentials: CREDENTIALS }),
      PcgwLookupError,
    )
    assertEquals(error.kind, 'schema')
  })
})

Deno.test('an authenticated name search with no pages is still a no-match', async () => {
  await withFetch((request, url) => {
    if (url.searchParams.get('list') === 'search') return jsonResponse({ query: { search: [] } })
    if (url.searchParams.get('redirects') === '1') {
      return jsonResponse({ query: { pages: { '-1': { missing: '', ns: 0 } } } })
    }
    if (url.searchParams.get('action') === 'cargoquery') {
      throw new Error('empty name lookup must not query Cargo')
    }
    return route(request, url)
  }, async () => {
    assertEquals(await lookupFeaturesByGameName('Missing Game', { credentials: CREDENTIALS }), null)
  })
})

Deno.test('the function response hides the bot password and classifies permission denial', async () => {
  const original = globalThis.fetch
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.searchParams.get('action') === 'cargoquery') {
      return Promise.resolve(jsonResponse({ errors: [{ code: 'permissiondenied', info: 'read denied' }] }))
    }
    return Promise.resolve(route(request, url))
  }) as typeof fetch
  try {
    const response = await handlePcGamingWikiFeaturesRequest(
      new Request('https://example.test/pcgamingwiki-features', {
        method: 'POST',
        body: JSON.stringify({ steamAppId: 1245620 }),
      }),
      { credentials: CREDENTIALS },
    )
    const text = await response.text()
    assertEquals(response.status, 403)
    assertStringIncludes(text, '"kind":"permission"')
    assertEquals(text.includes(CREDENTIALS.password), false)
    assertEquals(text.includes('session-token'), false)
  } finally {
    globalThis.fetch = original
  }
})
