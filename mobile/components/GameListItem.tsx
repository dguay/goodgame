import { Pressable, View, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Text } from '@/components/ui/Text'
import { AddToLibraryButton } from '@/components/AddToLibraryButton'
import { Colors, Spacing } from '@/constants'
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
  const topGenre = game.genres[0]?.name ?? null
  const meta = [year, topGenre].filter(Boolean).join(' · ')

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
        {meta.length > 0 && (
          <Text variant="caption">{meta}</Text>
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
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  thumbnail: {
    width: 60,
    height: 80,
    borderRadius: 6,
    backgroundColor: Colors.surfaceRaised,
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: Spacing.xs,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
})
