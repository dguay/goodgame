import type { PcGamingWikiFeatures } from '../types/database'
import {
  resolvePcGamingWikiFeatures,
  type PcGamingWikiFeatureStore,
  type PcGamingWikiLiveLookup,
} from './pcgamingwikiCache'

// Anonymous Cargo access stopped on this date. Empty rows refreshed earlier are
// successful no-matches from before the outage.
export const PCGW_API_CHANGE_AT_MS = Date.parse('2026-08-23T00:00:00.000Z')

// Production recheck at 2026-09-24T17:14:59Z found nine fully empty rows, all
// refreshed on or before 2026-09-19. Rows refreshed at or after this instant,
// including a later successful no-match, stay cached.
export const PCGW_POISON_REFRESH_BEFORE_MS = Date.parse('2026-09-24T17:15:00.000Z')

const SUPPORT_FIELDS = [
  'controller_support',
  'four_k_ultra_hd',
  'one_twenty_fps',
  'sixty_fps',
  'ultrawidescreen',
  'xbox_game_pass',
] as const

export interface FeatureRecoveryCounts {
  affected: number
  preserved: number
  refreshed: number
  stillFailing: number
}

export type FeatureRefreshOutcome = 'refreshed' | 'still-failing' | 'still-cached'

export function isPoisonedPcFeaturesRow(row: PcGamingWikiFeatures): boolean {
  const refreshedAt = Date.parse(row.refreshed_at)
  if (!Number.isFinite(refreshedAt)) return false
  if (refreshedAt < PCGW_API_CHANGE_AT_MS || refreshedAt >= PCGW_POISON_REFRESH_BEFORE_MS) return false
  if (row.pcgw_page_id != null || row.pcgw_page_name != null) return false
  if (row.official_discord_url != null || row.xbox_game_pass_checked_at != null) return false
  if ((row.perspectives?.length ?? 0) > 0) return false
  return SUPPORT_FIELDS.every((field) => row[field] == null)
}

export function recoverPcFeaturesCache<T extends PcGamingWikiFeatures>(rows: readonly T[]): T[] {
  return rows.filter((row) => !isPoisonedPcFeaturesRow(row))
}

export function featureRecoveryCounts(
  rows: readonly PcGamingWikiFeatures[],
  refreshOutcomes: ReadonlyMap<number, FeatureRefreshOutcome> = new Map(),
): FeatureRecoveryCounts {
  let affected = 0
  let refreshed = 0
  let stillFailing = 0
  for (const row of rows) {
    if (!isPoisonedPcFeaturesRow(row)) continue
    affected += 1
    const outcome = refreshOutcomes.get(row.rawg_game_id)
    if (outcome === 'refreshed') refreshed += 1
    else if (outcome === 'still-failing') stillFailing += 1
  }
  return {
    affected,
    preserved: rows.length - affected,
    refreshed,
    stillFailing,
  }
}

export function formatFeatureRecoveryReport(counts: FeatureRecoveryCounts): string {
  return [
    `affected ${counts.affected}`,
    `preserved ${counts.preserved}`,
    `refreshed ${counts.refreshed}`,
    `still-failing ${counts.stillFailing}`,
  ].join('\n')
}

export interface RecoveredGameDetailsInput {
  rawgGameId: number
  steamAppId: number | null
  gameName: string | null
  isPcGame: boolean
  steamLookupComplete: boolean
  store: PcGamingWikiFeatureStore
  lookup: PcGamingWikiLiveLookup
}

// Same gate as the game details screen: PC platform, then Steam lookup completion,
// then the feature resolver. A missing cache row is what makes an outage row
// eligible again inside the 30-day freshness window.
export async function refreshRecoveredGameDetails(
  input: RecoveredGameDetailsInput,
): Promise<FeatureRefreshOutcome | 'skipped'> {
  if (!input.isPcGame || !input.steamLookupComplete) return 'skipped'
  let lookedUp = false
  const lookup: PcGamingWikiLiveLookup = {
    bySteamAppId: async (steamAppId) => {
      lookedUp = true
      return input.lookup.bySteamAppId(steamAppId)
    },
    byGameName: async (gameName) => {
      lookedUp = true
      return input.lookup.byGameName(gameName)
    },
  }
  try {
    await resolvePcGamingWikiFeatures(
      input.rawgGameId,
      input.steamAppId,
      input.gameName,
      input.store,
      lookup,
    )
  } catch {
    return 'still-failing'
  }
  return lookedUp ? 'refreshed' : 'still-cached'
}
