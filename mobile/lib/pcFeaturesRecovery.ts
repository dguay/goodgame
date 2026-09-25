import type { PcGamingWikiFeatures } from '@/types/database'

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

function instant(value: string | null): string | null {
  if (value == null) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? String(parsed) : value
}

function persistedSignature(row: PcGamingWikiFeatures): string {
  return JSON.stringify([
    row.rawg_game_id,
    row.steam_app_id,
    row.pcgw_page_id,
    row.pcgw_page_name,
    row.controller_support,
    row.four_k_ultra_hd,
    row.sixty_fps,
    row.one_twenty_fps,
    row.ultrawidescreen,
    row.official_discord_url,
    row.xbox_game_pass,
    instant(row.xbox_game_pass_checked_at),
    row.perspectives,
    instant(row.refreshed_at),
  ])
}

// `before` is the cache read taken before invalidation. Affected ids come from
// that snapshot, then `after` is the persisted table once recovery has run.
export function compareFeatureRecovery(
  before: readonly PcGamingWikiFeatures[],
  after: readonly PcGamingWikiFeatures[],
): FeatureRecoveryCounts {
  const afterById = new Map(after.map((row) => [row.rawg_game_id, row]))
  let affected = 0
  let preserved = 0
  let refreshed = 0
  let stillFailing = 0
  for (const row of before) {
    const next = afterById.get(row.rawg_game_id)
    if (!isPoisonedPcFeaturesRow(row)) {
      if (next != null && persistedSignature(next) === persistedSignature(row)) preserved += 1
      continue
    }
    affected += 1
    if (
      next != null &&
      !isPoisonedPcFeaturesRow(next) &&
      Date.parse(next.refreshed_at) > Date.parse(row.refreshed_at)
    ) {
      refreshed += 1
    } else {
      stillFailing += 1
    }
  }
  return { affected, preserved, refreshed, stillFailing }
}

export function featureRecoveryReport(
  before: readonly PcGamingWikiFeatures[] | null,
  after: readonly PcGamingWikiFeatures[],
): string {
  if (before == null) {
    throw new Error('PCGW_RECOVERY_BEFORE is required')
  }
  return formatFeatureRecoveryReport(compareFeatureRecovery(before, after))
}

export function formatFeatureRecoveryReport(counts: FeatureRecoveryCounts): string {
  return [
    `affected ${counts.affected}`,
    `preserved ${counts.preserved}`,
    `refreshed ${counts.refreshed}`,
    `still-failing ${counts.stillFailing}`,
  ].join('\n')
}
