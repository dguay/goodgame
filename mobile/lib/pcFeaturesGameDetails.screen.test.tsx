import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { RawgGameDetail } from '@/types/rawg'
import type { PcGamingWikiFeatures } from '@/types/database'

declare const require: (module: string) => unknown

const assert = require('node:assert/strict') as {
  deepEqual: (actual: unknown, expected: unknown) => void
  equal: (actual: unknown, expected: unknown) => void
}
const test = require('node:test') as (name: string, fn: () => Promise<void>) => void
interface TestView {
  root: {
    findAllByType(type: string): { children: (string | object)[] }[]
  }
  unmount(): void
}
const renderer = require('react-test-renderer') as {
  act(fn: () => void | Promise<void>): Promise<void>
  create(element: React.ReactElement): TestView
}
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

interface ScreenFixture {
  game: RawgGameDetail
  steamAppId: number
  supabase: object
}

const screenGlobal = globalThis as typeof globalThis & { __pcgwScreenFixture?: ScreenFixture }

test('a recovered PC game refreshes through the feature hook and appears on game details', async () => {
  const writes: Record<string, unknown>[] = []
  const functionCalls: unknown[] = []
  const game: RawgGameDetail = {
    id: 10533,
    name: 'Recovered Game',
    slug: 'recovered-game',
    background_image: null,
    released: '2020-01-01',
    metacritic: null,
    rating: 0,
    ratings_count: 0,
    genres: [],
    platforms: [{ platform: { id: 1, name: 'PC', slug: 'pc' } }],
    short_screenshots: [],
    description_raw: '',
    developers: [],
    publishers: [],
    website: '',
    playtime: 0,
    reddit_url: null,
  }
  const supabase = {
    from: (table: string) => {
      assert.equal(table, 'pcgamingwiki_features')
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
        upsert: (write: Record<string, unknown>) => {
          writes.push(write)
          return {
            select: () => ({
              single: async () => ({
                data: {
                  ...write,
                  created_at: write.refreshed_at,
                  updated_at: write.refreshed_at,
                } as PcGamingWikiFeatures,
                error: null,
              }),
            }),
          }
        },
      }
    },
    functions: {
      invoke: async (_name: string, args: { body: unknown }) => {
        functionCalls.push(args.body)
        return {
          data: { result: {
            pageId: 99,
            pageName: 'Recovered Game',
            controllerSupport: 'true',
            fourKUltraHd: 'limited',
            sixtyFps: 'true',
            oneTwentyFps: 'false',
            ultrawidescreen: 'hackable',
            perspectives: ['First-person'],
            officialDiscordUrl: 'https://discord.gg/example',
            xboxGamePass: 'true',
            pageSourceFetchFailed: false,
            xboxGamePassFetchFailed: false,
          } },
          error: null,
        }
      },
    },
  }
  screenGlobal.__pcgwScreenFixture = { game, steamAppId: 238960, supabase }
  const GameDetailScreen = (require('@/app/game/[id]') as { default: React.ComponentType }).default
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let view: TestView | undefined
  try {
    await renderer.act(async () => {
      view = renderer.create(
        <QueryClientProvider client={client}><GameDetailScreen /></QueryClientProvider>,
      )
    })
    await renderer.act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 30))
    })
    assert.equal(functionCalls.length, 1)
    assert.deepEqual(functionCalls[0], { steamAppId: 238960 })
    assert.equal(writes.length, 1)
    assert.equal(writes[0].rawg_game_id, 10533)
    assert.equal(writes[0].four_k_ultra_hd, 'limited')
    const visibleText = view?.root.findAllByType('span').flatMap((node) =>
      node.children.filter((child): child is string => typeof child === 'string'),
    ) ?? []
    assert.equal(visibleText.includes('Limited'), true)
    assert.equal(visibleText.includes('First-person'), true)
  } finally {
    await renderer.act(async () => view?.unmount())
    client.clear()
    delete screenGlobal.__pcgwScreenFixture
  }
})
