import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { Text } from '@/components/ui/Text'
import { Colors, Radius, Spacing } from '@/constants'
import {
  getPcgwPageUrl,
  type PcgwSupportState,
} from '@/lib/pcgamingwiki'
import { openExternalUrl } from '@/lib/links'
import { getSteamStoreUrl } from '@/lib/steam'

const STEAM_BLUE = '#66c0f4'

const FEATURE_SUPPORT_LABELS: Record<PcgwSupportState, string> = {
  'always on': 'Always on',
  'false': 'Unsupported',
  'hackable': 'Hackable',
  'limited': 'Limited',
  'true': 'Supported',
  'unknown': 'Unknown',
}

const FEATURE_SUPPORT_COLORS: Record<PcgwSupportState, string> = {
  'always on': Colors.success,
  'false': Colors.error,
  'hackable': Colors.warning,
  'limited': Colors.warning,
  'true': Colors.success,
  'unknown': Colors.textMuted,
}

interface Props {
  controllerSupport: PcgwSupportState | null
  isError: boolean
  isLoading: boolean
  officialDiscordUrl: string | null
  oneTwentyFps: PcgwSupportState | null
  pageName: string | null
  perspectives: string[]
  sixtyFps: PcgwSupportState | null
  steamAppId: number | null
  steamLoading: boolean
  ultrawidescreen: PcgwSupportState | null
}

interface FeatureRowProps {
  color: string
  icon: keyof typeof Ionicons.glyphMap
  isError: boolean
  isLoading: boolean
  label: string
  value: string
}

function FeatureRow({ color, icon, isError, isLoading, label, value }: FeatureRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={styles.copy}>
        <Text variant="label" style={styles.label}>{label}</Text>
        <Text variant="caption" color={isError ? Colors.error : Colors.textSecondary}>
          {isLoading ? 'Checking support...' : isError ? 'Could not refresh support.' : value}
        </Text>
      </View>
    </View>
  )
}

export function PcFeaturesSection({
  controllerSupport,
  isError,
  isLoading,
  officialDiscordUrl,
  oneTwentyFps,
  pageName,
  perspectives,
  sixtyFps,
  steamAppId,
  steamLoading,
  ultrawidescreen,
}: Props) {
  if (
    steamAppId == null &&
    !steamLoading &&
    !isLoading &&
    sixtyFps == null &&
    oneTwentyFps == null &&
    ultrawidescreen == null &&
    controllerSupport == null &&
    perspectives.length === 0 &&
    officialDiscordUrl == null
  ) return null

  const pcgwUrl = pageName != null ? getPcgwPageUrl(pageName) : null
  const steamUrl = steamAppId != null ? getSteamStoreUrl(steamAppId) : null
  const perspectivesLabel = perspectives.length > 0 ? perspectives.join(', ') : 'Not documented'

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text variant="subheading" style={styles.title}>PC Features</Text>
        {pcgwUrl != null && (
          <Pressable
            onPress={() => void openExternalUrl(pcgwUrl)}
            hitSlop={8}
            style={styles.pcgwLink}
          >
            <Text variant="label" color={Colors.textMuted}>PCGamingWiki</Text>
            <Ionicons name="open-outline" size={13} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={styles.featureList}>
        <FeatureRow
          color={sixtyFps != null ? FEATURE_SUPPORT_COLORS[sixtyFps] : Colors.textMuted}
          icon="speedometer-outline"
          isError={isError}
          isLoading={isLoading}
          label="60 FPS"
          value={sixtyFps != null ? FEATURE_SUPPORT_LABELS[sixtyFps] : 'Not documented'}
        />
        <FeatureRow
          color={oneTwentyFps != null ? FEATURE_SUPPORT_COLORS[oneTwentyFps] : Colors.textMuted}
          icon="flash-outline"
          isError={isError}
          isLoading={isLoading}
          label="120 FPS"
          value={oneTwentyFps != null ? FEATURE_SUPPORT_LABELS[oneTwentyFps] : 'Not documented'}
        />
        <FeatureRow
          color={ultrawidescreen != null ? FEATURE_SUPPORT_COLORS[ultrawidescreen] : Colors.textMuted}
          icon="resize-outline"
          isError={isError}
          isLoading={isLoading}
          label="Ultrawide"
          value={ultrawidescreen != null ? FEATURE_SUPPORT_LABELS[ultrawidescreen] : 'Not documented'}
        />
        <FeatureRow
          color={controllerSupport != null ? FEATURE_SUPPORT_COLORS[controllerSupport] : Colors.textMuted}
          icon="game-controller-outline"
          isError={isError}
          isLoading={isLoading}
          label="Controller"
          value={controllerSupport != null ? FEATURE_SUPPORT_LABELS[controllerSupport] : 'Not documented'}
        />
        <FeatureRow
          color={perspectives.length > 0 ? Colors.primary : Colors.textMuted}
          icon="eye-outline"
          isError={isError}
          isLoading={isLoading}
          label="Perspectives"
          value={perspectivesLabel}
        />

        {officialDiscordUrl != null && (
          <Pressable
            style={styles.row}
            onPress={() => void openExternalUrl(officialDiscordUrl)}
          >
            <View style={styles.icon}>
              <Ionicons name="chatbubbles-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.copy}>
              <Text variant="label" style={styles.label}>Official Discord</Text>
              <Text variant="caption" color={Colors.textSecondary}>
                Open server invite
              </Text>
            </View>
          </Pressable>
        )}

        {steamUrl != null ? (
          <Pressable
            style={styles.row}
            onPress={() => void openExternalUrl(steamUrl)}
          >
            <View style={styles.icon}>
              <Ionicons name="logo-steam" size={18} color={STEAM_BLUE} />
            </View>
            <View style={styles.copy}>
              <Text variant="label" style={styles.label}>Steam</Text>
              <Text variant="caption" color={Colors.textSecondary}>
                Open store page
              </Text>
            </View>
          </Pressable>
        ) : steamLoading ? (
          <View style={styles.row}>
            <View style={styles.icon}>
              <ActivityIndicator size="small" color={STEAM_BLUE} />
            </View>
            <View style={styles.copy}>
              <Text variant="label" style={styles.label}>Steam</Text>
              <Text variant="caption" color={Colors.textSecondary}>
                Checking store availability...
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  header: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  title: {
    marginBottom: Spacing.sm,
    fontSize: 18,
  },
  pcgwLink: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featureList: {
    gap: Spacing.sm,
  },
  row: {
    maxWidth: 520,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  icon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    flexShrink: 0,
  },
  copy: {
    minWidth: 0,
    gap: 2,
  },
  label: {
    color: Colors.textPrimary,
  },
})
