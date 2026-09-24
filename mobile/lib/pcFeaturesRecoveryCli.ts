import { featureRecoveryCounts, formatFeatureRecoveryReport } from './pcFeaturesRecovery'
import type { PcGamingWikiFeatures } from '../types/database'

declare const process: {
  env: Record<string, string | undefined>
  exitCode?: number
}

// Prints affected, preserved, refreshed, and still-failing counts.
// Refreshed and still-failing stay zero until a recovered row is opened again.
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
  const rows = (await response.json()) as PcGamingWikiFeatures[]
  return formatFeatureRecoveryReport(featureRecoveryCounts(rows))
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
