import { View, StyleSheet, Pressable, FlatList } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Text } from '@/components/ui/Text'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { useTrendingGames, type TrendingGame } from '@/hooks/useTrendingGames'
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants'
import { formatUpdatedTimestamp, getLatestTimestamp } from '@/lib/dates'

const CARD_WIDTH = 120
const CARD_HEIGHT = 160

function TrendingGameCard({ game, rank }: { game: TrendingGame; rank: number }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push(`/news/game/${game.slug}`)}
      accessibilityRole="button"
      accessibilityLabel={game.name}
    >
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
        <View style={styles.rankBadge}>
          <Text variant="caption" style={styles.rankText}>
            #{rank}
          </Text>
        </View>
      </View>
      <Text variant="caption" style={styles.gameName} numberOfLines={2}>
        {game.name}
      </Text>
      <Text variant="caption" color={Colors.textMuted} style={styles.mentions}>
        {game.mentions72h} articles
      </Text>
    </Pressable>
  )
}

function TrendingSkeletons() {
  return (
    <View style={styles.skeletonRow}>
      {[1, 2, 3].map((i) => (
        <SkeletonLoader key={i} width={CARD_WIDTH} height={CARD_HEIGHT} borderRadius={Radius.md} />
      ))}
    </View>
  )
}

function ItemSeparator() {
  return <View style={styles.separator} />
}

export function TrendingGamesNews() {
  const query = useTrendingGames(10)
  const updatedTimestamp = formatUpdatedTimestamp(
    getLatestTimestamp(query.data?.map((game) => game.calculatedAt) ?? [])
  )

  if (!query.isLoading && (query.data == null || query.data.length === 0)) {
    return null
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text variant="body" style={styles.sectionTitle}>
            Trending Games
          </Text>
          {updatedTimestamp !== '' && (
            <Text variant="caption" color={Colors.textMuted} style={styles.updatedAt}>
              {updatedTimestamp}
            </Text>
          )}
        </View>
        <Pressable onPress={() => router.push('/news/trending-games')}>
          <Text variant="caption" color={Colors.primary} style={styles.seeAll}>
            See all
          </Text>
        </Pressable>
      </View>
      {query.isLoading ? (
        <TrendingSkeletons />
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <TrendingGameCard game={item} rank={index + 1} />}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={ItemSeparator}
        />
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
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  headerCopy: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: FontFamily.semibold,
    lineHeight: FontSize.md * 1.3,
  },
  updatedAt: {
    marginTop: 2,
  },
  seeAll: {
    fontFamily: FontFamily.medium,
    paddingTop: 2,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
  },
  separator: {
    width: Spacing.sm,
  },
  card: {
    width: CARD_WIDTH,
  },
  cardPressed: {
    opacity: 0.75,
  },
  artwork: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xxs,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: Colors.surfaceRaised,
  },
  rankBadge: {
    position: 'absolute',
    top: Spacing.xs,
    left: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: Radius.xs,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  rankText: {
    color: Colors.textPrimary,
    fontFamily: FontFamily.semibold,
  },
  gameName: {
    color: Colors.textPrimary,
    fontFamily: FontFamily.medium,
    lineHeight: FontSize.xs * 1.4,
  },
  mentions: {
    marginTop: 2,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
})
