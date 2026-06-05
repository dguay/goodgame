import { useCallback } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { Text } from '@/components/ui/Text'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { useArpgTimeline, type ArpgEvent, type ArpgEventType } from '@/hooks/useArpgTimeline'
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants'

const EVENT_TYPE_COLORS: Record<ArpgEventType, string> = {
  Demo: Colors.primary,
  Season: Colors.success,
  Alpha: Colors.rawg,
  Beta: Colors.rawg,
  Launch: Colors.warning,
  Event: Colors.textMuted,
}

function formatEventDatetime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date)
}

function EventCard({ event }: { event: ArpgEvent }) {
  const handlePress = useCallback(() => {
    if (event.gameUrl != null) {
      void WebBrowser.openBrowserAsync(event.gameUrl).catch(() => {})
    }
  }, [event.gameUrl])

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && event.gameUrl != null && styles.cardPressed]}
      onPress={event.gameUrl != null ? handlePress : undefined}
      accessibilityRole={event.gameUrl != null ? 'button' : 'none'}
      accessibilityLabel={event.gameUrl != null ? `Open ${event.game}` : undefined}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardTop}>
          <View style={[styles.typeBadge, { borderColor: EVENT_TYPE_COLORS[event.eventType] }]}>
            <Text
              variant="caption"
              style={[styles.typeBadgeText, { color: EVENT_TYPE_COLORS[event.eventType] }]}
            >
              {event.eventType}
            </Text>
          </View>
          {event.gameUrl != null && (
            <Ionicons name="open-outline" size={14} color={Colors.textMuted} />
          )}
        </View>
        <Text variant="body" style={styles.gameName} numberOfLines={2}>
          {event.game}
        </Text>
        {event.eventName.length > 0 && (
          <Text variant="label" color={Colors.textSecondary} numberOfLines={1}>
            {event.eventName}
          </Text>
        )}
        <Text variant="caption" color={Colors.textMuted} style={styles.date}>
          {formatEventDatetime(event.startDate)}
        </Text>
      </View>
    </Pressable>
  )
}

function EventSkeletons() {
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: 4 }, (_, i) => (
        <View key={i} style={styles.skeletonCard}>
          <SkeletonLoader width={60} height={22} borderRadius={Radius.xs} />
          <SkeletonLoader width="70%" height={16} borderRadius={Radius.xs} />
          <SkeletonLoader width="45%" height={13} borderRadius={Radius.xs} />
          <SkeletonLoader width="55%" height={12} borderRadius={Radius.xs} />
        </View>
      ))}
    </View>
  )
}

export default function ArpgEventsScreen() {
  const query = useArpgTimeline()
  const events = query.data?.events ?? []
  const feedLastModified = query.data?.feedLastModified ?? null

  const subtitle =
    feedLastModified != null
      ? `Updated ${formatEventDatetime(feedLastModified)}`
      : 'Upcoming ARPG events'

  const renderItem = useCallback(({ item }: { item: ArpgEvent }) => <EventCard event={item} />, [])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text variant="heading" style={styles.title}>
            ARPG Events
          </Text>
          <Text variant="caption" style={styles.subtitle}>
            {subtitle}
          </Text>
        </View>
      </View>

      {query.isLoading ? (
        <View style={styles.loadingContent}>
          <EventSkeletons />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.emptyContent}>
          <EmptyState
            icon="calendar-outline"
            heading="No upcoming events"
            subtext="No ARPG events found in the feed."
          />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            <View>
              <Text variant="caption" color={Colors.textMuted} style={styles.attribution}>
                Events from arpg-timeline.com
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    lineHeight: FontSize.xxl * 1.1,
  },
  subtitle: {
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardPressed: {
    backgroundColor: Colors.surfaceRaised,
  },
  cardContent: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xxs,
  },
  typeBadge: {
    borderWidth: 1,
    borderRadius: Radius.xs,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xxs,
    letterSpacing: 0.5,
  },
  gameName: {
    fontFamily: FontFamily.semibold,
    color: Colors.textPrimary,
  },
  date: {
    marginTop: Spacing.xxs,
  },
  attribution: {
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  skeletonContainer: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  skeletonCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  loadingContent: {
    flex: 1,
  },
  emptyContent: {
    flex: 1,
  },
})
