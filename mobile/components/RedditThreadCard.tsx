import { Linking, Pressable, StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/Text'
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants'
import type { RedditThread } from '@/types/reddit'

interface Props {
  thread: RedditThread
}

export function RedditThreadCard({ thread }: Props) {
  function handlePress() {
    Linking.openURL(`https://reddit.com${thread.permalink}`).catch(console.error)
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={handlePress}
      accessibilityRole="link"
      accessibilityLabel={thread.title}
    >
      <View style={styles.subredditRow}>
        <View style={styles.subredditPill}>
          <Text variant="label" style={styles.subredditText}>
            r/{thread.subreddit}
          </Text>
        </View>
      </View>

      <Text variant="body" numberOfLines={2} style={styles.title}>
        {thread.title}
      </Text>

      <View style={styles.metaRow}>
        <Text variant="caption" style={styles.meta}>
          ▲ {thread.score.toLocaleString()}
        </Text>
        <Text variant="caption" style={styles.metaSeparator}>·</Text>
        <Text variant="caption" style={styles.meta}>
          💬 {thread.num_comments.toLocaleString()}
        </Text>
        <Text variant="caption" style={styles.metaSeparator}>·</Text>
        <Text variant="caption" style={styles.metaLink}>
          Open ↗
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    marginHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  cardPressed: {
    backgroundColor: Colors.surfaceRaised,
  },
  subredditRow: {
    flexDirection: 'row',
  },
  subredditPill: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 3,
  },
  subredditText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  title: {
    fontFamily: FontFamily.medium,
    color: Colors.textPrimary,
    lineHeight: FontSize.md * 1.35,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  meta: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  metaSeparator: {
    color: Colors.textMutedSoft,
    fontSize: FontSize.xs,
  },
  metaLink: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
  },
})
