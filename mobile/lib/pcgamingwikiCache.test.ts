import {
  resolvePcGamingWikiFeatures,
  type PcGamingWikiFeatureStore,
  type PcGamingWikiLiveLookup,
} from './pcgamingwikiCache'
import type { PcGamingWikiFeatures } from '../types/database'

declare const require: (module: string) => unknown

const assert = require('node:assert/strict') as {
  deepEqual: (actual: unknown, expected: unknown) => void
  equal: (actual: unknown, expected: unknown) => void
  rejects: (block: () => Promise<unknown>, error?: RegExp) => Promise<void>
}
const test = require('node:test') as (name: string, fn: () => void | Promise<void>) => void

function cachedRow(overrides: Partial<PcGamingWikiFeatures> = {}): PcGamingWikiFeatures {
  return {
    controller_support: 'true',
    created_at: '2026-06-01T00:00:00.000Z',
    four_k_ultra_hd: 'limited',
    official_discord_url: 'https://discord.gg/eldenring',
    one_twenty_fps: 'false',
    pcgw_page_id: 146683,
    pcgw_page_name: 'Elden Ring',
    perspectives: ['Third-person'],
    rawg_game_id: 326243,
    refreshed_at: '2026-06-01T00:00:00.000Z',
    sixty_fps: 'true',
    steam_app_id: 1245620,
    ultrawidescreen: 'hackable',
    updated_at: '2026-06-01T00:00:00.000Z',
    xbox_game_pass: 'true',
    xbox_game_pass_checked_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

function storeWith(row: PcGamingWikiFeatures | null): PcGamingWikiFeatureStore & { writes: unknown[][] } {
  const writes: unknown[][] = []
  return {
    writes,
    read: async () => row,
    write: async (...args) => {
      writes.push(args)
      return row
    },
    refreshXboxGamePass: async (current) => current,
  }
}

function lookupThat(result: 'permissiondenied' | null): PcGamingWikiLiveLookup {
  return {
    bySteamAppId: async () => {
      if (result === 'permissiondenied') {
        throw new Error('PCGamingWiki permissiondenied: cargo')
      }
      return null
    },
    byGameName: async () => null,
  }
}

test('a permissiondenied refresh keeps a documented cache row unchanged', async () => {
  const row = cachedRow()
  const store = storeWith(row)
  const result = await resolvePcGamingWikiFeatures(
    row.rawg_game_id,
    row.steam_app_id,
    'Elden Ring',
    store,
    lookupThat('permissiondenied'),
  )
  assert.equal(result.pageName, 'Elden Ring')
  assert.equal(result.fourKUltraHd, 'limited')
  assert.equal(result.officialDiscordUrl, 'https://discord.gg/eldenring')
  assert.equal(result.isDocumented, true)
  assert.deepEqual(store.writes, [])
  assert.equal(row.refreshed_at, '2026-06-01T00:00:00.000Z')
})

test('a permissiondenied lookup with no cache stays an error and inserts nothing', async () => {
  const store = storeWith(null)
  await assert.rejects(
    () => resolvePcGamingWikiFeatures(326243, 1245620, 'Elden Ring', store, lookupThat('permissiondenied')),
    /permissiondenied/,
  )
  assert.deepEqual(store.writes, [])
})

test('a successful empty Cargo result is still cached as an undocumented game', async () => {
  const store = storeWith(null)
  const result = await resolvePcGamingWikiFeatures(326243, 1245620, 'Missing Game', store, lookupThat(null))
  assert.equal(result.isDocumented, false)
  assert.equal(result.pageName, null)
  assert.deepEqual(store.writes, [[326243, 1245620, null]])
})
