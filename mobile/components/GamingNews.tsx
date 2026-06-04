import { View, StyleSheet, Pressable } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { Text } from '@/components/ui/Text'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { useNews, type NewsItem } from '@/hooks/useNews'
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants'

function formatPubDate(pubDate: string): string {
  const date = new Date(pubDate.replace(' ', 'T'))
  if (isNaN(date.getTime())) return pubDate
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function NewsCard({ item, source }: { item: NewsItem; source: string }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => { void WebBrowser.openBrowserAsync(item.link).catch(() => {}) }}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <View style={styles.content}>
        <Text variant="label" style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.meta}>
          <Text variant="caption" color={Colors.primary}>
            {source}
          </Text>
          <Text variant="caption" color={Colors.textMuted}>
            ·
          </Text>
          <Text variant="caption" color={Colors.textMuted}>
            {formatPubDate(item.pubDate)}
          </Text>
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
  const newsQuery = useNews()

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="body" style={styles.sectionTitle}>
          Gaming News
        </Text>
      </View>
      {newsQuery.isLoading ? (
        <NewsSkeletons />
      ) : newsQuery.data != null && newsQuery.data.items.length > 0 ? (
        <View style={styles.list}>
          {newsQuery.data.items.map((item) => (
            <NewsCard key={item.link} item={item} source={newsQuery.data!.feedTitle} />
          ))}
        </View>
      ) : (
        <Text variant="caption" color={Colors.textMuted} style={styles.empty}>
          Could not load news.
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
