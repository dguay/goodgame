import {
  credentialsFromEnv,
  lookupFeaturesBySteamAppId,
  type PcgwFeatureResult,
} from '../supabase/functions/pcgamingwiki-features/lookup.ts'

const ELDEN_RING_STEAM_APP_ID = 1245620

function documentedFeatureCount(result: PcgwFeatureResult): number {
  const states = [
    result.controllerSupport,
    result.fourKUltraHd,
    result.oneTwentyFps,
    result.sixtyFps,
    result.ultrawidescreen,
    result.xboxGamePass,
  ]
  return states.filter((state) => state != null).length + result.perspectives.length
}

let credentials: ReturnType<typeof credentialsFromEnv>
try {
  credentials = credentialsFromEnv(Deno.env)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  Deno.exit(1)
}

const result = await lookupFeaturesBySteamAppId(ELDEN_RING_STEAM_APP_ID, { credentials })
if (result?.pageName == null || documentedFeatureCount(result) < 1) {
  console.error('Elden Ring lookup did not return a page name and a documented PC feature')
  Deno.exit(1)
}

console.log(JSON.stringify({
  steamAppId: ELDEN_RING_STEAM_APP_ID,
  pageName: result.pageName,
  pageId: result.pageId,
  documentedFeatures: documentedFeatureCount(result),
}))
