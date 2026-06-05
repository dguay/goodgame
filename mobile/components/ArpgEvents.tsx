import { View, StyleSheet, Pressable } from 'react-native'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { Text } from '@/components/ui/Text'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { useArpgTimeline, type ArpgEvent, type ArpgEventType } from '@/hooks/useArpgTimeline'
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants'

const PREVIEW_COUNT = 10

const EVENT_TYPE_COLORS: Record<ArpgEventType, string> = {
  Demo: Colors.primary,
  Season: Colors.success,
  Alpha: Colors.rawg,
  Beta: Colors.rawg,
  Launch: Colors.warning,
  Event: Colors.textMuted,
}

function formatEventDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function EventRow({ event }: { event: ArpgEvent }) {
  const handlePress = () => {
    if (event.gameUrl != null) {
      void WebBrowser.openBrowserAsync(event.gameUrl).catch(() => {})
    } else {
      router.push('/arpg-events')
    }
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={event.game}
    >
      <View style={styles.rowContent}>
        <Text variant="label" style={styles.game} numberOfLines={1}>
          {event.game}
        </Text>
        {event.eventName.length > 0 && (
          <Text variant="caption" color={Colors.textSecondary} numberOfLines={1}>
            {event.eventName}
          </Text>
        )}
      </View>
      <View style={styles.rowMeta}>
        <Text
          variant="caption"
          style={[styles.type, { color: EVENT_TYPE_COLORS[event.eventType] }]}
        >
          {event.eventType}
        </Text>
        <Text variant="caption" color={Colors.textMuted}>
          {formatEventDate(event.startDate)}
        </Text>
      </View>
    </Pressable>
  )
}

function EventSkeletons() {
  return (
    <View style={styles.skeletons}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={styles.skeletonLeft}>
            <SkeletonLoader width="60%" height={14} borderRadius={Radius.xs} />
            <SkeletonLoader width="40%" height={11} borderRadius={Radius.xs} />
          </View>
          <SkeletonLoader width={100} height={11} borderRadius={Radius.xs} />
        </View>
      ))}
    </View>
  )
}

export function ArpgEvents() {
  const query = useArpgTimeline()
  const preview = (query.data?.events ?? []).slice(0, PREVIEW_COUNT)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="body" style={styles.title}>
          ARPG Events
        </Text>
        <Pressable onPress={() => router.push('/arpg-events')}>
          <Text variant="caption" color={Colors.primary} style={styles.seeAll}>
            See all
          </Text>
        </Pressable>
      </View>
      {query.isLoading ? (
        <EventSkeletons />
      ) : preview.length > 0 ? (
        <View style={styles.list}>
          {preview.map((event) => (
            <EventRow key={event.uid} event={event} />
          ))}
        </View>
      ) : (
        <Text variant="caption" color={Colors.textMuted} style={styles.empty}>
          No upcoming ARPG events.
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  title: {
    fontFamily: FontFamily.semibold,
    lineHeight: FontSize.md * 1.3,
  },
  seeAll: {
    fontFamily: FontFamily.medium,
  },
  list: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  row: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowPressed: {
    backgroundColor: Colors.surfaceRaised,
  },
  rowContent: {
    flex: 1,
    gap: 3,
  },
  game: {
    color: Colors.textPrimary,
    lineHeight: FontSize.sm * 1.4,
  },
  rowMeta: {
    alignItems: 'flex-end',
    gap: 3,
  },
  type: {
    fontFamily: FontFamily.medium,
  },
  skeletons: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  skeletonRow: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  skeletonLeft: {
    flex: 1,
    gap: 6,
  },
  empty: {
    paddingHorizontal: Spacing.md,
  },
})
