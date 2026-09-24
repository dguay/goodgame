import { compareFeatureRecovery, formatFeatureRecoveryReport } from './pcFeaturesRecovery'
import type { PcGamingWikiFeatures } from '../types/database'

declare const process: {
  env: Record<string, string | undefined>
  exitCode?: number
}
declare const require: (module: string) => unknown

// Prints affected, preserved, refreshed, and still-failing counts.
// Pass PCGW_RECOVERY_BEFORE as a JSON snapshot from before invalidation.
// Without it, the current table is both sides, so rows that are still empty
// count as still-failing.
export async function reportProductionFeatureRecovery(
  env: Record<string, string | undefined>,
): Promise<string> {
  const url = env.EXPO_PUBLIC_SUPABASE_URL
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Supabase URL and anon key are required')
  }
  const response = await fetch(`${url}/rest/v1/pcgamingwiki_features?select=*`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  })
  if (!response.ok) {
    throw new Error(`feature cache read failed: ${response.status}`)
  }
  const after = (await response.json()) as PcGamingWikiFeatures[]
  const before = beforeRowsFromEnv(env) ?? after
  return formatFeatureRecoveryReport(compareFeatureRecovery(before, after))
}

function beforeRowsFromEnv(env: Record<string, string | undefined>): PcGamingWikiFeatures[] | null {
  const path = env.PCGW_RECOVERY_BEFORE
  if (!path) return null
  const fs = require('node:fs') as { readFileSync: (path: string, encoding: string) => string }
  return JSON.parse(fs.readFileSync(path, 'utf8')) as PcGamingWikiFeatures[]
}

if (process.env.PCGW_RECOVERY_REPORT === '1') {
  reportProductionFeatureRecovery(process.env).then(
    (report) => {
      console.log(report)
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : 'feature cache read failed')
      process.exitCode = 1
    },
  )
}
