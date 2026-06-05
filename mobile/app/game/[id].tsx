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
import { SmallGameCard } from '@/components/GameDisplayCards'
import { RawgFooter } from '@/components/RawgFooter'
import { RatingInput } from '@/components/RatingInput'

import {
  useGameAdditions,
  useGameDetail,
  useGameScreenshots,
  useGameSeries,
} from '@/hooks/useRawg'
import { useLibraryEntry, useUpdateLibraryEntry } from '@/hooks/useLibrary'
import { useSteamAppId } from '@/hooks/useSteam'
import { useNewsGame, useNewsGameArticles } from '@/hooks/useNewsForGame'
import type { NewsItem } from '@/hooks/useNews'

import { Colors, Radius, Spacing } from '@/constants'
import { formatRatingCount } from '@/lib/rating'
import { formatPubDate, isUpcomingRelease } from '@/lib/dates'
import { getSteamStoreUrl } from '@/lib/steam'
import type { LibraryEntry } from '@/types/database'
import type { RawgGame, RawgGameDetail } from '@/types/rawg'

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

const STEAM_BLUE = '#66c0f4'

function metacriticColor(score: number): string {
  if (score >= 75) return Colors.success
  if (score >= 60) return Colors.warning
  return Colors.error
}

function getMetacriticBadgeStyle(score: number) {
  if (score >= 75) return styles.heroBadgeHigh
  if (score >= 60) return styles.heroBadgeMid
  return styles.heroBadgeLow
}

interface ReleaseDateInfo {
  label: string
  isFuture: boolean
}

function getReleaseDateInfo(released: string | null): ReleaseDateInfo | null {
  if (released == null) {
    return {
      label: 'soon',
      isFuture: true,
    }
  }
  const [year, month, day] = released.split('-')
  const monthIndex = Number(month) - 1
  const dayNumber = Number(day)
  const yearNumber = Number(year)
  if (year == null || month == null || day == null) return null
  if (monthIndex < 0 || monthIndex >= MONTH_NAMES.length) return null
  if (isNaN(yearNumber) || isNaN(dayNumber)) return null

  return {
    label: `${MONTH_NAMES[monthIndex]} ${dayNumber}, ${year}`,
    isFuture: isUpcomingRelease(released),
  }
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
  const developerLabel = (game.developers ?? []).map(d => d.name).join(', ')
  const publisherLabel = (game.publishers ?? []).map(p => p.name).join(', ')
  const platforms = (game.platforms ?? [])
    .map(p => PLATFORM_LABELS[p.platform.slug])
    .filter((p): p is string => p !== undefined)
    .slice(0, 5)
  const hiddenPlatformCount = Math.max((game.platforms ?? []).length - platforms.length, 0)
  const hasRating = game.rating > 0
  const hasMetaLine = releaseDate != null || developerLabel !== '' || publisherLabel !== ''

  return (
    <View style={styles.hero}>
      {game.background_image != null && (
        <View style={styles.heroArtworkFrame}>
          <Image
            source={{ uri: game.background_image }}
            style={styles.heroArtwork}
            contentFit="cover"
            cachePolicy="disk"
            transition={200}
          />
          <LinearGradient
            colors={['rgba(10,11,13,0.02)', 'rgba(10,11,13,0.36)', 'rgba(10,11,13,0.9)']}
            locations={[0, 0.56, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}
      <View style={styles.heroContent}>
        <View style={styles.heroImageCopy}>
          <Text variant="heading" numberOfLines={4} style={styles.heroTitle}>
            {game.name}
          </Text>
          {hasMetaLine && (
            <Text variant="caption" numberOfLines={2} style={styles.heroSubtitle}>
              {[
                releaseDate?.isFuture === true ? `Coming ${releaseDate.label}` : releaseDate?.label,
                developerLabel !== '' ? developerLabel : null,
                publisherLabel !== '' && developerLabel === '' ? publisherLabel : null,
              ]
                .filter(Boolean)
                .join('  /  ')}
            </Text>
          )}
        </View>
        {(game.metacritic != null || hasRating || platforms.length > 0) && (
          <View style={styles.heroMetaRows}>
            {(game.metacritic != null || hasRating) && (
              <View style={styles.heroBadgeRow}>
                {game.metacritic != null && (
                  <View style={[styles.heroBadge, getMetacriticBadgeStyle(game.metacritic)]}>
                    <Text
                      variant="mono"
                      color={metacriticColor(game.metacritic)}
                      style={styles.heroBadgeNumber}
                    >
                      {game.metacritic}
                    </Text>
                    <Text variant="label" color={metacriticColor(game.metacritic)}>
                      Meta
                    </Text>
                  </View>
                )}
                {hasRating && (
                  <View style={styles.heroBadge}>
                    <Ionicons name="star" size={14} color={Colors.rawg} />
                    <Text variant="mono" color={Colors.textPrimary} style={styles.heroBadgeNumber}>
                      {game.rating.toFixed(1)}
                    </Text>
                    <Text variant="label">
                      {game.ratings_count > 0 ? formatRatingCount(game.ratings_count) : 'RAWG'}
                    </Text>
                  </View>
                )}
              </View>
            )}
            {platforms.length > 0 && (
              <View style={styles.platformRow}>
                {platforms.map(p => (
                  <View key={p} style={styles.platformChip}>
                    <Text variant="label">{p}</Text>
                  </View>
                ))}
                {hiddenPlatformCount > 0 && (
                  <View style={styles.platformChip}>
                    <Text variant="label">+{hiddenPlatformCount}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  )
}

// InfoSection

interface InfoProps {
  description: string
  genres: { id: number; name: string; slug: string }[]
  steamAppId: number | null
  steamLoading: boolean
}

function InfoSection({ description, genres, steamAppId, steamLoading }: InfoProps) {
  const [expanded, setExpanded] = useState(false)
  const trimmed = description.trim()
  const steamUrl = steamAppId != null ? getSteamStoreUrl(steamAppId) : null
  const hasExternalLinks = steamUrl != null || steamLoading
  const hasInfoMeta = genres.length > 0 || hasExternalLinks
  const shouldClamp = trimmed.length > 280

  return (
    <View style={[styles.section, styles.infoSection]}>
      {trimmed.length > 0 && (
        <View style={styles.descriptionBlock}>
          <Text variant="body" numberOfLines={expanded ? undefined : 3} style={styles.description}>
            {trimmed}
          </Text>
          {shouldClamp && (
            <Pressable
              onPress={() => setExpanded(e => !e)}
              hitSlop={8}
              style={styles.readMoreBtn}
            >
              <Text variant="label" color={Colors.primary}>
                {expanded ? 'Show less' : 'Read more'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {hasInfoMeta && (
        <View style={styles.infoMeta}>
          {genres.length > 0 && (
            <View style={styles.genreRow}>
              {genres.map(g => (
                <View key={g.id} style={styles.genreChip}>
                  <Text variant="label" color={Colors.primary}>
                    {g.name}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {hasExternalLinks && (
            <View style={styles.externalLinkRow}>
              {steamUrl != null ? (
                <Pressable
                  style={[styles.linkButton, styles.steamButton]}
                  onPress={() => void openExternalUrl(steamUrl)}
                >
                  <Ionicons name="logo-steam" size={14} color={STEAM_BLUE} />
                  <Text variant="label" color={STEAM_BLUE}>
                    Steam
                  </Text>
                </Pressable>
              ) : steamLoading ? (
                <View style={[styles.linkButton, styles.steamButton]}>
                  <ActivityIndicator size="small" color={STEAM_BLUE} />
                  <Text variant="label" color={STEAM_BLUE}>
                    Steam
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
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

// GameNewsSection
function NewsArticleRow({ item }: { item: NewsItem }) {
  async function handlePress() {
    await openExternalUrl(item.link)
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.newsRow, pressed && styles.newsRowPressed]}
      onPress={() => void handlePress()}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <View style={styles.newsRowContent}>
        <Text variant="body" style={styles.newsTitle} numberOfLines={5}>
          {item.title}
        </Text>
        <View style={styles.newsMeta}>
          <Text variant="caption" color={Colors.primary}>{item.sourceName}</Text>
          {item.pubDate != null && item.pubDate !== '' && (
            <>
              <Text variant="caption" color={Colors.textMuted}>·</Text>
              <Text variant="caption" color={Colors.textMuted}>{formatPubDate(item.pubDate, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
            </>
          )}
        </View>
      </View>
      <Ionicons name="open-outline" size={14} color={Colors.textMuted} />
    </Pressable>
  )
}

interface GameNewsSectionProps { slug: string }

function GameNewsSection({ slug }: GameNewsSectionProps) {
  const newsGameQuery = useNewsGame(slug)
  const gameId = newsGameQuery.data?.id
  const articlesQuery = useNewsGameArticles(gameId)
  const articles = (articlesQuery.data ?? []).slice(0, 5)

  if (newsGameQuery.isLoading || articlesQuery.isLoading) return null
  if (articles.length === 0) return null

  return (
    <View style={styles.section}>
      <View style={styles.newsSectionHeader}>
        <Text variant="subheading" style={styles.sectionTitle}>Trending News</Text>
        <Pressable
          onPress={() => router.push(`/news/game/${slug}` as never)}
          hitSlop={8}
        >
          <Text variant="label" color={Colors.primary}>See all</Text>
        </Pressable>
      </View>
      <View style={styles.newsList}>
        {articles.map(item => (
          <NewsArticleRow key={item.id} item={item} />
        ))}
      </View>
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
            <SmallGameCard key={game.id} game={game} style={styles.moreGameCard} />
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
            <Ionicons name="star-outline" size={17} color={Colors.personal} />
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
  const steamQuery = useSteamAppId(game?.id ?? null, game?.name ?? null)
  const steamAppId = steamQuery.data ?? null
  const actionBarBottomPadding =
    Platform.OS === 'android'
      ? Math.max(insets.bottom, Spacing.xl) + Spacing.xs
      : Math.max(insets.bottom, Spacing.lg)

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
    released: game.released,
    platforms: game.platforms,
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
        contentContainerStyle={{ paddingBottom: actionBarBottomPadding }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <HeroSection game={game} />

        <View style={styles.body}>
          <InfoSection
            description={game.description_raw}
            genres={game.genres ?? []}
            steamAppId={steamAppId}
            steamLoading={steamQuery.isLoading}
          />
          <ScreenshotGallery gameId={game.id} />
          {entry != null && <PersonalTracking entry={entry} />}
          <GameNewsSection slug={game.slug} />
          <RelatedGamesSection gameId={game.id} />
          <RawgFooter />
        </View>
      </ScrollView>

      {/* Sticky bottom action bar */}
      <View style={[styles.actionBar, { paddingBottom: actionBarBottomPadding }]}>
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
    minHeight: Platform.OS === 'web' ? 540 : 500,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  heroArtworkFrame: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: Platform.OS === 'web' ? 120 : 132,
    left: 0,
    backgroundColor: Colors.surface,
  },
  heroArtwork: {
    width: '100%',
    height: '100%',
  },
  heroContent: {
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  coverColumn: {
    flexShrink: 0,
  },
  coverArt: {
    width: Platform.OS === 'web' ? 142 : 112,
    height: Platform.OS === 'web' ? 196 : 156,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  coverArtPlaceholder: {
    width: Platform.OS === 'web' ? 142 : 112,
    height: Platform.OS === 'web' ? 196 : 156,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
    flexShrink: 0,
  },
  heroInfo: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.sm,
  },
  heroImageCopy: {
    minWidth: 0,
    gap: Spacing.sm,
    maxWidth: 760,
  },
  heroTitle: {
    fontSize: Platform.OS === 'web' ? 36 : 29,
    lineHeight: Platform.OS === 'web' ? 40 : 32,
    maxWidth: 720,
  },
  heroSubtitle: {
    maxWidth: 620,
  },
  heroMetaRows: {
    minHeight: Platform.OS === 'web' ? 84 : 84,
    gap: Spacing.xs,
    justifyContent: 'flex-start',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  heroBadge: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.background,
  },
  heroBadgeHigh: {
    borderColor: 'rgba(5,177,105,0.38)',
  },
  heroBadgeMid: {
    borderColor: 'rgba(244,176,0,0.4)',
  },
  heroBadgeLow: {
    borderColor: 'rgba(207,32,47,0.42)',
  },
  heroBadgeNumber: {
    fontSize: 13,
    lineHeight: 17,
  },
  platformRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  platformChip: {
    minHeight: 24,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xs,
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
  infoSection: {
    gap: Spacing.sm,
    paddingTop: 0,
    paddingBottom: Spacing.lg,
  },
  descriptionBlock: {
    gap: Spacing.xs,
    maxWidth: 760,
  },
  infoMeta: {
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  externalLinkRow: {
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
  },
  readMoreBtn: {
    alignSelf: 'flex-start',
    minHeight: 28,
    justifyContent: 'center',
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

  // External links
  linkButton: {
    minHeight: 32,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.pill,
    backgroundColor: 'transparent',
    paddingHorizontal: Spacing.sm,
  },
  steamButton: {
    borderColor: 'rgba(102,192,244,0.42)',
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
    flexDirection: 'column',
    alignItems: 'stretch',
    flexWrap: 'nowrap',
  },
  trackingField: {
    flexGrow: 1,
    flexBasis: 150,
    gap: Spacing.xs,
  },
  trackingFieldMobile: {
    width: '100%',
    flexBasis: 'auto',
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
    width: '100%',
    flexBasis: 'auto',
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

  // News section
  newsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  newsList: {
    gap: 2,
  },
  newsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  newsRowPressed: {
    opacity: 0.7,
  },
  newsRowContent: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  newsTitle: {
    fontSize: 14,
    lineHeight: 19,
  },
  newsMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
