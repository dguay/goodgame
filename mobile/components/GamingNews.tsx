import { View, StyleSheet, Pressable } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { router } from 'expo-router'
import { Text } from '@/components/ui/Text'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { useStoryClusters, type StoryCluster } from '@/hooks/useStoryClusters'
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants'

function formatPubDate(pubDate: string | null): string {
  if (!pubDate) return ''
  const date = new Date(pubDate)
  if (isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date)
}

function ClusterCard({ cluster }: { cluster: StoryCluster }) {
  const primarySource = cluster.sources[0] ?? null
  const extraSources = cluster.sources.length - 1

  function handlePress() {
    if (primarySource != null) {
      void WebBrowser.openBrowserAsync(primarySource.articleUrl).catch(() => {})
    }
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={cluster.title}
    >
      <View style={styles.content}>
        <Text variant="label" style={styles.title} numberOfLines={2}>
          {cluster.title}
        </Text>
        <View style={styles.meta}>
          {primarySource != null && (
            <Text variant="caption" color={Colors.primary}>
              {primarySource.name}
            </Text>
          )}
          {extraSources > 0 && (
            <>
              <Text variant="caption" color={Colors.textMuted}>·</Text>
              <Text variant="caption" color={Colors.textMuted}>
                +{extraSources} more
              </Text>
            </>
          )}
          {cluster.latestPublishedAt != null && (
            <>
              <Text variant="caption" color={Colors.textMuted}>·</Text>
              <Text variant="caption" color={Colors.textMuted}>
                {formatPubDate(cluster.latestPublishedAt)}
              </Text>
            </>
          )}
        </View>
      </View>
    </Pressable>
  )
}

function NewsSkeletons() {
  return (
    <View style={styles.skeletons}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={styles.skeletonText}>
            <SkeletonLoader width="100%" height={14} borderRadius={Radius.xs} />
            <SkeletonLoader width="40%" height={12} borderRadius={Radius.xs} />
          </View>
        </View>
      ))}
    </View>
  )
}

export function GamingNews() {
  const clustersQuery = useStoryClusters(5)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="body" style={styles.sectionTitle}>
          Top Stories
        </Text>
        <Pressable onPress={() => router.push('/news/latest')}>
          <Text variant="caption" color={Colors.primary} style={styles.seeAll}>
            See all
          </Text>
        </Pressable>
      </View>
      {clustersQuery.isLoading ? (
        <NewsSkeletons />
      ) : clustersQuery.data != null && clustersQuery.data.length > 0 ? (
        <View style={styles.list}>
          {clustersQuery.data.map((cluster) => (
            <ClusterCard key={cluster.id} cluster={cluster} />
          ))}
        </View>
      ) : (
        <Text variant="caption" color={Colors.textMuted} style={styles.empty}>
          No stories yet — check back soon.
        </Text>
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
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: FontFamily.semibold,
    lineHeight: FontSize.md * 1.3,
  },
  seeAll: {
    fontFamily: FontFamily.medium,
  },
  list: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardPressed: {
    backgroundColor: Colors.surfaceRaised,
  },
  content: {
    padding: Spacing.sm,
    gap: 4,
  },
  title: {
    color: Colors.textPrimary,
    lineHeight: FontSize.sm * 1.4,
  },
  meta: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  skeletons: {
    paddingHorizontal: Spacing.md,
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
  empty: {
    paddingHorizontal: Spacing.md,
  },
})
