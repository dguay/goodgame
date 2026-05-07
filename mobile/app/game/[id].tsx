import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import { Text } from '@/components/ui/Text'
import { LoadingSpinner, EmptyState } from '@/components/ui'
import { AddToLibraryButton } from '@/components/AddToLibraryButton'
import { DateField } from '@/components/DateField'
import { GameCard } from '@/components/GameCard'
import { RawgFooter } from '@/components/RawgFooter'
import { RatingInput } from '@/components/RatingInput'

import {
  useGameAdditions,
  useGameDetail,
  useGameMovies,
  useGameScreenshots,
  useGameSeries,
} from '@/hooks/useRawg'
import { useLibraryEntry, useUpdateLibraryEntry } from '@/hooks/useLibrary'

import { Colors, FontFamily, Radius, Spacing } from '@/constants'
import type { LibraryEntry } from '@/types/database'
import type { RawgGame, RawgGameDetail, RawgMovie } from '@/types/rawg'

// helpers

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

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

const REDDIT_ORANGE = '#ff4500'

function metacriticColor(score: number): string {
  if (score >= 75) return Colors.success
  if (score >= 60) return Colors.warning
  return Colors.error
}

function formatRatingCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return count.toString()
}

interface ReleaseDateInfo {
  label: string
  isFuture: boolean
}

function getReleaseDateInfo(released: string | null): ReleaseDateInfo | null {
  if (released == null) return null
  const [year, month, day] = released.split('-')
  const monthIndex = Number(month) - 1
  const dayNumber = Number(day)
  const yearNumber = Number(year)
  if (year == null || month == null || day == null) return null
  if (monthIndex < 0 || monthIndex >= MONTH_NAMES.length) return null
  if (isNaN(yearNumber) || isNaN(dayNumber)) return null

  const releaseDate = new Date(yearNumber, monthIndex, dayNumber)
  if (
    releaseDate.getFullYear() !== yearNumber ||
    releaseDate.getMonth() !== monthIndex ||
    releaseDate.getDate() !== dayNumber
  ) {
    return null
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return {
    label: `${MONTH_NAMES[monthIndex]} ${dayNumber}, ${year}`,
    isFuture: releaseDate.getTime() > today.getTime(),
  }
}

function getPlayableMovieUrl(movie: RawgMovie): string | null {
  return movie.data.max ?? movie.data['480'] ?? Object.values(movie.data)[0] ?? null
}

function getRedditUrl(rawUrl: string | null): string | null {
  if (rawUrl == null || rawUrl.trim() === '') return null
  const trimmed = rawUrl.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `https://www.reddit.com/r/${trimmed.replace(/^\/?r\//, '').replace(/\/$/, '')}/`
}

function getRedditLabel(rawUrl: string | null): string | null {
  const url = getRedditUrl(rawUrl)
  if (url == null) return null
  const match = url.match(/reddit\.com\/r\/([^/]+)/i)
  return match != null ? `r/${match[1]}` : 'Subreddit'
}

async function openExternalUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url)
  } catch (error) {
    console.warn('Could not open external URL', error)
  }
}

interface SectionStateProps {
  label: string
}

function SectionLoading({ label }: SectionStateProps) {
  return (
    <View style={styles.sectionState}>
      <ActivityIndicator size="small" color={Colors.primary} />
      <Text variant="caption">{label}</Text>
    </View>
  )
}

function SectionMessage({ label }: SectionStateProps) {
  return (
    <View style={styles.sectionState}>
      <Text variant="caption">{label}</Text>
    </View>
  )
}

// HeroSection

interface HeroProps { game: RawgGameDetail }

function HeroSection({ game }: HeroProps) {
  const releaseDate = getReleaseDateInfo(game.released)
  const platforms = (game.platforms ?? [])
    .map(p => PLATFORM_LABELS[p.platform.slug])
    .filter((p): p is string => p !== undefined)
    .slice(0, 5)

  return (
    <View style={styles.hero}>
      {game.background_image != null && (
        <Image
          source={{ uri: game.background_image }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={18}
          cachePolicy="disk"
        />
      )}
      <LinearGradient
        colors={['rgba(13,13,15,0.15)', 'rgba(13,13,15,0.98)']}
        locations={[0, 0.82]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroContent}>
        {game.background_image != null && (
          <Image
            source={{ uri: game.background_image }}
            style={styles.coverArt}
            contentFit="cover"
            cachePolicy="disk"
            transition={200}
          />
        )}
        <View style={styles.heroInfo}>
          <Text variant="heading" numberOfLines={4} style={styles.heroTitle}>
            {game.name}
          </Text>
          {(game.developers ?? []).length > 0 && (
            <Text variant="caption" numberOfLines={2}>
              {(game.developers ?? []).map(d => d.name).join(', ')}
            </Text>
          )}
          <View style={styles.heroMeta}>
            {releaseDate != null && (
              releaseDate.isFuture ? (
                <View style={styles.comingSoonMeta}>
                  <Ionicons name="calendar-outline" size={13} color={Colors.success} />
                  <Text variant="caption" color={Colors.success}>
                    Coming on {releaseDate.label}
                  </Text>
                </View>
              ) : (
                <Text variant="caption">{releaseDate.label}</Text>
              )
            )}
            {game.metacritic != null && (
              <View style={[styles.metacriticBadge, { borderColor: metacriticColor(game.metacritic) }]}>
                <Text variant="label" color={metacriticColor(game.metacritic)}>
                  {game.metacritic}
                </Text>
              </View>
            )}
            {game.rating > 0 && (
              <View style={styles.rawgRating}>
                <Ionicons name="star" size={11} color={Colors.warning} />
                <Text variant="label" color={Colors.warning}>
                  {' '}
                  {game.rating.toFixed(1)}
                  {game.ratings_count > 0 ? ` (${formatRatingCount(game.ratings_count)} ratings)` : ''}
                </Text>
              </View>
            )}
          </View>
          {platforms.length > 0 && (
            <View style={styles.platformRow}>
              {platforms.map(p => (
                <View key={p} style={styles.platformChip}>
                  <Text variant="label">{p}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

// InfoSection

interface InfoProps {
  description: string
  genres: { id: number; name: string; slug: string }[]
  redditUrl: string | null
}

function InfoSection({ description, genres, redditUrl }: InfoProps) {
  const [expanded, setExpanded] = useState(false)
  const trimmed = description.trim()
  const subredditUrl = getRedditUrl(redditUrl)
  const subredditLabel = getRedditLabel(redditUrl)

  return (
    <View style={styles.section}>
      {(genres.length > 0 || subredditUrl != null) && (
        <View style={styles.genreHeader}>
          <View style={styles.genreRow}>
            {genres.map(g => (
              <View key={g.id} style={styles.genreChip}>
                <Text variant="label" color={Colors.primary}>{g.name}</Text>
              </View>
            ))}
          </View>
          {subredditUrl != null && subredditLabel != null && (
            <Pressable
              style={styles.subredditButton}
              onPress={() => void openExternalUrl(subredditUrl)}
            >
              <Ionicons name="logo-reddit" size={14} color={REDDIT_ORANGE} />
              <Text variant="label" color={REDDIT_ORANGE}>{subredditLabel}</Text>
            </Pressable>
          )}
        </View>
      )}
      {trimmed.length > 0 && (
        <>
          <Text
            variant="body"
            numberOfLines={expanded ? undefined : 3}
            style={styles.description}
          >
            {trimmed}
          </Text>
          <Pressable onPress={() => setExpanded(e => !e)} hitSlop={8} style={styles.readMoreBtn}>
            <Text variant="label" color={Colors.primary}>
              {expanded ? 'Show less' : 'Read more'}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  )
}

// ScreenshotGallery

interface GalleryProps { gameId: number }

function ScreenshotGallery({ gameId }: GalleryProps) {
  const screenshotsQuery = useGameScreenshots(gameId)
  const screenshots = screenshotsQuery.data?.results ?? []
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  return (
    <View style={styles.section}>
      <Text variant="subheading" style={styles.sectionTitle}>Screenshots</Text>
      {screenshotsQuery.isLoading ? (
        <SectionLoading label="Loading screenshots..." />
      ) : screenshotsQuery.isError ? (
        <SectionMessage label="Could not load screenshots." />
      ) : screenshots.length === 0 ? (
        <SectionMessage label="No screenshots found." />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.screenshotsRow}
        >
          {screenshots.map((shot, i) => (
            <Pressable key={shot.id} onPress={() => setSelectedIndex(i)}>
              <Image
                source={{ uri: shot.image }}
                style={styles.screenshotThumb}
                contentFit="cover"
                cachePolicy="disk"
                transition={200}
              />
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Modal
        visible={selectedIndex != null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedIndex(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedIndex(null)} />
          {selectedIndex != null && screenshots[selectedIndex] != null && (
            <Image
              source={{ uri: screenshots[selectedIndex].image }}
              style={styles.fullscreenShot}
              contentFit="contain"
              cachePolicy="disk"
            />
          )}
          <Pressable
            style={styles.modalCloseBtn}
            onPress={() => setSelectedIndex(null)}
            hitSlop={12}
          >
            <Ionicons name="close-circle" size={34} color={Colors.textPrimary} />
          </Pressable>
        </View>
      </Modal>
    </View>
  )
}

// RelatedContent

interface GameRailProps {
  title: string
  games: RawgGame[]
  isLoading: boolean
  isError: boolean
}

function GameRail({ title, games, isLoading, isError }: GameRailProps) {
  return (
    <View style={styles.relatedRail}>
      <Text variant="label" style={styles.railTitle}>{title}</Text>
      {isLoading ? (
        <SectionLoading label={`Loading ${title.toLowerCase()}...`} />
      ) : isError ? (
        <SectionMessage label={`Could not load ${title.toLowerCase()}.`} />
      ) : games.length === 0 ? (
        <SectionMessage label={`No ${title.toLowerCase()} found.`} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.moreGamesRow}
        >
          {games.map(game => (
            <GameCard key={game.id} game={game} style={styles.moreGameCard} />
          ))}
        </ScrollView>
      )}
    </View>
  )
}

interface RelatedGamesProps {
  gameId: number
}

function RelatedGamesSection({ gameId }: RelatedGamesProps) {
  const additions = useGameAdditions(gameId)
  const series = useGameSeries(gameId)

  return (
    <View style={styles.section}>
      <Text variant="subheading" style={styles.sectionTitle}>DLCs & Series</Text>
      <GameRail
        title="DLCs and editions"
        games={additions.data?.results ?? []}
        isLoading={additions.isLoading}
        isError={additions.isError}
      />
      <GameRail
        title="Same series"
        games={series.data?.results ?? []}
        isLoading={series.isLoading}
        isError={series.isError}
      />
    </View>
  )
}

// Trailers

interface TrailerCardProps {
  movie: RawgMovie
}

function TrailerCard({ movie }: TrailerCardProps) {
  const movieUrl = getPlayableMovieUrl(movie)
  const disabled = movieUrl == null

  return (
    <Pressable
      style={[styles.trailerCard, disabled && styles.disabledCard]}
      onPress={() => {
        if (movieUrl != null) void openExternalUrl(movieUrl)
      }}
      disabled={disabled}
    >
      <View style={styles.trailerPreview}>
        <Image
          source={movie.preview !== '' ? { uri: movie.preview } : null}
          style={styles.trailerImage}
          contentFit="cover"
          cachePolicy="disk"
          transition={200}
        />
        <View style={styles.playBadge}>
          <Ionicons name="play" size={18} color={Colors.textPrimary} />
        </View>
      </View>
      <Text variant="body" numberOfLines={2} style={styles.trailerTitle}>
        {movie.name}
      </Text>
    </Pressable>
  )
}

function TrailersSection({ gameId }: RelatedGamesProps) {
  const movies = useGameMovies(gameId)
  const trailers = movies.data?.results ?? []

  return (
    <View style={styles.section}>
      <Text variant="subheading" style={styles.sectionTitle}>Trailers</Text>
      {movies.isLoading ? (
        <SectionLoading label="Loading trailers..." />
      ) : movies.isError ? (
        <SectionMessage label="Could not load trailers." />
      ) : trailers.length === 0 ? (
        <SectionMessage label="No trailers found." />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.trailersRow}
        >
          {trailers.map(movie => (
            <TrailerCard key={movie.id} movie={movie} />
          ))}
        </ScrollView>
      )}
    </View>
  )
}

// PersonalTracking

interface TrackingProps { entry: LibraryEntry }

function PersonalTracking({ entry }: TrackingProps) {
  const updateMutation = useUpdateLibraryEntry()

  const [rating, setRating] = useState<number | null>(
    entry.personal_rating != null ? Number(entry.personal_rating) : null
  )
  const [playtimeHours, setPlaytimeHours] = useState(
    entry.personal_playtime_minutes != null
      ? (entry.personal_playtime_minutes / 60).toFixed(1)
      : ''
  )
  const [notes, setNotes] = useState(entry.personal_notes ?? '')
  const [startedAt, setStartedAt] = useState(entry.started_at ?? '')
  const [finishedAt, setFinishedAt] = useState(entry.finished_at ?? '')

  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (notesTimerRef.current != null) clearTimeout(notesTimerRef.current)
  }, [])

  useEffect(() => {
    setStartedAt(entry.started_at ?? '')
    setFinishedAt(entry.finished_at ?? '')
  }, [entry.finished_at, entry.started_at])

  function handleRatingChange(v: number | null) {
    setRating(v)
    updateMutation.mutate({ id: entry.id, personal_rating: v })
  }

  function handlePlaytimeBlur() {
    const hours = parseFloat(playtimeHours)
    if (playtimeHours === '' || isNaN(hours) || hours < 0) {
      setPlaytimeHours(
        entry.personal_playtime_minutes != null
          ? (entry.personal_playtime_minutes / 60).toFixed(1)
          : ''
      )
      return
    }
    updateMutation.mutate({ id: entry.id, personal_playtime_minutes: Math.round(hours * 60) })
  }

  function handleNotesChange(text: string) {
    setNotes(text)
    if (notesTimerRef.current != null) clearTimeout(notesTimerRef.current)
    notesTimerRef.current = setTimeout(() => {
      updateMutation.mutate({
        id: entry.id,
        personal_notes: text.trim() === '' ? null : text,
      })
    }, 500)
  }

  function handleStartedChange(value: string) {
    setStartedAt(value)
    updateMutation.mutate({ id: entry.id, started_at: value === '' ? null : value })
  }

  function handleFinishedChange(value: string) {
    setFinishedAt(value)
    updateMutation.mutate({ id: entry.id, finished_at: value === '' ? null : value })
  }

  return (
    <View style={styles.trackingSection}>
      <View style={styles.trackingHeader}>
        <Text variant="subheading" style={styles.trackingTitle}>My Playthrough</Text>
        {updateMutation.isPending && (
          <View style={styles.savingBadge}>
            <Text variant="label" color={Colors.primary}>Saving</Text>
          </View>
        )}
      </View>

      <View style={styles.trackingCard}>
        <View style={styles.ratingPanel}>
          <View style={styles.fieldHeader}>
            <Ionicons name="star-outline" size={17} color={Colors.warning} />
            <Text variant="label" style={styles.trackingLabel}>Personal Rating</Text>
          </View>
          <RatingInput value={rating} onChange={handleRatingChange} />
        </View>

        <View style={[styles.trackingGrid, Platform.OS !== 'web' && styles.trackingGridMobile]}>
          <View style={[styles.trackingField, Platform.OS !== 'web' && styles.trackingFieldMobile]}>
            <View style={styles.fieldHeader}>
              <Ionicons name="time-outline" size={17} color={Colors.textSecondary} />
              <Text variant="label" style={styles.trackingLabel}>Playtime</Text>
            </View>
            <View style={styles.inputShell}>
              <TextInput
                value={playtimeHours}
                onChangeText={setPlaytimeHours}
                onBlur={handlePlaytimeBlur}
                keyboardType="decimal-pad"
                style={styles.shortInput}
              />
              <Text variant="caption" style={styles.inputSuffix}>hours</Text>
            </View>
          </View>

          <View style={[styles.trackingDateStack, Platform.OS !== 'web' && styles.trackingDateStackMobile]}>
            <View style={[styles.trackingField, Platform.OS !== 'web' && styles.trackingFieldMobile]}>
              <View style={styles.fieldHeader}>
                <Ionicons name="flag-outline" size={17} color={Colors.textSecondary} />
                <Text variant="label" style={styles.trackingLabel}>Started</Text>
              </View>
              <View style={styles.inputShell}>
                <DateField
                  value={startedAt}
                  onChange={handleStartedChange}
                />
              </View>
            </View>

            <View style={[styles.trackingField, Platform.OS !== 'web' && styles.trackingFieldMobile]}>
              <View style={styles.fieldHeader}>
                <Ionicons name="checkmark-done-outline" size={17} color={Colors.textSecondary} />
                <Text variant="label" style={styles.trackingLabel}>Finished</Text>
              </View>
              <View style={styles.inputShell}>
                <DateField
                  value={finishedAt}
                  onChange={handleFinishedChange}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.notesField}>
          <View style={styles.fieldHeader}>
            <Ionicons name="document-text-outline" size={17} color={Colors.textSecondary} />
            <Text variant="label" style={styles.trackingLabel}>Notes</Text>
          </View>
          <TextInput
            value={notes}
            onChangeText={handleNotesChange}
            placeholder="Write a few thoughts..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={4}
            style={styles.notesInput}
            textAlignVertical="top"
          />
        </View>
      </View>
    </View>
  )
}

// Main Screen

export default function GameDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const gameId = idParam != null && idParam !== '' ? parseInt(idParam, 10) : null
  const safeGameId = gameId != null && !isNaN(gameId) ? gameId : null

  const { data: game, isLoading, isError } = useGameDetail(safeGameId)
  const entry = useLibraryEntry(safeGameId)

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <LoadingSpinner />
      </View>
    )
  }

  if (isError || game == null) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <EmptyState
          icon="alert-circle-outline"
          heading="Couldn't load game"
          subtext="Check your connection and try again."
          ctaLabel="Go back"
          onCta={() => router.back()}
        />
      </View>
    )
  }

  const gameForButton = {
    id: game.id,
    name: game.name,
    background_image: game.background_image,
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false, title: game.name }} />

      {/* Floating back button */}
      <Pressable
        style={[styles.backOverlay, { top: insets.top + Spacing.sm }]}
        onPress={() => router.back()}
        hitSlop={12}
      >
        <View style={styles.backCircle}>
          <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
        </View>
      </Pressable>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 72 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <HeroSection game={game} />

        <View style={styles.body}>
          <InfoSection
            description={game.description_raw}
            genres={game.genres ?? []}
            redditUrl={game.reddit_url}
          />
          <ScreenshotGallery gameId={game.id} />
          <TrailersSection gameId={game.id} />
          {entry != null && <PersonalTracking entry={entry} />}
          <RelatedGamesSection gameId={game.id} />
          <RawgFooter />
        </View>
      </ScrollView>

      {/* Sticky bottom action bar */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.md }]}>
        <View style={styles.actionBarInner}>
          <View style={styles.actionBarGame}>
            <Text variant="body" numberOfLines={1} style={styles.actionBarTitle}>
              {game.name}
            </Text>
            {(game.developers ?? []).length > 0 && (
              <Text variant="caption" numberOfLines={1}>
                {(game.developers ?? [])[0].name}
              </Text>
            )}
          </View>
          <AddToLibraryButton game={gameForButton} />
        </View>
      </View>
    </View>
  )
}

// Styles

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },

  // Hero
  hero: {
    height: 300,
    justifyContent: 'flex-end',
    backgroundColor: Colors.surface,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  coverArt: {
    width: 100,
    height: 140,
    borderRadius: 8,
    backgroundColor: Colors.surfaceRaised,
    flexShrink: 0,
  },
  heroInfo: {
    flex: 1,
    gap: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  heroTitle: {
    fontSize: 20,
    lineHeight: 26,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  comingSoonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metacriticBadge: {
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: Colors.background,
  },
  rawgRating: {
    flexDirection: 'row',
  },
  platformRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  platformChip: {
    backgroundColor: Colors.surfaceRaised,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },

  // Body
  body: {
    gap: 0,
  },
  section: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    fontSize: 18,
  },
  sectionState: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  genreHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  genreRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  genreChip: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  description: {
    lineHeight: 22,
    marginBottom: Spacing.xs,
  },
  readMoreBtn: {
    marginTop: 2,
  },

  // Screenshots
  screenshotsRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  screenshotThumb: {
    width: 220,
    height: 130,
    borderRadius: 8,
    backgroundColor: Colors.surfaceRaised,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenShot: {
    width: '100%',
    height: '70%',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: Spacing.xl,
    right: Spacing.md,
  },

  // Related content
  relatedRail: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  railTitle: {
    color: Colors.textSecondary,
  },
  disabledCard: {
    opacity: 0.62,
  },

  // Trailers
  trailersRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  trailerCard: {
    width: 260,
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  trailerPreview: {
    position: 'relative',
    backgroundColor: Colors.surfaceRaised,
  },
  trailerImage: {
    width: '100%',
    height: 146,
    backgroundColor: Colors.surfaceRaised,
  },
  playBadge: {
    position: 'absolute',
    left: Spacing.sm,
    bottom: Spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,82,255,0.88)',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trailerTitle: {
    minHeight: 44,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    fontFamily: FontFamily.medium,
  },

  // Reddit
  subredditButton: {
    minHeight: 32,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,69,0,0.42)',
    borderRadius: Radius.pill,
    backgroundColor: 'transparent',
    paddingHorizontal: Spacing.sm,
  },

  // Personal Tracking
  trackingSection: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  trackingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  trackingTitle: {
    fontSize: 18,
  },
  savingBadge: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,82,255,0.12)',
  },
  trackingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  trackingLabel: {
    color: Colors.textPrimary,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  ratingPanel: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  trackingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  trackingGridMobile: {
    alignItems: 'flex-start',
    flexWrap: 'nowrap',
  },
  trackingField: {
    flexGrow: 1,
    flexBasis: 150,
    gap: Spacing.xs,
  },
  trackingFieldMobile: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  trackingDateStack: {
    flexGrow: 2,
    flexBasis: 312,
    flexDirection: 'row',
    flexWrap: 'wrap',
    minWidth: 0,
    gap: Spacing.sm,
  },
  trackingDateStackMobile: {
    flex: 1,
    flexBasis: 0,
    flexDirection: 'column',
    flexWrap: 'nowrap',
    minWidth: 0,
    gap: Spacing.sm,
  },
  inputShell: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
  },
  shortInput: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.textPrimary,
    flex: 1,
    minWidth: 0,
    paddingVertical: Spacing.xs,
  },
  inputSuffix: {
    color: Colors.textMuted,
    flexShrink: 0,
  },
  notesField: {
    gap: Spacing.xs,
  },
  notesInput: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 118,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    lineHeight: 21,
  },

  // More Like This
  moreGamesRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  moreGameCard: {
    width: 160,
  },

  // Back button overlay
  backOverlay: {
    position: 'absolute',
    left: Spacing.md,
    zIndex: 10,
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(13,13,15,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Sticky action bar
  actionBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  actionBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  actionBarGame: {
    flex: 1,
    gap: 2,
  },
  actionBarTitle: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
  },

  // Error fallback back button (not needed since EmptyState has CTA, kept for safety)
  backFallback: {
    marginTop: Spacing.md,
  },
})
