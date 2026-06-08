import {
  parseOfficialDiscordUrl,
  parsePcgwFeatureSupport,
  parsePcgwList,
} from './pcgamingwiki'

declare const require: (module: string) => unknown

const assert = require('node:assert/strict') as {
  deepEqual: (actual: unknown, expected: unknown) => void
  equal: (actual: unknown, expected: unknown) => void
}
const test = require('node:test') as (name: string, fn: () => void) => void

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

test('parseOfficialDiscordUrl ignores Discord links outside General information', () => {
  const source = [
    '==Issues fixed==',
    '{{ii}} Join [https://discord.gg/not-official Discord] for troubleshooting.',
  ].join('\n')

  assert.equal(parseOfficialDiscordUrl(source), null)
})
