import { Pressable, View, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Text } from '@/components/ui/Text'
import { AddToLibraryButton } from '@/components/AddToLibraryButton'
import { Colors, Spacing } from '@/constants'
import type { RawgGame } from '@/types/rawg'

const PLATFORM_LABELS: Record<string, string> = {
  pc: 'PC',
  playstation5: 'PS5',
  playstation4: 'PS4',
  playstation3: 'PS3',
  'xbox-series-x': 'XSX',
  'xbox-one': 'XB1',
  xbox360: 'X360',
  'nintendo-switch': 'NSW',
  ios: 'iOS',
  android: 'And',
  macos: 'Mac',
  linux: 'Lin',
}

function metacriticColor(score: number): string {
  if (score >= 75) return Colors.success
  if (score >= 60) return Colors.warning
  return Colors.error
}

interface Props {
  game: RawgGame
  style?: StyleProp<ViewStyle>
}

export function GameCard({ game, style }: Props) {
  const year = game.released != null ? game.released.split('-')[0] : null
  const platforms = (game.platforms ?? [])
    .map(p => PLATFORM_LABELS[p.platform.slug])
    .filter((p): p is string => p !== undefined)
    .slice(0, 3)

  return (
    <Pressable
      style={[styles.card, style]}
      onPress={() => router.push(`/game/${game.id}`)}
    >
      <View style={styles.coverContainer}>
        <Image
          source={game.background_image != null ? { uri: game.background_image } : null}
          style={styles.cover}
          contentFit="cover"
          transition={200}
          cachePolicy="disk"
        />
        {game.metacritic != null && (
          <View style={[styles.metaBadge, { borderColor: metacriticColor(game.metacritic) }]}>
            <Text variant="label" color={metacriticColor(game.metacritic)}>
              {game.metacritic}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text variant="body" numberOfLines={2} style={styles.title}>
          {game.name}
        </Text>
        <View style={styles.meta}>
          {year != null && <Text variant="caption">{year}</Text>}
          {platforms.length > 0 && (
            <View style={styles.platforms}>
              {platforms.map(p => (
                <Text key={p} variant="label" style={styles.platformChip}>
                  {p}
                </Text>
              ))}
            </View>
          )}
        </View>
        <AddToLibraryButton game={game} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  coverContainer: {
    position: 'relative',
  },
  cover: {
    width: '100%',
    height: 130,
    backgroundColor: Colors.surfaceRaised,
  },
  metaBadge: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: Colors.background,
  },
  info: {
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  title: {
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  platforms: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  platformChip: {
    backgroundColor: Colors.surfaceRaised,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
})
