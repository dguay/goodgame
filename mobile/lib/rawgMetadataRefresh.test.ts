import { classifyMetadataPersistence, selectEntriesToRefresh } from './rawgMetadataRefresh'
import type { LibraryEntry } from '../types/database'

declare const require: (module: string) => unknown

const assert = require('node:assert/strict') as {
  deepEqual: (actual: unknown, expected: unknown) => void
}
const test = require('node:test') as (name: string, fn: () => void) => void

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

const NOW = new Date('2026-06-10T12:00:00').getTime()

function syncedAgo(ms: number): string {
  return new Date(NOW - ms).toISOString()
}

function makeEntry(overrides: Partial<LibraryEntry> & Pick<LibraryEntry, 'id'>): LibraryEntry {
  return {
    created_at: '2026-01-01T00:00:00.000Z',
    custom_order: null,
    finished_at: null,
    game_cover_url: null,
    game_title: 'Game',
    personal_notes: null,
    personal_playtime_minutes: null,
    personal_rating: null,
    platforms: null,
    rawg_game_id: 1,
    rawg_metadata_synced_at: syncedAgo(DAY_MS + HOUR_MS),
    release_date: null,
    started_at: null,
    status: 'want_to_play',
    updated_at: '2026-01-01T00:00:00.000Z',
    user_id: 'user-id',
    ...overrides,
  }
}

function selectedIds(entries: LibraryEntry[]): string[] {
  return selectEntriesToRefresh(entries, NOW).map(entry => entry.id)
}

test('selects a stale unreleased entry regardless of status', () => {
  const entries = [
    makeEntry({ id: 'want', release_date: '2026-09-01', status: 'want_to_play' }),
    makeEntry({ id: 'playing', release_date: '2026-09-01', status: 'playing' }),
  ]

  assert.deepEqual(selectedIds(entries), ['want', 'playing'])
})

test('skips a released entry even when its metadata is stale', () => {
  const entries = [
    makeEntry({ id: 'released', release_date: '2026-01-15' }),
    makeEntry({ id: 'released-today', release_date: '2026-06-10' }),
  ]

  assert.deepEqual(selectedIds(entries), [])
})

test('refreshes entries with missing release data', () => {
  const entries = [
    makeEntry({ id: 'missing', release_date: null, status: 'playing' }),
  ]

  assert.deepEqual(selectedIds(entries), ['missing'])
})

test('treats a missing or unparseable sync timestamp as stale', () => {
  const entries = [
    makeEntry({ id: 'never-synced', release_date: '2026-09-01', rawg_metadata_synced_at: null }),
    makeEntry({ id: 'invalid-sync', release_date: '2026-09-01', rawg_metadata_synced_at: 'not-a-date' }),
  ]

  assert.deepEqual(selectedIds(entries), ['never-synced', 'invalid-sync'])
})

test('skips unreleased entries whose metadata is fresh', () => {
  const entries = [
    makeEntry({ id: 'fresh', release_date: '2026-09-01', rawg_metadata_synced_at: syncedAgo(HOUR_MS) }),
    makeEntry({ id: 'fresh-null-date', release_date: null, rawg_metadata_synced_at: syncedAgo(HOUR_MS) }),
  ]

  assert.deepEqual(selectedIds(entries), [])
})

test('uses a 24-hour staleness window further from release', () => {
  const farRelease = '2026-09-01'
  const entries = [
    makeEntry({ id: 'stale', release_date: farRelease, rawg_metadata_synced_at: syncedAgo(DAY_MS + HOUR_MS) }),
    makeEntry({ id: 'fresh', release_date: farRelease, rawg_metadata_synced_at: syncedAgo(DAY_MS - HOUR_MS) }),
  ]

  assert.deepEqual(selectedIds(entries), ['stale'])
})

test('uses a 12-hour staleness window near release', () => {
  const nearRelease = '2026-06-20'
  const entries = [
    makeEntry({ id: 'stale', release_date: nearRelease, rawg_metadata_synced_at: syncedAgo(13 * HOUR_MS) }),
    makeEntry({ id: 'fresh', release_date: nearRelease, rawg_metadata_synced_at: syncedAgo(11 * HOUR_MS) }),
  ]

  assert.deepEqual(selectedIds(entries), ['stale'])
})

test('treats metadata synced exactly at the staleness threshold as stale', () => {
  const entries = [
    makeEntry({ id: 'exact-default', release_date: '2026-09-01', rawg_metadata_synced_at: syncedAgo(DAY_MS) }),
    makeEntry({ id: 'exact-near', release_date: '2026-06-20', rawg_metadata_synced_at: syncedAgo(12 * HOUR_MS) }),
  ]

  assert.deepEqual(selectedIds(entries), ['exact-default', 'exact-near'])
})

test('counts a persisted row as an update', () => {
  assert.deepEqual(
    classifyMetadataPersistence({ data: { id: 'entry-id' }, error: null }),
    { outcome: 'updated' },
  )
})

test('does not count a zero-row update as an update', () => {
  assert.deepEqual(
    classifyMetadataPersistence({ data: null, error: null }),
    { outcome: 'missing' },
  )
})

test('reports a rejected update with its message', () => {
  assert.deepEqual(
    classifyMetadataPersistence({ data: null, error: { message: 'permission denied' } }),
    { outcome: 'error', message: 'permission denied' },
  )
})

test('prioritizes want_to_play entries while preserving input order', () => {
  const entries = [
    makeEntry({ id: 'backlog', release_date: '2026-09-01', status: 'playing' }),
    makeEntry({ id: 'want-first', release_date: '2026-09-01' }),
    makeEntry({ id: 'want-second', release_date: null }),
    makeEntry({ id: 'done', release_date: '2026-09-01', status: 'done' }),
  ]

  assert.deepEqual(selectedIds(entries), ['want-first', 'want-second', 'backlog', 'done'])
})
