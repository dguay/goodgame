import { Pressable, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Text } from '@/components/ui/Text'
import { AddToLibraryButton } from '@/components/AddToLibraryButton'
import { Colors, FontFamily, Radius, Spacing } from '@/constants'
import { STATUS_COLORS, STATUS_LABELS, type LibraryStatus } from '@/types'
import type { LibraryEntry } from '@/types/database'
import type { RawgGame } from '@/types/rawg'

type Props =
  | {
      entry: LibraryEntry
      game?: never
      layout?: 'card' | 'row'
    }
  | {
      game: RawgGame
      entry?: never
      layout?: 'card' | 'row'
    }

function formatLibraryReleaseDate(date: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

function getPlatformLabels(game: RawgGame): string {
  return (game.platforms ?? [])
    .map((entry) => entry.platform.name)
    .slice(0, 3)
    .join(' / ')
}

export function UnreleasedGameCard({ entry, game, layout = 'card' }: Props) {
  const isRow = layout === 'row'
  const release =
    entry != null
      ? {
          rawgGameId: entry.rawg_game_id,
          title: entry.game_title,
          coverUrl: entry.game_cover_url,
          releaseDate: entry.release_date,
        }
      : {
          rawgGameId: game.id,
          title: game.name,
          coverUrl: game.background_image,
          releaseDate: game.released,
        }
  const platforms = game != null ? getPlatformLabels(game) : ''
  const status = entry?.status as LibraryStatus | undefined
  const statusColor =
    status != null ? (STATUS_COLORS[status] ?? Colors.textMuted) : Colors.textMuted
  const statusLabel = status != null ? (STATUS_LABELS[status] ?? entry?.status) : null

  return (
    <Pressable
      style={({ pressed }) => [isRow ? styles.row : styles.card, pressed && styles.pressed]}
      onPress={() => router.push(`/game/${release.rawgGameId}`)}
    >
      {release.coverUrl != null ? (
        <Image
          source={{ uri: release.coverUrl }}
          style={isRow ? styles.rowCover : styles.cardCover}
          contentFit="cover"
          transition={200}
          cachePolicy="disk"
        />
      ) : (
        <View style={[isRow ? styles.rowCover : styles.cardCover, styles.coverPlaceholder]}>
          <Text variant="label" color={Colors.textMuted}>
            No cover
          </Text>
        </View>
      )}
      <View style={styles.info}>
        <Text variant="body" numberOfLines={2} style={styles.title}>
          {release.title}
        </Text>
        {release.releaseDate != null && (
          <View style={styles.releaseMeta}>
            <Ionicons name="calendar-outline" size={13} color={Colors.success} />
            <Text variant="caption" style={styles.releaseDate}>
              {formatLibraryReleaseDate(release.releaseDate)}
            </Text>
          </View>
        )}
        {game != null && release.releaseDate == null && (
          <Text variant="caption" style={styles.releaseDate}>
            Date TBA
          </Text>
        )}
        {game != null && platforms.length > 0 && (
          <Text variant="caption" numberOfLines={1} style={styles.platformText}>
            {platforms}
          </Text>
        )}
        {entry != null ? (
          <View style={[styles.statusChip, { borderColor: statusColor }]}>
            <Text variant="label" color={statusColor}>
              {statusLabel}
            </Text>
          </View>
        ) : (
          <View style={styles.addButtonContainer}>
            <AddToLibraryButton game={game} />
          </View>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    width: 160,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  pressed: {
    opacity: 0.75,
  },
  cardCover: {
    width: '100%',
    height: 130,
    backgroundColor: Colors.surfaceRaised,
  },
  rowCover: {
    width: 72,
    height: 96,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceRaised,
    flexShrink: 0,
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    padding: Spacing.xs,
    gap: Spacing.xxs,
  },
  title: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  releaseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  releaseDate: {
    color: Colors.textSecondary,
  },
  platformText: {
    color: Colors.textMuted,
  },
  addButtonContainer: {
    alignSelf: 'flex-start',
  },
  statusChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 3,
    marginTop: Spacing.xxs,
  },
})
