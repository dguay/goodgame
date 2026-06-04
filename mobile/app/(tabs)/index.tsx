import { useState, useCallback, useMemo } from 'react'
import { ScrollView, RefreshControl, FlatList, View, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Text } from '@/components/ui/Text'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { RawgFooter } from '@/components/RawgFooter'
import { SmallGameCard } from '@/components/GameDisplayCards'
import { NextGameChooser } from '@/components/NextGameChooser'
import { GamingNews } from '@/components/GamingNews'
import { TrendingGamesNews } from '@/components/TrendingGamesNews'
import { ArpgEvents } from '@/components/ArpgEvents'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { useLibraryEntries } from '@/hooks/useLibrary'
import { useProfile } from '@/hooks/useProfile'
import { useReleasePreview } from '@/hooks/useRawg'
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants'
import { isKnownReleased, isKnownUpcomingRelease } from '@/lib/releaseDates'
import { STATUS_COLORS, type LibraryStatus } from '@/types'
import type { LibraryEntry } from '@/types/database'
import type { RawgGame } from '@/types/rawg'
const CARD_WIDTH = 160
const LIBRARY_RELEASE_CARD_HEIGHT = 190

type HeroStatTone = 'library' | 'wanted' | 'playing' | 'done'
type HeroStatFilter = LibraryStatus | 'all'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function SectionHeader({
  title,
  meta,
  onSeeAll,
}: {
  title: string
  meta?: string
  onSeeAll?: () => void
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="body" style={styles.sectionTitle} numberOfLines={1}>
        {title}
      </Text>
      {onSeeAll != null && (
        <Pressable onPress={onSeeAll}>
          <Text variant="caption" color={Colors.primary} style={styles.sectionAction}>
            See all
          </Text>
        </Pressable>
      )}
      {onSeeAll == null && meta != null && (
        <Text
          variant="caption"
          color={Colors.textMuted}
          style={styles.sectionMeta}
          numberOfLines={1}
        >
          {meta}
        </Text>
      )}
    </View>
  )
}

function HorizontalSkeletons({ height = 220 }: { height?: number }) {
  return (
    <View style={styles.skeletonRow}>
      {[1, 2, 3].map((i) => (
        <SkeletonLoader key={i} width={CARD_WIDTH} height={height} borderRadius={10} />
      ))}
    </View>
  )
}

function ItemSeparator() {
  return <View style={styles.itemSeparator} />
}

function HeroHeaderSkeleton() {
  return (
    <View style={styles.heroHeaderSkeleton}>
      <SkeletonLoader width={112} height={16} borderRadius={Radius.xs} />
      <SkeletonLoader width={220} height={34} borderRadius={Radius.sm} />
    </View>
  )
}

function HeroStatsSkeleton() {
  return (
    <View style={styles.heroStatsGrid}>
      {[1, 2, 3, 4].map((i) => (
        <SkeletonLoader key={i} width="48%" height={64} borderRadius={Radius.md} />
      ))}
    </View>
  )
}

function CurrentlyPlayingSkeleton() {
  return <SkeletonLoader width="80%" height={22} borderRadius={Radius.xs} />
}

function HeroStatPill({
  value,
  label,
  tone,
  filter,
}: {
  value: number
  label: string
  tone: HeroStatTone
  filter: HeroStatFilter
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Show ${label} in library`}
      style={({ pressed }) => [
        styles.heroStatPill,
        heroStatToneStyles[tone],
        pressed && styles.heroStatPillPressed,
      ]}
      onPress={() =>
        router.push({
          pathname: '/(tabs)/library',
          params: { filter },
        })
      }
    >
      <Text variant="mono" style={styles.heroStatValue}>
        {value}
      </Text>
      <Text variant="label" style={styles.heroStatLabel}>
        {label}
      </Text>
    </Pressable>
  )
}

function HomeHero({
  displayName,
  isHeaderLoading,
  isCurrentlyPlayingLoading,
  isStatsLoading,
  totalGames,
  wantedCount,
  playingEntries,
  completedCount,
}: {
  displayName: string
  isHeaderLoading: boolean
  isCurrentlyPlayingLoading: boolean
  isStatsLoading: boolean
  totalGames: number
  wantedCount: number
  playingEntries: LibraryEntry[]
  completedCount: number
}) {
  const featuredEntry = playingEntries[0] ?? null
  const heroArtworkLabel = featuredEntry != null ? `Open ${featuredEntry.game_title}` : 'Find games'
  const primaryAction = () => {
    if (featuredEntry != null) {
      router.push(`/game/${featuredEntry.rawg_game_id}`)
      return
    }

    router.push('/search')
  }

  return (
    <View style={styles.hero}>
      <View style={styles.heroCopy}>
        {isHeaderLoading ? (
          <HeroHeaderSkeleton />
        ) : (
          <>
            <Text variant="label" style={styles.heroEyebrow}>
              {getGreeting()}
            </Text>
            <Text variant="heading" style={styles.heroTitle} numberOfLines={2}>
              {displayName}
            </Text>
          </>
        )}
        {isCurrentlyPlayingLoading ? (
          <CurrentlyPlayingSkeleton />
        ) : (
          <Text variant="body" style={styles.heroSubtitle} numberOfLines={2}>
            {featuredEntry != null
              ? `Currently playing ${featuredEntry.game_title}`
              : 'What are we playing next?'}
          </Text>
        )}
      </View>

      <View style={styles.heroBody}>
        {isCurrentlyPlayingLoading ? (
          <SkeletonLoader width="100%" height={220} borderRadius={Radius.lg} />
        ) : (
          <Pressable
            style={styles.heroArtwork}
            onPress={primaryAction}
            accessibilityRole="button"
            accessibilityLabel={heroArtworkLabel}
          >
            {featuredEntry?.game_cover_url != null ? (
              <Image
                source={{ uri: featuredEntry.game_cover_url }}
                style={styles.heroCover}
                contentFit="cover"
                transition={200}
                cachePolicy="disk"
              />
            ) : (
              <View style={styles.heroCoverPlaceholder}>
                <Text variant="label" color={Colors.textMuted}>
                  Goodgame
                </Text>
              </View>
            )}
          </Pressable>
        )}

        {isStatsLoading ? (
          <HeroStatsSkeleton />
        ) : (
          <View style={styles.heroStatsGrid}>
            <HeroStatPill value={totalGames} label="Games" tone="library" filter="all" />
            <HeroStatPill value={wantedCount} label="TBP" tone="wanted" filter="want_to_play" />
            <HeroStatPill
              value={playingEntries.length}
              label="Playing"
              tone="playing"
              filter="playing"
            />
            <HeroStatPill value={completedCount} label="Done" tone="done" filter="done" />
          </View>
        )}
      </View>
    </View>
  )
}

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user)
  const isAuthLoading = useAuthStore((s) => s.isLoading)
  const [refreshing, setRefreshing] = useState(false)
  const queryClient = useQueryClient()

  const profileQuery = useProfile()
  const libraryQuery = useLibraryEntries()
  const newReleasesQuery = useReleasePreview('new')
  const comingUpQuery = useReleasePreview('upcoming')

  const entries = useMemo(() => libraryQuery.data ?? [], [libraryQuery.data])
  const libraryStats = useMemo(() => {
    const playing = entries.filter((e) => e.status === 'playing')
    const upcoming = entries
      .filter((e) => isKnownUpcomingRelease(e.release_date))
      .sort((a, b) => String(a.release_date).localeCompare(String(b.release_date)))

    return {
      totalGames: entries.length,
      playingEntries: playing,
      upcomingLibraryEntries: upcoming,
      releasedTbpEntries: entries.filter(
        (entry) => entry.status === 'want_to_play' && isKnownReleased(entry.release_date)
      ),
      wantedCount: entries.filter((e) => e.status === 'want_to_play').length,
      completedCount: entries.filter((e) => e.status === 'done').length,
    }
  }, [entries])
  const resolvedDisplayName =
    profileQuery.data?.display_name ??
    (user?.user_metadata?.['full_name'] as string | undefined) ??
    user?.email?.split('@')[0]
  const isHeaderLoading =
    isAuthLoading || (user != null && profileQuery.isLoading && profileQuery.data == null)
  const isLibraryLoading =
    isAuthLoading || (user != null && libraryQuery.isLoading && libraryQuery.data == null)
  const displayName = resolvedDisplayName ?? 'there'

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        profileQuery.refetch(),
        libraryQuery.refetch(),
        newReleasesQuery.refetch(),
        comingUpQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ['news'] }),
        queryClient.invalidateQueries({ queryKey: ['news-clusters'] }),
        queryClient.invalidateQueries({ queryKey: ['trending-games'] }),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [profileQuery, libraryQuery, newReleasesQuery, comingUpQuery, queryClient])

  const renderUpcomingLibraryItem = useCallback(
    ({ item }: { item: LibraryEntry }) => (
      <SmallGameCard entry={item} releaseDateFormat="date" style={styles.releaseCard} />
    ),
    []
  )
  const renderRawgReleaseItem = useCallback(
    ({ item }: { item: RawgGame }) => (
      <SmallGameCard game={item} releaseDateFormat="date" style={styles.releaseCard} />
    ),
    []
  )
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
        <HomeHero
          displayName={displayName}
          isHeaderLoading={isHeaderLoading}
          isCurrentlyPlayingLoading={isLibraryLoading}
          isStatsLoading={isLibraryLoading}
          totalGames={libraryStats.totalGames}
          wantedCount={libraryStats.wantedCount}
          playingEntries={libraryStats.playingEntries}
          completedCount={libraryStats.completedCount}
        />

        <NextGameChooser
          candidates={libraryStats.releasedTbpEntries}
          isLoading={isLibraryLoading}
        />

        {/* Your Upcoming Games */}
        <View style={styles.section}>
          <SectionHeader
            title="Your upcoming games"
            onSeeAll={() =>
              router.push({
                pathname: '/release-calendar',
                params: { mode: 'upcoming', source: 'library' },
              })
            }
          />
          {isLibraryLoading ? (
            <HorizontalSkeletons height={LIBRARY_RELEASE_CARD_HEIGHT} />
          ) : libraryStats.upcomingLibraryEntries.length > 0 ? (
            <FlatList<LibraryEntry>
              data={libraryStats.upcomingLibraryEntries.slice(0, 10)}
              keyExtractor={(item) => item.id}
              renderItem={renderUpcomingLibraryItem}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              ItemSeparatorComponent={ItemSeparator}
            />
          ) : (
            <Text variant="caption" style={styles.sectionEmpty}>
              No upcoming releases in your library.
            </Text>
          )}
        </View>

        {/* New Releases */}
        <View style={styles.section}>
          <SectionHeader
            title="New Releases"
            onSeeAll={() =>
              router.push({
                pathname: '/release-calendar',
                params: { mode: 'new' },
              })
            }
          />
          {newReleasesQuery.isLoading ? (
            <HorizontalSkeletons />
          ) : (
            <FlatList<RawgGame>
              data={newReleasesQuery.data?.results ?? []}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderRawgReleaseItem}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              ItemSeparatorComponent={ItemSeparator}
            />
          )}
        </View>

        {/* Coming Up */}
        <View style={styles.section}>
          <SectionHeader
            title="Coming Up"
            onSeeAll={() =>
              router.push({
                pathname: '/release-calendar',
                params: { mode: 'upcoming' },
              })
            }
          />
          {comingUpQuery.isLoading ? (
            <HorizontalSkeletons />
          ) : (
            <FlatList<RawgGame>
              data={comingUpQuery.data?.results ?? []}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderRawgReleaseItem}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              ItemSeparatorComponent={ItemSeparator}
            />
          )}
        </View>

        <ArpgEvents />

        <TrendingGamesNews />

        <GamingNews />

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
  hero: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  heroCopy: {
    maxWidth: 520,
    marginBottom: Spacing.lg,
  },
  heroHeaderSkeleton: {
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  heroEyebrow: {
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  heroTitle: {
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    maxWidth: 340,
    color: Colors.textSecondary,
  },
  heroBody: {
    alignItems: 'stretch',
    gap: Spacing.md,
  },
  heroArtwork: {
    width: '100%',
    height: 220,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroCover: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surfaceRaised,
  },
  heroCoverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
  },
  heroStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  heroStatPill: {
    width: '48%',
    minHeight: 64,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  heroStatPillPressed: {
    backgroundColor: Colors.surface,
  },
  heroStatValue: {
    marginBottom: 2,
    fontSize: FontSize.xl,
    lineHeight: FontSize.xl * 1.2,
  },
  heroStatLabel: {
    color: Colors.textMuted,
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
  sectionTitle: {
    flex: 1,
    fontFamily: FontFamily.semibold,
    lineHeight: FontSize.md * 1.3,
    marginRight: Spacing.sm,
  },
  sectionAction: {
    fontFamily: FontFamily.medium,
  },
  sectionMeta: {
    flexShrink: 0,
    fontFamily: FontFamily.medium,
  },
  horizontalList: {
    paddingHorizontal: Spacing.md,
  },
  releaseCard: {
    width: CARD_WIDTH,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  itemSeparator: {
    width: Spacing.sm,
  },
  sectionEmpty: {
    color: Colors.textMuted,
    paddingHorizontal: Spacing.md,
  },
})

const heroStatToneStyles = StyleSheet.create({
  library: {
    borderColor: Colors.border,
  },
  wanted: {
    borderColor: STATUS_COLORS.want_to_play,
  },
  playing: {
    borderColor: Colors.success,
  },
  done: {
    borderColor: Colors.warning,
  },
})
