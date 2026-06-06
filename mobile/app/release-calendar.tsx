import { useCallback, useMemo, useRef, useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { Text } from '@/components/ui/Text'
import { EmptyState } from '@/components/ui/EmptyState'
import { RawgFooter } from '@/components/RawgFooter'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { GameListCard } from '@/components/GameDisplayCards'
import { useReleaseCalendar, type ReleaseCalendarMode } from '@/hooks/useRawg'
import { useLibraryEntries } from '@/hooks/useLibrary'
import { Colors, FontSize, Radius, Spacing } from '@/constants'
import { isKnownUpcomingRelease } from '@/lib/dates'
import type { LibraryEntry } from '@/types/database'
import type { RawgGame } from '@/types/rawg'

interface PlatformFilter {
  id: number | null
  label: string
}

const PLATFORM_FILTERS: PlatformFilter[] = [
  { id: null, label: 'ALL' },
  { id: 187, label: 'PS5' },
  { id: 4, label: 'PC' },
]

function CalendarSkeletons() {
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: 8 }, (_, index) => (
        <View key={index} style={styles.skeletonItem}>
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
  const { mode: modeParam, source: sourceParam } = useLocalSearchParams<{
    mode?: string
    source?: string
  }>()
  const mode: ReleaseCalendarMode = modeParam === 'new' ? 'new' : 'upcoming'
  const source = sourceParam === 'library' ? 'library' : 'rawg'
  const [platform, setPlatform] = useState(PLATFORM_FILTERS[0])
  const calendarQuery = useReleaseCalendar(platform.id, mode, source === 'rawg')
  const libraryQuery = useLibraryEntries(source === 'library')
  const rawgListRef = useRef<FlatList<RawgGame>>(null)
  const calendarQueryRef = useRef(calendarQuery)
  calendarQueryRef.current = calendarQuery
  const heading =
    source === 'library'
      ? 'Your Upcoming Games'
      : mode === 'new'
        ? 'New Releases'
        : 'Release Calendar'
  const subtitle =
    source === 'library'
      ? 'Upcoming games from your library'
      : mode === 'new'
        ? 'Recent games that just got released'
        : 'Upcoming games'

  const games = useMemo(
    () => calendarQuery.data?.pages.flatMap((page) => page.results) ?? [],
    [calendarQuery.data]
  )
  const libraryUpcomingEntries = useMemo(
    () =>
      (libraryQuery.data ?? [])
        .filter((entry) => isKnownUpcomingRelease(entry.release_date))
        .sort((a, b) => String(a.release_date).localeCompare(String(b.release_date))),
    [libraryQuery.data]
  )

  const handleSelectPlatform = useCallback((option: PlatformFilter) => {
    setPlatform(option)
    rawgListRef.current?.scrollToOffset({ offset: 0, animated: false })
  }, [])

  const handleLoadMore = useCallback(() => {
    const query = calendarQueryRef.current
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage()
    }
  }, [])

  const renderItem = useCallback(
    ({ item }: { item: RawgGame }) => (
      <GameListCard game={item} releaseDateFormat="date" />
    ),
    []
  )

  const renderLibraryItem = useCallback(
    ({ item }: { item: LibraryEntry }) => <GameListCard entry={item} releaseDateFormat="date" />,
    []
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
            {heading}
          </Text>
          <Text variant="caption" style={styles.subtitle}>
            {subtitle}
          </Text>
        </View>
      </View>

      {source === 'rawg' && (
        <View style={styles.filterRow}>
          {PLATFORM_FILTERS.map((option) => {
            const isSelected = option.id === platform.id
            return (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                onPress={() => handleSelectPlatform(option)}
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
      )}

      {source === 'library' ? (
        libraryQuery.isLoading ? (
          <View style={styles.loadingContent}>
            <CalendarSkeletons />
            <RawgFooter />
          </View>
        ) : libraryUpcomingEntries.length === 0 ? (
          <View style={styles.emptyContent}>
            <EmptyState
              icon="calendar-outline"
              heading="No upcoming releases"
              subtext="Your library does not have any games with future release dates."
            />
            <RawgFooter />
          </View>
        ) : (
          <FlatList
            data={libraryUpcomingEntries}
            keyExtractor={(item) => item.id}
            renderItem={renderLibraryItem}
            contentContainerStyle={styles.listContent}
            ListFooterComponent={<RawgFooter />}
          />
        )
      ) : calendarQuery.isLoading ? (
        <View style={styles.loadingContent}>
          <CalendarSkeletons />
          <RawgFooter />
        </View>
      ) : games.length === 0 ? (
        <View style={styles.emptyContent}>
          <EmptyState
            icon="calendar-outline"
            heading="No releases found"
            subtext={`RAWG does not have ${mode === 'new' ? 'recent' : 'upcoming'} ${
              platform.id === null ? 'game' : platform.label
            } releases for this range.`}
          />
          <RawgFooter />
        </View>
      ) : (
        <FlatList
          ref={rawgListRef}
          data={games}
          keyExtractor={(item) => String(item.id)}
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
