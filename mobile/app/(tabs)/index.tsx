import { useState, useCallback } from 'react'
import {
  ScrollView,
  RefreshControl,
  FlatList,
  View,
  StyleSheet,
  Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Text } from '@/components/ui/Text'
import { GameCard } from '@/components/GameCard'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { RawgFooter } from '@/components/RawgFooter'
import { useAuthStore } from '@/stores/authStore'
import { useLibraryEntries } from '@/hooks/useLibrary'
import { useNewReleases, useTopRated } from '@/hooks/useRawg'
import { useRecommendations } from '@/hooks/useRecommendations'
import { Colors, Spacing } from '@/constants'
import type { LibraryEntry } from '@/types/database'
import type { RawgGame } from '@/types/rawg'

const CARD_WIDTH = 160

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function LibraryCard({ entry }: { entry: LibraryEntry }) {
  return (
    <Pressable
      style={styles.libraryCard}
      onPress={() => router.push(`/game/${entry.rawg_game_id}`)}
    >
      <Image
        source={entry.game_cover_url != null ? { uri: entry.game_cover_url } : null}
        style={styles.libraryCardCover}
        contentFit="cover"
        transition={200}
        cachePolicy="disk"
      />
      <View style={styles.libraryCardInfo}>
        <Text variant="caption" numberOfLines={2}>
          {entry.game_title}
        </Text>
      </View>
    </Pressable>
  )
}

function SectionHeader({
  title,
  onSeeAll,
}: {
  title: string
  onSeeAll?: () => void
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="subheading">{title}</Text>
      {onSeeAll != null && (
        <Pressable onPress={onSeeAll}>
          <Text variant="caption" color={Colors.primary}>
            See all
          </Text>
        </Pressable>
      )}
    </View>
  )
}

function HorizontalSkeletons() {
  return (
    <View style={styles.skeletonRow}>
      {[1, 2, 3].map(i => (
        <SkeletonLoader key={i} width={CARD_WIDTH} height={220} borderRadius={10} />
      ))}
    </View>
  )
}

export default function HomeScreen() {
  const user = useAuthStore(s => s.user)
  const [refreshing, setRefreshing] = useState(false)

  const libraryQuery = useLibraryEntries()
  const newReleasesQuery = useNewReleases()
  const topRatedQuery = useTopRated()
  const { data: recommendations, isLoading: isRecommendationsLoading, hasEnoughData } =
    useRecommendations()

  const entries = libraryQuery.data ?? []
  const totalGames = entries.length
  const playingEntries = entries.filter(e => e.status === 'playing')
  const completedCount = entries.filter(e => e.status === 'done').length
  const recentlyAdded = entries.slice(0, 5)

  const displayName =
    (user?.user_metadata?.['full_name'] as string | undefined) ??
    user?.email?.split('@')[0] ??
    'there'

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        libraryQuery.refetch(),
        newReleasesQuery.refetch(),
        topRatedQuery.refetch(),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [libraryQuery, newReleasesQuery, topRatedQuery])

  const useRecommendationSection = hasEnoughData
  const recommendationLabel = useRecommendationSection ? 'Recommended for You' : 'Discover Games'
  const recommendationData: RawgGame[] = useRecommendationSection
    ? recommendations
    : (topRatedQuery.data?.results ?? [])
  const isRecommendationLoading = useRecommendationSection
    ? isRecommendationsLoading
    : topRatedQuery.isLoading

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text variant="heading" style={styles.greeting}>
            {getGreeting()}, {displayName} ðŸ‘¾
          </Text>
          <View style={styles.statsStrip}>
            <View style={styles.statItem}>
              <Text variant="subheading" color={Colors.primary}>
                {totalGames}
              </Text>
              <Text variant="caption">Games</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text variant="subheading" color={Colors.success}>
                {playingEntries.length}
              </Text>
              <Text variant="caption">Playing</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text variant="subheading" color={Colors.warning}>
                {completedCount}
              </Text>
              <Text variant="caption">Completed</Text>
            </View>
          </View>
        </View>

        {/* Continue Playing */}
        {playingEntries.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Continue Playing" />
            <FlatList<LibraryEntry>
              data={playingEntries}
              keyExtractor={item => item.id}
              renderItem={({ item }) => <LibraryCard entry={item} />}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
            />
          </View>
        )}

        {/* New Releases */}
        <View style={styles.section}>
          <SectionHeader title="New Releases" onSeeAll={() => router.push('/search')} />
          {newReleasesQuery.isLoading ? (
            <HorizontalSkeletons />
          ) : (
            <FlatList<RawgGame>
              data={newReleasesQuery.data?.results ?? []}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <GameCard game={item} style={{ width: CARD_WIDTH }} />
              )}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
            />
          )}
        </View>

        {/* Recommended / Discover */}
        <View style={styles.section}>
          <SectionHeader title={recommendationLabel} />
          {isRecommendationLoading ? (
            <HorizontalSkeletons />
          ) : (
            <FlatList<RawgGame>
              data={recommendationData}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <GameCard game={item} style={{ width: CARD_WIDTH }} />
              )}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
            />
          )}
        </View>

        {/* Recently Added */}
        {recentlyAdded.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Recently Added"
              onSeeAll={() => router.push('/library')}
            />
            <FlatList<LibraryEntry>
              data={recentlyAdded}
              keyExtractor={item => item.id}
              renderItem={({ item }) => <LibraryCard entry={item} />}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
            />
          </View>
        )}

        <RawgFooter />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  greeting: {
    marginBottom: Spacing.md,
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  horizontalList: {
    paddingHorizontal: Spacing.md,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  itemSeparator: {
    width: Spacing.sm,
  },
  libraryCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  libraryCardCover: {
    width: '100%',
    height: 130,
    backgroundColor: Colors.surfaceRaised,
  },
  libraryCardInfo: {
    padding: Spacing.sm,
  },
})

