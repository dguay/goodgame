import { isUpcomingRelease } from './releaseDates'

declare const require: (module: string) => unknown

const assert = require('node:assert/strict') as {
  equal: (actual: unknown, expected: unknown) => void
}
const test = require('node:test') as (
  name: string,
  fn: () => void,
) => void

test('treats null release dates as upcoming', () => {
  assert.equal(isUpcomingRelease(null), true)
})

test('returns true for future release dates', () => {
  assert.equal(isUpcomingRelease('2999-01-01'), true)
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
