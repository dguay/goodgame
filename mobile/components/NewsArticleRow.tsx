import { View, StyleSheet, Pressable } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '@/components/ui/Text'
import type { NewsItem } from '@/hooks/useNews'
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants'
import { formatPubDate } from '@/lib/dates'

const DETAILED_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
}

interface Props {
  item: NewsItem
}

export function NewsArticleRow({ item }: Props) {
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
        <Text variant="body" style={styles.articleTitle} numberOfLines={5}>
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
                {formatPubDate(item.pubDate, DETAILED_DATE_OPTIONS)}
              </Text>
            </>
          )}
        </View>
      </View>
      <Ionicons name="open-outline" size={14} color={Colors.textMuted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
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
})
