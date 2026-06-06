import { useCallback } from 'react'
import { FlatList, View, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router, Stack } from 'expo-router'
import { Text } from '@/components/ui/Text'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { EmptyState } from '@/components/ui/EmptyState'
import { useTrendingGames, type TrendingGame } from '@/hooks/useTrendingGames'
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants'
import { formatUpdatedTimestamp, getLatestTimestamp } from '@/lib/dates'

function TrendingGameRow({ game, rank }: { game: TrendingGame; rank: number }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => router.push(`/news/game/${game.slug}`)}
      accessibilityRole="button"
      accessibilityLabel={game.name}
    >
      <Text variant="mono" style={styles.rank} numberOfLines={1}>
        {rank}
      </Text>
      <View style={styles.artwork}>
        {game.imageUrl != null ? (
          <Image
            source={{ uri: game.imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={150}
            cachePolicy="disk"
          />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}
      </View>
      <View style={styles.info}>
        <Text variant="body" style={styles.gameName} numberOfLines={2}>
          {game.name}
        </Text>
        <View style={styles.stats}>
          <Text variant="caption" color={Colors.textMuted}>
            {game.mentions72h} articles
          </Text>
          <Text variant="caption" color={Colors.textMuted}>·</Text>
          <Text variant="caption" color={Colors.textMuted}>
            {game.uniqueSources72h} {game.uniqueSources72h === 1 ? 'source' : 'sources'}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </Pressable>
  )
}

function RowSkeletons() {
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: 10 }, (_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <SkeletonLoader width={24} height={20} borderRadius={Radius.xs} />
          <SkeletonLoader width={48} height={48} borderRadius={Radius.sm} />
          <View style={styles.skeletonText}>
            <SkeletonLoader width="60%" height={14} borderRadius={Radius.xs} />
            <SkeletonLoader width="35%" height={12} borderRadius={Radius.xs} />
          </View>
        </View>
      ))}
    </View>
  )
}

export default function TrendingGamesScreen() {
  const query = useTrendingGames(25)
  const updatedTimestamp = formatUpdatedTimestamp(
    getLatestTimestamp(query.data?.map((game) => game.calculatedAt) ?? [])
  )

  const renderItem = useCallback(
    ({ item, index }: { item: TrendingGame; index: number }) => (
      <TrendingGameRow game={item} rank={index + 1} />
    ),
    []
  )

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
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
            Trending Games
          </Text>
          <Text variant="caption" style={styles.subtitle}>
            {updatedTimestamp === '' ? 'Most covered in the last 72 hours' : `Most covered in the last 72 hours · ${updatedTimestamp}`}
          </Text>
        </View>
      </View>

      {query.isLoading ? (
        <RowSkeletons />
      ) : query.data == null || query.data.length === 0 ? (
        <EmptyState
          icon="trending-up-outline"
          heading="No trending games"
          subtext="Trending data will appear once articles are ingested."
        />
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    paddingBottom: Spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  rowPressed: {
    backgroundColor: Colors.surfaceRaised,
  },
  rank: {
    width: 24,
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: Colors.surfaceRaised,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  gameName: {
    fontFamily: FontFamily.semibold,
    color: Colors.textPrimary,
    lineHeight: FontSize.md * 1.2,
  },
  stats: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  skeletonContainer: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  skeletonText: {
    flex: 1,
    gap: 6,
  },
})
