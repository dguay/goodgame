import {
  addLocalDays,
  formatDate,
  formatLocalDate,
  formatPubDate,
  formatUpdatedTimestamp,
  getLatestTimestamp,
  isKnownReleased,
  isUpcomingRelease,
} from './dates'

declare const require: (module: string) => unknown

const assert = require('node:assert/strict') as {
  equal: (actual: unknown, expected: unknown) => void
}
const test = require('node:test') as (name: string, fn: () => void) => void

test('treats null release dates as upcoming', () => {
  assert.equal(isUpcomingRelease(null), true)
})

test('returns true for future release dates', () => {
  assert.equal(isUpcomingRelease('2999-01-01'), true)
})

test('formats local dates without UTC conversion', () => {
  assert.equal(formatLocalDate(new Date(2026, 4, 9)), '2026-05-09')
})

test('formats release date strings for display', () => {
  assert.equal(formatDate('2026-05-09'), 'May 9, 2026')
  assert.equal(formatDate('not-a-date'), 'not-a-date')
})

test('adds local calendar days', () => {
  assert.equal(formatLocalDate(addLocalDays(new Date(2026, 4, 19), 1)), '2026-05-20')
  assert.equal(formatLocalDate(addLocalDays(new Date(2026, 4, 19), -30)), '2026-04-19')
})

test('returns false for past release dates', () => {
  assert.equal(isUpcomingRelease('2000-01-01'), false)
})

test('returns false for today', () => {
  const today = new Date()
  const year = today.getFullYear().toString()
  const month = (today.getMonth() + 1).toString().padStart(2, '0')
  const day = today.getDate().toString().padStart(2, '0')

  assert.equal(isUpcomingRelease(`${year}-${month}-${day}`), false)
})

test('returns false for invalid release dates', () => {
  assert.equal(isUpcomingRelease('not-a-date'), false)
  assert.equal(isUpcomingRelease('2026-13-01'), false)
  assert.equal(isUpcomingRelease('2026-01'), false)
})

test('returns true for known released dates', () => {
  assert.equal(isKnownReleased('2000-01-01'), true)
})

test('returns true for known release dates today', () => {
  assert.equal(isKnownReleased(formatLocalDate(new Date())), true)
})

test('returns false for unknown, future, and invalid released dates', () => {
  assert.equal(isKnownReleased(null), false)
  assert.equal(isKnownReleased('2999-01-01'), false)
  assert.equal(isKnownReleased('not-a-date'), false)
})

test('formatPubDate returns empty for null and invalid input', () => {
  assert.equal(formatPubDate(null), '')
  assert.equal(formatPubDate('not-a-date'), '')
})

test('formatPubDate formats pub date with default options', () => {
  assert.equal(formatPubDate('2026-05-09T12:00:00'), 'May 9')
})

test('formatPubDate accepts custom format options', () => {
  assert.equal(
    formatPubDate('2026-05-09T12:00:00', { month: 'long', day: 'numeric', year: 'numeric' }),
    'May 9, 2026',
  )
})

test('formatUpdatedTimestamp prefixes valid timestamps', () => {
  assert.equal(formatUpdatedTimestamp('2026-05-09T16:00:00Z'), 'Updated May 9, 12:00 PM EDT')
  assert.equal(formatUpdatedTimestamp('2026-01-09T17:00:00Z'), 'Updated Jan 9, 12:00 PM EST')
})

test('formatUpdatedTimestamp returns empty for null and invalid input', () => {
  assert.equal(formatUpdatedTimestamp(null), '')
  assert.equal(formatUpdatedTimestamp('not-a-date'), '')
})

test('getLatestTimestamp returns the newest valid timestamp', () => {
  assert.equal(
    getLatestTimestamp([
      '2026-05-09T12:00:00',
      null,
      'not-a-date',
      '2026-05-10T08:30:00',
    ]),
    '2026-05-10T08:30:00',
  )
})

test('getLatestTimestamp returns null when no valid timestamps exist', () => {
  assert.equal(getLatestTimestamp([null, 'not-a-date']), null)
})
