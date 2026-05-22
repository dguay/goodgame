import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Text } from '@/components/ui/Text'
import { AddToLibraryButton } from '@/components/AddToLibraryButton'
import { Colors, FontFamily, Radius, Spacing } from '@/constants'
import { formatRatingCount } from '@/lib/rating'
import { useGameDetail } from '@/hooks/useRawg'
import { isUpcomingRelease } from '@/lib/releaseDates'
import { STATUS_COLORS, STATUS_LABELS, type LibraryStatus } from '@/types'
import type { LibraryEntry } from '@/types/database'
import type { RawgGame, RawgGameDetail } from '@/types/rawg'

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
  gameDetail?: RawgGameDetail
  onStatusPress: (entry: LibraryEntry) => void
  onLongPress?: () => void
}

type GameListCardProps = GameSource & {
  gameDetail?: RawgGameDetail
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

function formatDate(
  date: string,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  },
): string {
  if (date.length < 10) return date

  const parsedDate = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsedDate.getTime())) return date

  return new Intl.DateTimeFormat('en', options).format(parsedDate)
}

function formatFullDate(date: string): string {
  return formatDate(date, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
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

function getDeveloperLabel(game: RawgGameDetail): string | null {
  const developers = game.developers
  if (developers.length === 0) return null
  return developers.map(developer => developer.name).join(', ')
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
        <View style={styles.smallFooter}>
          {data.entry != null ? (
            <StatusChip entry={data.entry} />
          ) : data.game != null ? (
            <View style={styles.addButtonContainer}>
              <AddToLibraryButton game={data.game} />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}

export function LargeGameCard({
  entry,
  gameDetail,
  onStatusPress,
  onLongPress,
}: LargeGameCardProps) {
  const detailId = gameDetail == null ? entry.rawg_game_id : null
  const { data: fetchedGameDetail } = useGameDetail(detailId)
  const resolvedGameDetail = gameDetail ?? fetchedGameDetail
  const developerLabel = resolvedGameDetail != null ? getDeveloperLabel(resolvedGameDetail) : null
  const coverUrl = resolvedGameDetail?.background_image ?? entry.game_cover_url
  const releaseDate = resolvedGameDetail?.released ?? entry.release_date
  const hasRawgRating = resolvedGameDetail?.rating != null && resolvedGameDetail.rating > 0

  return (
    <View style={styles.largeCardShadow}>
      <Pressable
        style={({ pressed }) => [styles.largeCard, pressed && styles.largeCardPressed]}
        onPress={() => router.push(`/game/${entry.rawg_game_id}`)}
        onLongPress={onLongPress}
        delayLongPress={400}
      >
        {coverUrl != null ? (
          <Image
            source={{ uri: coverUrl }}
            style={styles.largeCover}
            contentFit="cover"
            transition={200}
            cachePolicy="disk"
          />
        ) : (
          <CoverPlaceholder style={styles.largeCover} />
        )}
        <View style={styles.largeInfo}>
          <View style={styles.largeHeader}>
            <View style={styles.largeTitleBlock}>
              <Text variant="body" numberOfLines={2} style={styles.largeTitle}>
                {entry.game_title}
              </Text>
              {developerLabel != null && (
                <Text variant="caption" numberOfLines={1} style={styles.developerText}>
                  {developerLabel}
                </Text>
              )}
            </View>
            <StatusChip entry={entry} onPress={onStatusPress} />
          </View>
          <View style={styles.largeDetails}>
            <View style={styles.largeBadgeRow}>
              {resolvedGameDetail?.metacritic != null && (
                <View style={[styles.largeScoreBadge, { borderColor: metacriticColor(resolvedGameDetail.metacritic) }]}>
                  <Text variant="mono" color={metacriticColor(resolvedGameDetail.metacritic)} style={styles.largeScoreNumber}>
                    {resolvedGameDetail.metacritic}
                  </Text>
                  <Text variant="label" color={metacriticColor(resolvedGameDetail.metacritic)}>
                    Meta
                  </Text>
                </View>
              )}
              {hasRawgRating && (
                <View style={styles.largeScoreBadge}>
                  <Ionicons name="star" size={14} color={Colors.rawg} />
                  <Text variant="mono" style={styles.largeScoreNumber}>
                    {resolvedGameDetail!.rating.toFixed(1)}
                  </Text>
                  <Text variant="label">
                    {resolvedGameDetail!.ratings_count > 0 ? formatRatingCount(resolvedGameDetail!.ratings_count) : 'RAWG'}
                  </Text>
                </View>
              )}
            </View>
            <LargeDateStack
              releaseDate={releaseDate}
              finishedDate={entry.finished_at}
            />
          </View>
        </View>
      </Pressable>
    </View>
  )
}

function LargeDateStack({
  releaseDate,
  finishedDate,
}: {
  releaseDate: string | null
  finishedDate: string | null
}) {
  return (
    <View style={styles.largeDateStack}>
      <View style={styles.largeDateRow}>
        <Text variant="label" style={styles.largeDateLabel}>Released</Text>
        <Text variant="caption" numberOfLines={1} style={styles.largeDateValue}>
          {releaseDate != null ? formatFullDate(releaseDate) : 'Date TBA'}
        </Text>
      </View>
      {finishedDate != null && (
        <View style={styles.largeDateRow}>
          <Text variant="label" style={styles.largeDateLabel}>Finished</Text>
          <Text variant="caption" numberOfLines={1} style={styles.largeDateValue}>
            {formatFullDate(finishedDate)}
          </Text>
        </View>
      )}
    </View>
  )
}

export function GameListCard({
  entry,
  game,
  gameDetail,
  onDelete,
  onLongPress,
  onStatusPress,
}: GameListCardProps) {
  const data = getDisplayData(entry != null ? { entry } : { game })
  const libraryEntry = data.entry
  const detailId = libraryEntry != null && gameDetail == null ? data.id : null
  const { data: fetchedGameDetail } = useGameDetail(detailId)
  const resolvedGameDetail = gameDetail ?? fetchedGameDetail
  const developerLabel = resolvedGameDetail != null ? getDeveloperLabel(resolvedGameDetail) : null
  const releaseDate = resolvedGameDetail?.released ?? data.releaseDate
  const releaseLabel = getListReleaseLabel(releaseDate)
  const metacriticScore = resolvedGameDetail?.metacritic ?? data.game?.metacritic ?? null
  const rawgRating = resolvedGameDetail?.rating ?? data.game?.rating ?? null
  const hasRawgRating = rawgRating != null && rawgRating > 0

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
        <View style={styles.listMetaStack}>
          <ListMetadataLine value={`${developerLabel ?? 'Unknown'}`} />
          <ListMetadataLine value={`${releaseLabel}`} />
          {metacriticScore != null && (
            <ListMetadataLine
              value={`META: ${metacriticScore}`}
              valueColor={metacriticColor(metacriticScore)}
            />
          )}
          {hasRawgRating && (
            <ListMetadataLine
              value={`${rawgRating.toFixed(1)} (${formatRatingCount(resolvedGameDetail?.ratings_count ?? 0)})`}
              valueColor={Colors.rawg}
            />
          )}
          {libraryEntry?.finished_at != null && (
            <ListMetadataLine value={`Finished on ${formatFullDate(libraryEntry.finished_at)}`} />
          )}
          <View style={styles.listActionRow}>
            {libraryEntry != null ? (
              <StatusChip entry={libraryEntry} onPress={onStatusPress} />
            ) : data.game != null ? (
              <AddToLibraryButton game={data.game} />
            ) : null}
          </View>
        </View>
      </View>
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

function getListReleaseLabel(releaseDate: string | null): string {
  if (releaseDate == null) return 'Date TBA'
  return formatFullDate(releaseDate)
}

function ListMetadataLine({
  value,
  valueColor,
}: {
  value: string
  valueColor?: string
}) {
  return (
    <Text
      variant="caption"
      numberOfLines={1}
      style={[styles.listMetadataValue, valueColor != null ? { color: valueColor } : undefined]}
    >
      {value}
    </Text>
  )
}

const styles = StyleSheet.create({
  smallCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xs,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  largeCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  largeCardShadow: {
    flex: 1,
    borderRadius: Radius.xl,
    shadowColor: '#020305',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: Platform.OS === 'web' ? 0.22 : 0.28,
    shadowRadius: 18,
    elevation: 8,
  },
  largeCardPressed: {
    borderColor: Colors.borderSoft,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
    backgroundColor: '#0A0B0D',
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
  largeCover: {
    width: '100%',
    height: 164,
    backgroundColor: Colors.surfaceRaised,
  },
  listCover: {
    width: 92,
    height: 124,
    borderRadius: Radius.md,
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
  smallFooter: {
    marginTop: 'auto',
    gap: Spacing.xxs,
  },
  largeInfo: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  listInfo: {
    flex: 1,
    gap: Spacing.xs,
    minWidth: 0,
  },
  smallTitle: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  largeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  largeTitleBlock: {
    flex: 1,
    gap: Spacing.xxs,
    minWidth: 0,
  },
  largeTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 16,
    lineHeight: 21,
  },
  developerText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  largeDetails: {
    gap: Spacing.xs,
  },
  largeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  largeScoreBadge: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.background,
  },
  largeScoreNumber: {
    fontSize: 13,
    lineHeight: 17,
  },
  largeDateStack: {
    gap: 2,
  },
  largeDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  largeDateLabel: {
    width: 56,
    color: Colors.textMutedSoft,
    fontSize: 10,
    lineHeight: 13,
  },
  largeDateValue: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  listTitle: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  listMetaStack: {
    gap: 5,
  },
  listMetadataValue: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  listActionRow: {
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    paddingTop: Spacing.xxs,
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
  addButtonContainer: {
    alignSelf: 'flex-start',
    paddingTop: Spacing.xxs,
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
