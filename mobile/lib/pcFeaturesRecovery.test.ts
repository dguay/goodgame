import {
  PCGW_API_CHANGE_AT_MS,
  PCGW_POISON_REFRESH_BEFORE_MS,
  featureRecoveryCounts,
  formatFeatureRecoveryReport,
  isPoisonedPcFeaturesRow,
  recoverPcFeaturesCache,
  refreshRecoveredGameDetails,
  type FeatureRefreshOutcome,
} from './pcFeaturesRecovery'
import type { PcGamingWikiFeatureStore, PcGamingWikiLiveLookup } from './pcgamingwikiCache'
import type { PcgwFeatureResult } from './pcgamingwiki'
import type { PcGamingWikiFeatures } from '../types/database'

declare const require: (module: string) => unknown
declare const __dirname: string

const assert = require('node:assert/strict') as {
  deepEqual: (actual: unknown, expected: unknown) => void
  equal: (actual: unknown, expected: unknown) => void
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

const live: PcgwFeatureResult = {
  controllerSupport: 'true',
  fourKUltraHd: 'true',
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

test('the migration deletes the same outage window the predicate uses', () => {
  const fs = require('node:fs') as { readFileSync: (path: string, encoding: string) => string }
  const path = require('node:path') as { join: (...parts: string[]) => string }
  const sql = fs.readFileSync(
    path.join(__dirname, '../../../supabase/migrations/20260924171500_recover_poisoned_pcgw_features.sql'),
    'utf8',
  )
  const start = new Date(PCGW_API_CHANGE_AT_MS).toISOString().replace('.000Z', '+00').replace('T', ' ')
  const end = new Date(PCGW_POISON_REFRESH_BEFORE_MS).toISOString().replace('.000Z', '+00').replace('T', ' ')
  assert.equal(sql.includes(`timestamptz '${start}'`), true)
  assert.equal(sql.includes(`timestamptz '${end}'`), true)
  assert.equal(sql.includes('DELETE FROM public.pcgamingwiki_features'), true)
})

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

test('the report counts affected, preserved, refreshed, and still-failing rows', () => {
  const rows = [
    row({ rawg_game_id: 11 }),
    row({ rawg_game_id: 12 }),
    documented(),
    row({ rawg_game_id: 13, refreshed_at: '2026-08-22T23:00:00.000Z' }),
  ]
  const outcomes = new Map<number, FeatureRefreshOutcome>([
    [11, 'refreshed'],
    [12, 'still-failing'],
  ])
  const counts = featureRecoveryCounts(rows, outcomes)
  assert.deepEqual(counts, { affected: 2, preserved: 2, refreshed: 1, stillFailing: 1 })
  assert.equal(
    formatFeatureRecoveryReport(counts),
    'affected 2\npreserved 2\nrefreshed 1\nstill-failing 1',
  )
})

test('a poisoned row inside the freshness window is served from cache until recovery removes it', async () => {
  let lookups = 0
  const lookup: PcGamingWikiLiveLookup = {
    bySteamAppId: async () => {
      lookups += 1
      return live
    },
    byGameName: async () => null,
  }
  const cached = storeReturning(row())
  const blocked = await refreshRecoveredGameDetails({
    rawgGameId: 10533,
    steamAppId: 238960,
    gameName: 'Poisoned',
    isPcGame: true,
    steamLookupComplete: true,
    store: cached,
    lookup,
  })
  assert.equal(blocked, 'still-cached')
  assert.equal(lookups, 0)
  assert.deepEqual(cached.writes, [])

  const recovered = storeReturning(null)
  const opened = await refreshRecoveredGameDetails({
    rawgGameId: 10533,
    steamAppId: 238960,
    gameName: 'Poisoned',
    isPcGame: true,
    steamLookupComplete: true,
    store: recovered,
    lookup,
  })
  assert.equal(opened, 'refreshed')
  assert.equal(lookups, 1)
  assert.equal(recovered.writes.length, 1)
})

test('a failed refresh of a recovered game does not write a cache row', async () => {
  const store = storeReturning(null)
  const lookup: PcGamingWikiLiveLookup = {
    bySteamAppId: async () => {
      throw new Error('PCGamingWiki permissiondenied: cargo')
    },
    byGameName: async () => null,
  }
  const outcome = await refreshRecoveredGameDetails({
    rawgGameId: 10533,
    steamAppId: 238960,
    gameName: 'Poisoned',
    isPcGame: true,
    steamLookupComplete: true,
    store,
    lookup,
  })
  assert.equal(outcome, 'still-failing')
  assert.deepEqual(store.writes, [])
})

test('a successful no-match cached after the repaired lookup survives another recovery', async () => {
  const stored: PcGamingWikiFeatures[] = []
  const store: PcGamingWikiFeatureStore & { writes: unknown[][] } = {
    writes: [],
    read: async () => null,
    write: async (rawgGameId, steamAppId, result) => {
      store.writes.push([rawgGameId, steamAppId, result])
      const saved = row({
        rawg_game_id: rawgGameId,
        steam_app_id: steamAppId,
        refreshed_at: '2026-09-24T18:00:00.000Z',
        updated_at: '2026-09-24T18:00:00.000Z',
      })
      stored.push(saved)
      return saved
    },
    refreshXboxGamePass: async (current) => current,
  }
  const lookup: PcGamingWikiLiveLookup = {
    byGameName: async () => null,
    bySteamAppId: async () => null,
  }
  const outcome = await refreshRecoveredGameDetails({
    rawgGameId: 1019778,
    steamAppId: null,
    gameName: 'No Page',
    isPcGame: true,
    steamLookupComplete: true,
    store,
    lookup,
  })
  assert.equal(outcome, 'refreshed')
  assert.equal(store.writes.length, 1)
  assert.equal(isPoisonedPcFeaturesRow(stored[0]), false)
  assert.deepEqual(recoverPcFeaturesCache([documented(), stored[0]]), [documented(), stored[0]])
})

test('a non-PC game and an unfinished Steam lookup do not refresh features', async () => {
  const store = storeReturning(null)
  const lookup: PcGamingWikiLiveLookup = {
    bySteamAppId: async () => live,
    byGameName: async () => live,
  }
  const shared = {
    rawgGameId: 10533,
    steamAppId: 238960,
    gameName: 'Poisoned',
    store,
    lookup,
  }
  assert.equal(
    await refreshRecoveredGameDetails({ ...shared, isPcGame: false, steamLookupComplete: true }),
    'skipped',
  )
  assert.equal(
    await refreshRecoveredGameDetails({ ...shared, isPcGame: true, steamLookupComplete: false }),
    'skipped',
  )
  assert.deepEqual(store.writes, [])
})

function storeReturning(cached: PcGamingWikiFeatures | null): PcGamingWikiFeatureStore & { writes: unknown[][] } {
  const writes: unknown[][] = []
  return {
    writes,
    read: async () => cached,
    write: async (...args) => {
      writes.push(args)
      return cached
    },
    refreshXboxGamePass: async (current) => current,
  }
}
