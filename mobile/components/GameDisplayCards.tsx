import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Text } from '@/components/ui/Text'
import { AddToLibraryButton } from '@/components/AddToLibraryButton'
import { Colors, FontFamily, Radius, Spacing } from '@/constants'
import { isUpcomingRelease } from '@/lib/releaseDates'
import { STATUS_COLORS, STATUS_LABELS, type LibraryStatus } from '@/types'
import type { LibraryEntry } from '@/types/database'
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

type GameSource =
  | {
      game: RawgGame
      entry?: never
    }
  | {
      entry: LibraryEntry
      game?: never
    }

type ReleaseDateFormat = 'date' | 'year'

type SmallGameCardProps = GameSource & {
  releaseDateFormat?: ReleaseDateFormat
  style?: StyleProp<ViewStyle>
}

interface LargeGameCardProps {
  entry: LibraryEntry
  onStatusPress: (entry: LibraryEntry) => void
  onLongPress?: () => void
}

type GameListCardProps = GameSource & {
  onDelete?: (id: string) => void
  onLongPress?: () => void
  onStatusPress?: (entry: LibraryEntry) => void
  releaseDateFormat?: ReleaseDateFormat
}

interface GameDisplayData {
  id: number
  title: string
  coverUrl: string | null
  releaseDate: string | null
  entry: LibraryEntry | null
  game: RawgGame | null
}

function getDisplayData(source: GameSource): GameDisplayData {
  if (source.entry != null) {
    return {
      id: source.entry.rawg_game_id,
      title: source.entry.game_title,
      coverUrl: source.entry.game_cover_url,
      releaseDate: source.entry.release_date,
      entry: source.entry,
      game: null,
    }
  }

  return {
    id: source.game.id,
    title: source.game.name,
    coverUrl: source.game.background_image,
    releaseDate: source.game.released,
    entry: null,
    game: source.game,
  }
}

function metacriticColor(score: number): string {
  if (score >= 75) return Colors.success
  if (score >= 60) return Colors.warning
  return Colors.error
}

function formatDate(date: string): string {
  if (date.length < 10) return date

  const parsedDate = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsedDate.getTime())) return date

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsedDate)
}

function getReleaseLabel(
  releaseDate: string | null,
  format: ReleaseDateFormat,
): { label: string; isUpcoming: boolean } | null {
  if (releaseDate == null) return null
  const year = releaseDate.split('-')[0]
  if (year == null || year.length === 0) return null

  if (format === 'date') {
    return {
      label: formatDate(releaseDate),
      isUpcoming: isUpcomingRelease(releaseDate),
    }
  }

  const numericYear = Number(year)
  const isFutureYear = releaseDate === year && !Number.isNaN(numericYear)
    ? numericYear > new Date().getFullYear()
    : false

  return {
    label: year,
    isUpcoming: isFutureYear || isUpcomingRelease(releaseDate),
  }
}

function getPlatformLabels(game: RawgGame): string[] {
  return (game.platforms ?? [])
    .map((entry) => PLATFORM_LABELS[entry.platform.slug])
    .filter((label): label is string => label !== undefined)
    .slice(0, 3)
}

function getGenreLabel(game: RawgGame): string | null {
  return (game.genres ?? [])[0]?.name ?? null
}

function formatPlaytime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours === 0) return `${remainingMinutes}m`
  if (remainingMinutes === 0) return `${hours}h`
  return `${hours}h ${remainingMinutes}m`
}

function StatusChip({
  entry,
  onPress,
}: {
  entry: LibraryEntry
  onPress?: (entry: LibraryEntry) => void
}) {
  const status = entry.status as LibraryStatus
  const color = STATUS_COLORS[status] ?? Colors.textMuted
  const label = STATUS_LABELS[status] ?? entry.status
  const chip = (
    <View style={[styles.statusChip, { borderColor: color }]}>
      <Text variant="label" color={color}>
        {label}
      </Text>
    </View>
  )

  if (onPress == null) return chip

  return (
    <Pressable onPress={() => onPress(entry)} hitSlop={4}>
      {chip}
    </Pressable>
  )
}

function ReleaseMeta({
  releaseDate,
  format,
}: {
  releaseDate: string | null
  format: ReleaseDateFormat
}) {
  const meta = getReleaseLabel(releaseDate, format)
  if (meta == null) return null

  return (
    <View style={styles.releaseMeta}>
      <Text variant="caption" style={styles.metaText}>
        {meta.label}
      </Text>
      {(format === 'date' || meta.isUpcoming) && (
        <Ionicons name="calendar-outline" size={12} color={Colors.success} />
      )}
    </View>
  )
}

function CoverPlaceholder({ style }: { style: StyleProp<ViewStyle> }) {
  return (
    <View style={[style, styles.coverPlaceholder]}>
      <Text variant="label" color={Colors.textMuted}>
        No cover
      </Text>
    </View>
  )
}

export function SmallGameCard({
  entry,
  game,
  releaseDateFormat = 'year',
  style,
}: SmallGameCardProps) {
  const data = getDisplayData(entry != null ? { entry } : { game })
  const platforms = data.game != null ? getPlatformLabels(data.game) : []

  return (
    <Pressable
      style={({ pressed }) => [styles.smallCard, style, pressed && styles.pressed]}
      onPress={() => router.push(`/game/${data.id}`)}
    >
      <View style={styles.coverContainer}>
        {data.coverUrl != null ? (
          <Image
            source={{ uri: data.coverUrl }}
            style={styles.coverFull}
            contentFit="cover"
            transition={200}
            cachePolicy="disk"
          />
        ) : (
          <CoverPlaceholder style={styles.coverFull} />
        )}
        {data.game?.metacritic != null && (
          <View
            style={[
              styles.metaBadge,
              { borderColor: metacriticColor(data.game.metacritic) },
            ]}
          >
            <Text variant="label" color={metacriticColor(data.game.metacritic)}>
              {data.game.metacritic}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.cardInfo}>
        <Text variant="body" numberOfLines={2} style={styles.smallTitle}>
          {data.title}
        </Text>
        <ReleaseMeta releaseDate={data.releaseDate} format={releaseDateFormat} />
        {data.game != null && data.releaseDate == null && (
          <Text variant="caption" style={styles.metaText}>
            Date TBA
          </Text>
        )}
        {platforms.length > 0 && (
          <View style={styles.platforms}>
            {platforms.map((platform) => (
              <Text key={platform} variant="label" style={styles.platformChip}>
                {platform}
              </Text>
            ))}
          </View>
        )}
        {data.entry != null ? (
          <StatusChip entry={data.entry} />
        ) : data.game != null ? (
          <View style={styles.addButtonContainer}>
            <AddToLibraryButton game={data.game} />
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

export function LargeGameCard({ entry, onStatusPress, onLongPress }: LargeGameCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.largeCard, pressed && styles.pressed]}
      onPress={() => router.push(`/game/${entry.rawg_game_id}`)}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      {entry.game_cover_url != null ? (
        <Image
          source={{ uri: entry.game_cover_url }}
          style={styles.coverFull}
          contentFit="cover"
          transition={200}
          cachePolicy="disk"
        />
      ) : (
        <CoverPlaceholder style={styles.coverFull} />
      )}
      <View style={styles.largeInfo}>
        <Text variant="body" numberOfLines={2} style={styles.smallTitle}>
          {entry.game_title}
        </Text>
        <ReleaseMeta releaseDate={entry.release_date} format="year" />
        <StatusChip entry={entry} onPress={onStatusPress} />
        <LibraryPersonalMeta entry={entry} />
      </View>
    </Pressable>
  )
}

export function GameListCard({
  entry,
  game,
  onDelete,
  onLongPress,
  onStatusPress,
  releaseDateFormat = 'year',
}: GameListCardProps) {
  const data = getDisplayData(entry != null ? { entry } : { game })
  const topGenre = data.game != null ? getGenreLabel(data.game) : null
  const libraryEntry = data.entry

  return (
    <Pressable
      style={({ pressed }) => [styles.listItem, pressed && styles.pressed]}
      onPress={() => router.push(`/game/${data.id}`)}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      {data.coverUrl != null ? (
        <Image
          source={{ uri: data.coverUrl }}
          style={styles.listCover}
          contentFit="cover"
          transition={200}
          cachePolicy="disk"
        />
      ) : (
        <CoverPlaceholder style={styles.listCover} />
      )}
      <View style={styles.listInfo}>
        <Text variant="body" numberOfLines={2} style={styles.listTitle}>
          {data.title}
        </Text>
        <View style={styles.metaRow}>
          <ReleaseMeta releaseDate={data.releaseDate} format={releaseDateFormat} />
          {topGenre != null && (
            <Text variant="caption" style={styles.metaText}>
              {topGenre}
            </Text>
          )}
        </View>
        {libraryEntry != null && <StatusChip entry={libraryEntry} onPress={onStatusPress} />}
        {libraryEntry != null && <LibraryPersonalMeta entry={libraryEntry} />}
        {data.game?.metacritic != null && (
          <View
            style={[
              styles.listMetaBadge,
              { borderColor: metacriticColor(data.game.metacritic) },
            ]}
          >
            <Text variant="label" color={metacriticColor(data.game.metacritic)}>
              {data.game.metacritic}
            </Text>
          </View>
        )}
      </View>
      {data.game != null && <AddToLibraryButton game={data.game} />}
      {libraryEntry != null && onDelete != null && (
        <Pressable
          style={styles.deleteButton}
          onPress={() => onDelete(libraryEntry.id)}
          hitSlop={12}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
        </Pressable>
      )}
    </Pressable>
  )
}

function LibraryPersonalMeta({ entry }: { entry: LibraryEntry }) {
  if (
    entry.personal_rating == null &&
    (entry.personal_playtime_minutes == null || entry.personal_playtime_minutes <= 0)
  ) {
    return null
  }

  return (
    <View style={styles.metaRow}>
      {entry.personal_rating != null && (
        <Text variant="caption" style={styles.metaText}>
          Rating {entry.personal_rating.toFixed(1)}
        </Text>
      )}
      {entry.personal_playtime_minutes != null && entry.personal_playtime_minutes > 0 && (
        <Text variant="caption" style={styles.metaText}>
          {formatPlaytime(entry.personal_playtime_minutes)}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  smallCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  largeCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
    backgroundColor: Colors.background,
  },
  pressed: {
    opacity: 0.82,
  },
  coverContainer: {
    position: 'relative',
  },
  coverFull: {
    width: '100%',
    height: 130,
    backgroundColor: Colors.surfaceRaised,
  },
  listCover: {
    width: 60,
    height: 80,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceRaised,
    flexShrink: 0,
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    padding: Spacing.xs,
    gap: Spacing.xxs,
  },
  largeInfo: {
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  listInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  smallTitle: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  listTitle: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  releaseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    color: Colors.textSecondary,
  },
  metaRow: {
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
    borderRadius: Radius.xs,
  },
  addButtonContainer: {
    alignSelf: 'flex-start',
    marginTop: 'auto',
    paddingTop: Spacing.xxs,
  },
  metaBadge: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    borderWidth: 1.5,
    borderRadius: Radius.xs,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: Colors.background,
  },
  listMetaBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: Radius.xs,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  statusChip: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: Radius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  deleteButton: {
    padding: Spacing.xs,
    flexShrink: 0,
  },
})
