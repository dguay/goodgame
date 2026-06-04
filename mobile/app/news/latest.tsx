import { useCallback, useMemo } from 'react'
import { FlatList, View, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { Text } from '@/components/ui/Text'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { useLatestNews, type NewsItem } from '@/hooks/useNews'
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants'

function formatPubDate(pubDate: string | null): string {
  if (!pubDate) return ''
  const date = new Date(pubDate)
  if (isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

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

function ArticleSkeletons() {
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: 8 }, (_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={styles.skeletonText}>
            <SkeletonLoader width="100%" height={14} borderRadius={Radius.xs} />
            <SkeletonLoader width="60%" height={14} borderRadius={Radius.xs} />
            <SkeletonLoader width="35%" height={12} borderRadius={Radius.xs} />
          </View>
        </View>
      ))}
    </View>
  )
}

export default function LatestNewsScreen() {
  const query = useLatestNews()

  const allItems = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data]
  )

  const renderItem = useCallback(({ item }: { item: NewsItem }) => <ArticleRow item={item} />, [])

  const onEndReached = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage()
    }
  }, [query])

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
            Latest News
          </Text>
          <Text variant="caption" style={styles.subtitle}>
            All articles, newest first
          </Text>
        </View>
      </View>

      {query.isLoading ? (
        <ArticleSkeletons />
      ) : (
        <FlatList
          data={allItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <ActivityIndicator color={Colors.primary} style={styles.loadingMore} />
            ) : !query.hasNextPage && allItems.length > 0 ? (
              <Text variant="caption" color={Colors.textMuted} style={styles.endText}>
                All caught up
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <Text variant="caption" color={Colors.textMuted} style={styles.empty}>
              No articles yet — check back soon.
            </Text>
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
  loadingMore: {
    paddingVertical: Spacing.lg,
  },
  endText: {
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  empty: {
    paddingTop: Spacing.xl,
    textAlign: 'center',
  },
  skeletonContainer: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  skeletonRow: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  skeletonText: {
    gap: 6,
  },
})
