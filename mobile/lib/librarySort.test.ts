import { sortLibraryEntries } from './librarySort'
import type { LibraryEntry } from '../types/database'

declare const require: (module: string) => unknown

const assert = require('node:assert/strict') as {
  deepEqual: (actual: unknown, expected: unknown) => void
}
const test = require('node:test') as (name: string, fn: () => void) => void

function makeEntry(overrides: Pick<LibraryEntry, 'id' | 'game_title' | 'release_date'>): LibraryEntry {
  return {
    created_at: '2026-01-01T00:00:00.000Z',
    custom_order: null,
    finished_at: null,
    game_cover_url: null,
    personal_notes: null,
    personal_playtime_minutes: null,
    personal_rating: null,
    platforms: null,
    rawg_game_id: 1,
    started_at: null,
    status: 'want_to_play',
    updated_at: '2026-01-01T00:00:00.000Z',
    user_id: 'user-id',
    ...overrides,
  }
}

test('sorts TBA release dates first when release date is descending', () => {
  const entries = [
    makeEntry({ id: 'tba', game_title: 'TBA Game', release_date: null }),
    makeEntry({ id: 'old', game_title: 'Old Game', release_date: '2024-01-01' }),
    makeEntry({ id: 'new', game_title: 'New Game', release_date: '2026-01-01' }),
  ]

  assert.deepEqual(
    sortLibraryEntries(entries, 'release_date', 'desc').map(entry => entry.id),
    ['tba', 'new', 'old'],
  )
})

test('sorts TBA release dates last when release date is ascending', () => {
  const entries = [
    makeEntry({ id: 'tba', game_title: 'TBA Game', release_date: null }),
    makeEntry({ id: 'old', game_title: 'Old Game', release_date: '2024-01-01' }),
    makeEntry({ id: 'new', game_title: 'New Game', release_date: '2026-01-01' }),
  ]

  assert.deepEqual(
    sortLibraryEntries(entries, 'release_date', 'asc').map(entry => entry.id),
    ['old', 'new', 'tba'],
  )
})
