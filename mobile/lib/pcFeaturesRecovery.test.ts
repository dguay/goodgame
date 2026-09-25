import {
  compareFeatureRecovery,
  featureRecoveryReport,
  formatFeatureRecoveryReport,
  isPoisonedPcFeaturesRow,
  recoverPcFeaturesCache,
} from '@/lib/pcFeaturesRecovery'
import { pcFeatureSupportLabel, shouldShowPcFeaturesSection } from '@/lib/pcFeaturesVisibility'
import {
  pcFeatureCacheWrite,
  pcFeatureQueryInput,
  resolvePcGamingWikiFeatures,
  type PcGamingWikiFeatureStore,
  type PcGamingWikiLiveLookup,
} from '@/lib/pcgamingwikiCache'
import {
  getPcgwFeaturesByGameName,
  getPcgwFeaturesBySteamAppId,
  type PcGamingWikiInvoke,
  type PcgwFeatureResult,
} from '@/lib/pcgamingwiki'
import { reportProductionFeatureRecovery } from '@/lib/pcFeaturesRecoveryCli'
import type { PcGamingWikiFeatures } from '@/types/database'

declare const require: (module: string) => unknown
declare const __dirname: string

const assert = require('node:assert/strict') as {
  deepEqual: (actual: unknown, expected: unknown) => void
  equal: (actual: unknown, expected: unknown) => void
  rejects: (block: () => Promise<unknown>, error?: RegExp) => Promise<void>
  throws: (block: () => unknown, error?: RegExp) => void
}
const test = require('node:test') as (name: string, fn: () => void | Promise<void>) => void

function row(overrides: Partial<PcGamingWikiFeatures> = {}): PcGamingWikiFeatures {
  return {
    controller_support: null,
    created_at: '2026-06-08T00:00:00.000Z',
    four_k_ultra_hd: null,
    official_discord_url: null,
    one_twenty_fps: null,
    pcgw_page_id: null,
    pcgw_page_name: null,
    perspectives: [],
    rawg_game_id: 10533,
    refreshed_at: '2026-09-04T17:35:29.145Z',
    sixty_fps: null,
    steam_app_id: 238960,
    ultrawidescreen: null,
    updated_at: '2026-09-04T17:35:29.145Z',
    xbox_game_pass: null,
    xbox_game_pass_checked_at: null,
    ...overrides,
  }
}

function documented(): PcGamingWikiFeatures {
  return row({
    controller_support: 'true',
    four_k_ultra_hd: 'limited',
    official_discord_url: 'https://discord.gg/example',
    pcgw_page_id: 146683,
    pcgw_page_name: 'Elden Ring',
    perspectives: ['Third-person'],
    rawg_game_id: 326243,
    sixty_fps: 'true',
    xbox_game_pass: 'true',
    xbox_game_pass_checked_at: '2026-09-04T17:35:29.145Z',
  })
}

const RECOVERED: PcgwFeatureResult = {
  controllerSupport: 'true',
  fourKUltraHd: 'limited',
  officialDiscordUrl: 'https://discord.gg/example',
  oneTwentyFps: 'false',
  pageId: 99,
  pageName: 'Recovered Game',
  pageSourceFetchFailed: false,
  perspectives: ['First-person'],
  sixtyFps: 'true',
  ultrawidescreen: 'hackable',
  xboxGamePass: null,
  xboxGamePassFetchFailed: false,
}

test('an empty row refreshed during the outage is affected and a documented row is not', () => {
  const poisoned = row()
  const kept = documented()
  assert.equal(isPoisonedPcFeaturesRow(poisoned), true)
  assert.equal(isPoisonedPcFeaturesRow(kept), false)
  assert.deepEqual(recoverPcFeaturesCache([poisoned, kept]).map((item) => item.rawg_game_id), [326243])
})

test('empty rows from before the API change and after the recheck stay cached', () => {
  const historicalNoMatch = row({ refreshed_at: '2026-08-01T00:00:00.000Z', rawg_game_id: 1 })
  const repairedNoMatch = row({ refreshed_at: '2026-09-24T17:15:00.000Z', rawg_game_id: 2, steam_app_id: null })
  assert.equal(isPoisonedPcFeaturesRow(historicalNoMatch), false)
  assert.equal(isPoisonedPcFeaturesRow(repairedNoMatch), false)
  assert.deepEqual(
    recoverPcFeaturesCache([historicalNoMatch, repairedNoMatch, row()]).map((item) => item.rawg_game_id),
    [1, 2],
  )
})

test('a row with any documented field inside the window stays', () => {
  assert.equal(isPoisonedPcFeaturesRow(row({ sixty_fps: 'false' })), false)
  assert.equal(isPoisonedPcFeaturesRow(row({ perspectives: ['Side view'] })), false)
  assert.equal(isPoisonedPcFeaturesRow(row({ pcgw_page_name: 'Named' })), false)
  assert.equal(isPoisonedPcFeaturesRow(row({ xbox_game_pass_checked_at: '2026-09-04T00:00:00.000Z' })), false)
})

test('running the recovery again removes nothing further', () => {
  const rows = [row(), documented(), row({ refreshed_at: '2026-07-01T00:00:00.000Z', rawg_game_id: 4 })]
  const once = recoverPcFeaturesCache(rows)
  assert.deepEqual(recoverPcFeaturesCache(once), once)
  assert.equal(once.some((item) => item.rawg_game_id === 10533), false)
})

test('the captured production snapshot is required and scores persisted rows', () => {
  assert.throws(
    () => featureRecoveryReport(null, []),
    /PCGW_RECOVERY_BEFORE is required/,
  )
  const beforePath = pathJoin(__dirname, '../../fixtures/pcgw-features-before-2026-09-24.json')
  const before = JSON.parse(fsRead(beforePath)) as PcGamingWikiFeatures[]
  const after = JSON.parse(fsRead(
    pathJoin(__dirname, '../../fixtures/pcgw-features-after-one-refresh.json'),
  )) as PcGamingWikiFeatures[]
  assert.equal(before.filter(isPoisonedPcFeaturesRow).length, 9)
  assert.equal(featureRecoveryReport(before, after), 'affected 9\npreserved 31\nrefreshed 1\nstill-failing 8')
})

test('the report command reads persisted after rows against the required snapshot', async () => {
  const beforePath = pathJoin(__dirname, '../../fixtures/pcgw-features-before-2026-09-24.json')
  const after = JSON.parse(fsRead(
    pathJoin(__dirname, '../../fixtures/pcgw-features-after-one-refresh.json'),
  )) as PcGamingWikiFeatures[]
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => after,
  })) as unknown as typeof fetch
  try {
    const report = await reportProductionFeatureRecovery({
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      PCGW_RECOVERY_BEFORE: beforePath,
    })
    assert.equal(report, 'affected 9\npreserved 31\nrefreshed 1\nstill-failing 8')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('the report includes cache rows beyond the Supabase 1000-row response limit', async () => {
  const beforePath = pathJoin(__dirname, '../../fixtures/pcgw-features-before-2026-09-24.json')
  const after = JSON.parse(fsRead(
    pathJoin(__dirname, '../../fixtures/pcgw-features-after-one-refresh.json'),
  )) as PcGamingWikiFeatures[]
  const filler = Array.from({ length: 1000 }, (_, index) =>
    row({ rawg_game_id: 2000000 + index, refreshed_at: '2026-09-24T18:00:00.000Z' }),
  )
  const offsets: number[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: string | URL | Request) => {
    const offset = Number(new URL(String(input)).searchParams.get('offset'))
    offsets.push(offset)
    return { ok: true, json: async () => offset === 0 ? filler : after }
  }) as unknown as typeof fetch
  try {
    const report = await reportProductionFeatureRecovery({
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      PCGW_RECOVERY_BEFORE: beforePath,
    })
    assert.deepEqual(offsets, [0, 1000])
    assert.equal(report, 'affected 9\npreserved 31\nrefreshed 1\nstill-failing 8')
  } finally {
    globalThis.fetch = originalFetch
  }
})

function fsRead(path: string): string {
  return (require('node:fs') as { readFileSync: (path: string, encoding: string) => string }).readFileSync(path, 'utf8')
}

function pathJoin(...parts: string[]): string {
  return (require('node:path') as { join: (...parts: string[]) => string }).join(...parts)
}

test('the before snapshot still reports refreshed and still-failing after those rows are gone', () => {
  const refreshed = row({ rawg_game_id: 10533 })
  const failed = row({ rawg_game_id: 17126 })
  const kept = documented()
  const historical = row({ rawg_game_id: 13, refreshed_at: '2026-08-22T23:00:00.000Z' })
  const after = [
    kept,
    historical,
    storedFromLookup(10533, 238960, RECOVERED, '2026-09-24T18:00:00.000Z'),
  ]
  const counts = compareFeatureRecovery([refreshed, failed, kept, historical], after)
  assert.deepEqual(counts, { affected: 2, preserved: 2, refreshed: 1, stillFailing: 1 })
  assert.equal(
    formatFeatureRecoveryReport(counts),
    'affected 2\npreserved 2\nrefreshed 1\nstill-failing 1',
  )
  const changed = compareFeatureRecovery([kept], [{ ...kept, sixty_fps: 'false' }])
  assert.deepEqual(changed, { affected: 0, preserved: 0, refreshed: 0, stillFailing: 0 })
})

test('game 10533 stays cached until recovery, then the feature client stores and displays it', async () => {
  const now = Date.now
  Date.now = () => Date.parse('2026-09-24T12:00:00.000Z')
  try {
  const request = pcFeatureQueryInput({
    isPcGame: true,
    gameId: 10533,
    gameName: 'Poisoned',
    steamAppId: 238960,
    steamLookupComplete: true,
  })
  assert.deepEqual(request, {
    rawgGameId: 10533,
    steamAppId: 238960,
    gameName: 'Poisoned',
    enabled: true,
  })
  const poisoned = row({ rawg_game_id: 10533, steam_app_id: 238960 })
  const kept = documented()
  const rows = new Map<number, PcGamingWikiFeatures>([
    [poisoned.rawg_game_id, poisoned],
    [kept.rawg_game_id, kept],
  ])
  const invoke = invokeWith({ data: { result: RECOVERED }, error: null })
  const lookup: PcGamingWikiLiveLookup = {
    bySteamAppId: (steamAppId) => getPcgwFeaturesBySteamAppId(steamAppId, invoke),
    byGameName: (gameName) => getPcgwFeaturesByGameName(gameName, invoke),
  }
  const store = persistingStore(rows)

  const blocked = await resolvePcGamingWikiFeatures(10533, 238960, 'Poisoned', store, lookup)
  assert.equal(blocked.pageName, null)
  assert.equal(blocked.sixtyFps, null)
  assert.deepEqual(invoke.bodies, [])
  assert.equal(rows.get(10533)?.refreshed_at, poisoned.refreshed_at)

  rows.delete(10533)
  const opened = await resolvePcGamingWikiFeatures(10533, 238960, 'Poisoned', store, lookup)
  assert.equal(opened.pageName, 'Recovered Game')
  assert.equal(opened.sixtyFps, 'true')
  assert.deepEqual(invoke.bodies, [{ steamAppId: 238960 }])
  const saved = rows.get(10533)
  assert.equal(saved != null && !isPoisonedPcFeaturesRow(saved), true)
  assert.equal(shouldShowPcFeaturesSection({
    controllerSupport: opened.controllerSupport,
    fourKUltraHd: opened.fourKUltraHd,
    isError: false,
    isLoading: false,
    officialDiscordUrl: opened.officialDiscordUrl,
    oneTwentyFps: opened.oneTwentyFps,
    perspectives: opened.perspectives,
    sixtyFps: opened.sixtyFps,
    steamAppId: 238960,
    steamLoading: false,
    ultrawidescreen: opened.ultrawidescreen,
    xboxGamePass: opened.xboxGamePass,
  }), true)
  assert.equal(pcFeatureSupportLabel(opened.sixtyFps), 'Supported')
  assert.equal(pcFeatureSupportLabel(opened.fourKUltraHd), 'Limited')
  assert.deepEqual(
    compareFeatureRecovery([poisoned, kept], [saved!, kept]),
    { affected: 1, preserved: 1, refreshed: 1, stillFailing: 0 },
  )
  } finally {
    Date.now = now
  }
})

test('a failed refresh of a recovered game does not write a cache row', async () => {
  const poisoned = row()
  const rows = new Map<number, PcGamingWikiFeatures>()
  const store = persistingStore(rows)
  const lookup: PcGamingWikiLiveLookup = {
    bySteamAppId: async () => {
      throw new Error('PCGamingWiki permissiondenied: cargo')
    },
    byGameName: async () => null,
  }
  await assert.rejects(
    () => resolvePcGamingWikiFeatures(10533, 238960, 'Poisoned', store, lookup),
    /permissiondenied/,
  )
  assert.equal(rows.has(10533), false)
  assert.deepEqual(
    compareFeatureRecovery([poisoned], []),
    { affected: 1, preserved: 0, refreshed: 0, stillFailing: 1 },
  )
})

test('a successful no-match cached after the repaired lookup survives another recovery', async () => {
  const rows = new Map<number, PcGamingWikiFeatures>()
  const store = persistingStore(rows)
  const lookup: PcGamingWikiLiveLookup = {
    byGameName: async () => null,
    bySteamAppId: async () => null,
  }
  const opened = await resolvePcGamingWikiFeatures(1019778, null, 'No Page', store, lookup)
  assert.equal(opened.isDocumented, false)
  const saved = rows.get(1019778)
  assert.equal(saved != null && isPoisonedPcFeaturesRow(saved), false)
  assert.deepEqual(recoverPcFeaturesCache([documented(), saved!]), [documented(), saved!])
})

function invokeWith(response: { data: unknown; error: null }): PcGamingWikiInvoke & { bodies: unknown[] } {
  const bodies: unknown[] = []
  const invoke = (async (body: unknown) => {
    bodies.push(body)
    return response
  }) as PcGamingWikiInvoke & { bodies: unknown[] }
  invoke.bodies = bodies
  return invoke
}

function storedFromLookup(
  rawgGameId: number,
  steamAppId: number | null,
  result: PcgwFeatureResult | null,
  refreshedAt: string,
): PcGamingWikiFeatures {
  return row({
    controller_support: result?.controllerSupport ?? null,
    four_k_ultra_hd: result?.fourKUltraHd ?? null,
    official_discord_url: result?.officialDiscordUrl ?? null,
    one_twenty_fps: result?.oneTwentyFps ?? null,
    pcgw_page_id: result?.pageId ?? null,
    pcgw_page_name: result?.pageName ?? null,
    perspectives: result?.perspectives ?? [],
    rawg_game_id: rawgGameId,
    refreshed_at: refreshedAt,
    sixty_fps: result?.sixtyFps ?? null,
    steam_app_id: steamAppId,
    ultrawidescreen: result?.ultrawidescreen ?? null,
    updated_at: refreshedAt,
    xbox_game_pass: result?.xboxGamePass ?? null,
    xbox_game_pass_checked_at: result == null ? null : refreshedAt,
  })
}

function persistingStore(rows: Map<number, PcGamingWikiFeatures>): PcGamingWikiFeatureStore {
  return {
    read: async (rawgGameId) => rows.get(rawgGameId) ?? null,
    write: async (rawgGameId, steamAppId, result) => {
      const write = pcFeatureCacheWrite(rawgGameId, steamAppId, result, '2026-09-24T18:00:00.000Z') as Partial<PcGamingWikiFeatures> & {
        refreshed_at: string
      }
      const saved = row({
        ...write,
        created_at: write.refreshed_at,
        updated_at: write.refreshed_at,
        official_discord_url: write.official_discord_url ?? null,
        xbox_game_pass: write.xbox_game_pass ?? null,
        xbox_game_pass_checked_at: write.xbox_game_pass_checked_at ?? null,
      })
      rows.set(rawgGameId, saved)
      return saved
    },
    refreshXboxGamePass: async (current) => current,
  }
}
