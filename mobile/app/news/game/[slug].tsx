import { useCallback } from 'react'
import { FlatList, View, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams, Stack } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { Text } from '@/components/ui/Text'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui'
import { useNewsGame, useNewsGameArticles } from '@/hooks/useNewsForGame'
import type { NewsItem } from '@/hooks/useNews'
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants'
import { formatPubDate } from '@/lib/dates'

function ArticleRow({ item }: { item: NewsItem }) {
  function handlePress() {
    void WebBrowser.openBrowserAsync(item.link).catch(() => {})
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <View style={styles.rowContent}>
        <Text variant="body" style={styles.articleTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.articleMeta}>
          <Text variant="caption" color={Colors.primary}>
            {item.sourceName}
          </Text>
          {item.pubDate != null && item.pubDate !== '' && (
            <>
              <Text variant="caption" color={Colors.textMuted}>·</Text>
              <Text variant="caption" color={Colors.textMuted}>
                {formatPubDate(item.pubDate)}
              </Text>
            </>
          )}
        </View>
      </View>
      <Ionicons name="open-outline" size={14} color={Colors.textMuted} />
    </Pressable>
  )
}

function GameHeader({ slug }: { slug: string }) {
  const gameQuery = useNewsGame(slug)
  const game = gameQuery.data

  if (gameQuery.isLoading) {
    return (
      <View style={styles.gameHeaderSkeleton}>
        <SkeletonLoader width={80} height={80} borderRadius={Radius.md} />
        <View style={styles.gameHeaderSkeletonText}>
          <SkeletonLoader width="70%" height={22} borderRadius={Radius.xs} />
          <SkeletonLoader width="45%" height={14} borderRadius={Radius.xs} />
        </View>
      </View>
    )
  }

  if (game == null) return null

  return (
    <View style={styles.gameHeader}>
      {game.imageUrl != null ? (
        <Image
          source={{ uri: game.imageUrl }}
          style={styles.gameImage}
          contentFit="cover"
          transition={150}
          cachePolicy="disk"
        />
      ) : (
        <View style={[styles.gameImage, styles.gameImagePlaceholder]} />
      )}
      <View style={styles.gameInfo}>
        <Text variant="heading" style={styles.gameName} numberOfLines={2}>
          {game.name}
        </Text>
        {game.genres.length > 0 && (
          <Text variant="caption" color={Colors.textMuted} numberOfLines={1}>
            {game.genres.join(', ')}
          </Text>
        )}
      </View>
    </View>
  )
}

export default function NewsGameScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const gameQuery = useNewsGame(slug)
  const articlesQuery = useNewsGameArticles(gameQuery.data?.id)

  const renderItem = useCallback(({ item }: { item: NewsItem }) => <ArticleRow item={item} />, [])

  const articles = articlesQuery.data ?? []

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
      </View>

      {gameQuery.isLoading ? (
        <LoadingSpinner />
      ) : gameQuery.data == null ? (
        <EmptyState
          icon="game-controller-outline"
          heading="Game not found"
          subtext="No news game found with that slug."
        />
      ) : (
        <FlatList
          data={articles}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <GameHeader slug={slug} />
              <Text variant="label" style={styles.articlesLabel}>
                {articlesQuery.isLoading ? 'Loading articles…' : `${articles.length} articles`}
              </Text>
            </View>
          }
          ListEmptyComponent={
            !articlesQuery.isLoading ? (
              <Text variant="caption" color={Colors.textMuted} style={styles.empty}>
                No articles found for this game yet.
              </Text>
            ) : null
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
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.xs,
  },
  listHeader: {
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  gameHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  gameImage: {
    width: 80,
    height: 80,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  gameImagePlaceholder: {
    backgroundColor: Colors.surfaceRaised,
  },
  gameInfo: {
    flex: 1,
    gap: Spacing.xxs,
    paddingTop: Spacing.xxs,
  },
  gameName: {
    lineHeight: FontSize.xxl * 1.1,
  },
  articlesLabel: {
    color: Colors.textMuted,
    fontFamily: FontFamily.medium,
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
  rowContent: {
    flex: 1,
    gap: 4,
  },
  articleTitle: {
    fontFamily: FontFamily.medium,
    color: Colors.textPrimary,
    lineHeight: FontSize.md * 1.3,
  },
  articleMeta: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.lg,
  },
  gameHeaderSkeleton: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  gameHeaderSkeletonText: {
    flex: 1,
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
  },
})
