import type { PcgwSupportState } from '@/lib/pcgamingwiki'

const FEATURE_SUPPORT_LABELS: Record<PcgwSupportState, string> = {
  'always on': 'Always on',
  false: 'Unsupported',
  hackable: 'Hackable',
  limited: 'Limited',
  true: 'Supported',
  unknown: 'Unknown',
}

export function pcFeatureSupportLabel(state: PcgwSupportState | null): string {
  return state == null ? 'Not documented' : FEATURE_SUPPORT_LABELS[state]
}

export interface PcFeaturesVisibilityInput {
  controllerSupport: PcgwSupportState | null
  fourKUltraHd: PcgwSupportState | null
  isError: boolean
  isLoading: boolean
  officialDiscordUrl: string | null
  oneTwentyFps: PcgwSupportState | null
  perspectives: readonly string[]
  sixtyFps: PcgwSupportState | null
  steamAppId: number | null
  steamLoading: boolean
  ultrawidescreen: PcgwSupportState | null
  xboxGamePass: PcgwSupportState | null
}

export function shouldShowPcFeaturesSection(input: PcFeaturesVisibilityInput): boolean {
  if (input.isError) return true
  return !(
    input.steamAppId == null &&
    !input.steamLoading &&
    !input.isLoading &&
    input.sixtyFps == null &&
    input.oneTwentyFps == null &&
    input.fourKUltraHd == null &&
    input.ultrawidescreen == null &&
    input.controllerSupport == null &&
    input.perspectives.length === 0 &&
    input.officialDiscordUrl == null &&
    input.xboxGamePass == null
  )
}
