import { shouldShowPcFeaturesSection, type PcFeaturesVisibilityInput } from './pcFeaturesVisibility'

declare const require: (module: string) => unknown

const assert = require('node:assert/strict') as {
  equal: (actual: unknown, expected: unknown) => void
}
const test = require('node:test') as (name: string, fn: () => void) => void

function input(overrides: Partial<PcFeaturesVisibilityInput> = {}): PcFeaturesVisibilityInput {
  return {
    controllerSupport: null,
    fourKUltraHd: null,
    isError: false,
    isLoading: false,
    officialDiscordUrl: null,
    oneTwentyFps: null,
    perspectives: [],
    sixtyFps: null,
    steamAppId: null,
    steamLoading: false,
    ultrawidescreen: null,
    xboxGamePass: null,
    ...overrides,
  }
}

test('PC Features stays on screen when a name lookup fails and there is no Steam app ID', () => {
  assert.equal(shouldShowPcFeaturesSection(input({ isError: true })), true)
})

test('PC Features stays hidden when a name lookup succeeds with nothing to show', () => {
  assert.equal(shouldShowPcFeaturesSection(input()), false)
})

test('PC Features stays on screen when a Steam app ID is known', () => {
  assert.equal(shouldShowPcFeaturesSection(input({ steamAppId: 1245620 })), true)
})
