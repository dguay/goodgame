import { Pressable, View, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '@/components/ui/Text'
import { AddToLibraryButton } from '@/components/AddToLibraryButton'
import { Colors, Spacing, Radius, FontFamily } from '@/constants'
import { isUpcomingRelease } from '@/lib/releaseDates'
import type { RawgGame } from '@/types/rawg'

function metacriticColor(score: number): string {
  if (score >= 75) return Colors.success
  if (score >= 60) return Colors.warning
  return Colors.error
}

interface Props {
  game: RawgGame
}

export function GameListItem({ game }: Props) {
  const year = game.released != null ? game.released.split('-')[0] : null
  const isUpcoming = isUpcomingRelease(game.released)
  const topGenre = (game.genres ?? [])[0]?.name ?? null

  return (
    <Pressable
      style={styles.container}
      onPress={() => router.push(`/game/${game.id}`)}
    >
      <Image
        source={game.background_image != null ? { uri: game.background_image } : null}
        style={styles.thumbnail}
        contentFit="cover"
        transition={200}
        cachePolicy="disk"
      />
      <View style={styles.info}>
        <Text variant="body" numberOfLines={2} style={styles.title}>
          {game.name}
        </Text>
        {(year != null || topGenre != null) && (
          <View style={styles.metaRow}>
            {year != null && (
              <View style={styles.releaseMeta}>
                <Text variant="caption">{year}</Text>
                {isUpcoming && (
                  <Ionicons name="calendar-outline" size={12} color={Colors.success} />
                )}
              </View>
            )}
            {year != null && topGenre != null && (
              <Text variant="caption" color={Colors.textMuted}>
                -
              </Text>
            )}
            {topGenre != null && <Text variant="caption">{topGenre}</Text>}
          </View>
        )}
        {game.metacritic != null && (
          <View style={[styles.metaBadge, { borderColor: metacriticColor(game.metacritic) }]}>
            <Text variant="label" color={metacriticColor(game.metacritic)}>
              {game.metacritic}
            </Text>
          </View>
        )}
      </View>
      <AddToLibraryButton game={game} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  thumbnail: {
    width: 60,
    height: 80,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceRaised,
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: Spacing.xxs,
  },
  title: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  releaseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: Radius.xs,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
})
