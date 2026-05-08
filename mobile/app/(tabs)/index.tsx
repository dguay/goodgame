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
import { useProfile } from '@/hooks/useProfile'
import { useNewReleases, useTopRated } from '@/hooks/useRawg'
import { useRecommendations } from '@/hooks/useRecommendations'
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants'
import { STATUS_COLORS, type LibraryStatus } from '@/types'
import type { LibraryEntry } from '@/types/database'
import type { RawgGame } from '@/types/rawg'

const CARD_WIDTH = 160
type HeroStatTone = 'library' | 'wanted' | 'playing' | 'done'
type HeroStatFilter = LibraryStatus | 'all'

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
        <Text variant="caption" numberOfLines={2} style={styles.libraryCardTitle}>
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
      <Text variant="body" style={styles.sectionTitle}>{title}</Text>
      {onSeeAll != null && (
        <Pressable onPress={onSeeAll}>
          <Text variant="caption" color={Colors.primary} style={styles.sectionAction}>
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
      onPress={() => router.push({
        pathname: '/(tabs)/library',
        params: { filter },
      })}
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
  totalGames,
  wantedCount,
  playingEntries,
  completedCount,
}: {
  displayName: string
  totalGames: number
  wantedCount: number
  playingEntries: LibraryEntry[]
  completedCount: number
}) {
  const featuredEntry = playingEntries[0] ?? null
  const heroArtworkLabel =
    featuredEntry != null ? `Open ${featuredEntry.game_title}` : 'Find games'
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
        <Text variant="label" style={styles.heroEyebrow}>
          {getGreeting()}
        </Text>
        <Text variant="heading" style={styles.heroTitle} numberOfLines={2}>
          {displayName}
        </Text>
        <Text variant="body" style={styles.heroSubtitle} numberOfLines={2}>
          {featuredEntry != null
            ? `Currently playing ${featuredEntry.game_title}`
            : 'Choose what belongs in your backlog next.'}
        </Text>
      </View>

      <View style={styles.heroBody}>
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

        <View style={styles.heroStatsGrid}>
          <HeroStatPill value={totalGames} label="Games" tone="library" filter="all" />
          <HeroStatPill
            value={wantedCount}
            label="TBP"
            tone="wanted"
            filter="want_to_play"
          />
          <HeroStatPill
            value={playingEntries.length}
            label="Playing"
            tone="playing"
            filter="playing"
          />
          <HeroStatPill value={completedCount} label="Done" tone="done" filter="done" />
        </View>
      </View>
    </View>
  )
}

export default function HomeScreen() {
  const user = useAuthStore(s => s.user)
  const [refreshing, setRefreshing] = useState(false)

  const profileQuery = useProfile()
  const libraryQuery = useLibraryEntries()
  const newReleasesQuery = useNewReleases()
  const topRatedQuery = useTopRated()
  const { data: recommendations, isLoading: isRecommendationsLoading, hasEnoughData } =
    useRecommendations()

  const entries = libraryQuery.data ?? []
  const totalGames = entries.length
  const playingEntries = entries.filter(e => e.status === 'playing')
  const wantedCount = entries.filter(e => e.status === 'want_to_play').length
  const completedCount = entries.filter(e => e.status === 'done').length
  const recentlyAdded = entries.slice(0, 5)

  const displayName =
    profileQuery.data?.display_name ??
    (user?.user_metadata?.['full_name'] as string | undefined) ??
    user?.email?.split('@')[0] ??
    'there'

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        profileQuery.refetch(),
        libraryQuery.refetch(),
        newReleasesQuery.refetch(),
        topRatedQuery.refetch(),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [profileQuery, libraryQuery, newReleasesQuery, topRatedQuery])

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
        <HomeHero
          displayName={displayName}
          totalGames={totalGames}
          wantedCount={wantedCount}
          playingEntries={playingEntries}
          completedCount={completedCount}
        />

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
    fontFamily: FontFamily.semibold,
    lineHeight: FontSize.md * 1.3,
  },
  sectionAction: {
    fontFamily: FontFamily.medium,
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
  libraryCardTitle: {
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
    lineHeight: 18,
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
