import { useCallback, useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Text } from '@/components/ui/Text'
import { EmptyState } from '@/components/ui/EmptyState'
import { RawgFooter } from '@/components/RawgFooter'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { AddToLibraryButton } from '@/components/AddToLibraryButton'
import { useReleaseCalendar } from '@/hooks/useRawg'
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants'
import type { RawgGame } from '@/types/rawg'

interface PlatformFilter {
  id: number
  label: string
}

const PLATFORM_FILTERS: PlatformFilter[] = [
  { id: 187, label: 'PS5' },
  { id: 4, label: 'PC' },
]

function formatReleaseDate(date: string | null): string {
  if (date == null) return 'Date TBA'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

function getPlatformLabels(game: RawgGame): string {
  return (game.platforms ?? [])
    .map(entry => entry.platform.name)
    .slice(0, 3)
    .join(' / ')
}

function ReleaseCalendarItem({ game }: { game: RawgGame }) {
  const platforms = getPlatformLabels(game)

  return (
    <Pressable
      style={styles.releaseItem}
      onPress={() => router.push(`/game/${game.id}`)}
    >
      <View style={styles.dateRail}>
        <Text variant="label" style={styles.dateLabel}>
          {formatReleaseDate(game.released)}
        </Text>
      </View>
      <Image
        source={game.background_image != null ? { uri: game.background_image } : null}
        style={styles.cover}
        contentFit="cover"
        transition={200}
        cachePolicy="disk"
      />
      <View style={styles.releaseInfo}>
        <Text variant="body" numberOfLines={2} style={styles.releaseTitle}>
          {game.name}
        </Text>
        {platforms.length > 0 && (
          <Text variant="caption" numberOfLines={1} style={styles.platformText}>
            {platforms}
          </Text>
        )}
        <AddToLibraryButton game={game} />
      </View>
    </Pressable>
  )
}

function CalendarSkeletons() {
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: 8 }, (_, index) => (
        <View key={index} style={styles.skeletonItem}>
          <SkeletonLoader width={82} height={14} borderRadius={Radius.xs} />
          <SkeletonLoader width={72} height={96} borderRadius={Radius.sm} />
          <View style={styles.skeletonInfo}>
            <SkeletonLoader height={16} />
            <SkeletonLoader height={12} width="58%" />
            <SkeletonLoader height={30} width={132} borderRadius={Radius.pill} />
          </View>
        </View>
      ))}
    </View>
  )
}

export default function ReleaseCalendarScreen() {
  const [platform, setPlatform] = useState(PLATFORM_FILTERS[0])
  const calendarQuery = useReleaseCalendar(platform.id)

  const games = useMemo(
    () => calendarQuery.data?.pages.flatMap(page => page.results) ?? [],
    [calendarQuery.data],
  )

  const handleLoadMore = useCallback(() => {
    if (calendarQuery.hasNextPage && !calendarQuery.isFetchingNextPage) {
      void calendarQuery.fetchNextPage()
    }
  }, [calendarQuery])

  const renderItem = useCallback(
    ({ item }: { item: RawgGame }) => <ReleaseCalendarItem game={item} />,
    [],
  )

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
            Release Calendar
          </Text>
          <Text variant="caption" style={styles.subtitle}>
            Upcoming games ordered by release date.
          </Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {PLATFORM_FILTERS.map(option => {
          const isSelected = option.id === platform.id
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={[styles.filterChip, isSelected && styles.filterChipSelected]}
              onPress={() => setPlatform(option)}
            >
              <Text
                variant="label"
                style={[styles.filterLabel, isSelected && styles.filterLabelSelected]}
              >
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {calendarQuery.isLoading ? (
        <View style={styles.loadingContent}>
          <CalendarSkeletons />
          <RawgFooter />
        </View>
      ) : games.length === 0 ? (
        <View style={styles.emptyContent}>
          <EmptyState
            icon="calendar-outline"
            heading="No releases found"
            subtext={`RAWG does not have upcoming ${platform.label} releases for this range.`}
          />
          <RawgFooter />
        </View>
      ) : (
        <FlatList
          data={games}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            <View>
              {calendarQuery.isFetchingNextPage && (
                <View style={styles.loadingMore}>
                  <SkeletonLoader height={72} borderRadius={Radius.md} />
                </View>
              )}
              <RawgFooter />
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
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  filterChip: {
    minWidth: 72,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterLabel: {
    color: Colors.textSecondary,
  },
  filterLabelSelected: {
    color: Colors.textPrimary,
  },
  listContent: {
    paddingBottom: Spacing.xl,
  },
  releaseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  dateRail: {
    width: 82,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  dateLabel: {
    color: Colors.textMuted,
  },
  cover: {
    width: 72,
    height: 96,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceRaised,
    flexShrink: 0,
  },
  releaseInfo: {
    flex: 1,
    minHeight: 96,
    justifyContent: 'center',
    gap: Spacing.xxs,
  },
  releaseTitle: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  platformText: {
    color: Colors.textMuted,
  },
  loadingContent: {
    flex: 1,
  },
  skeletonContainer: {
    paddingTop: Spacing.xs,
  },
  skeletonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  skeletonInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  loadingMore: {
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.md,
  },
  emptyContent: {
    flex: 1,
  },
})
