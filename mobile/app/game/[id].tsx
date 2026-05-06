import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import { Text } from '@/components/ui/Text'
import { LoadingSpinner, EmptyState } from '@/components/ui'
import { AddToLibraryButton } from '@/components/AddToLibraryButton'
import { GameCard } from '@/components/GameCard'
import { RawgFooter } from '@/components/RawgFooter'

import { useGameDetail, useSuggestedGames } from '@/hooks/useRawg'
import { useLibraryEntry, useUpdateLibraryEntry } from '@/hooks/useLibrary'

import { Colors, Spacing } from '@/constants'
import type { LibraryEntry } from '@/types/database'
import type { RawgGameDetail, RawgScreenshot } from '@/types/rawg'

// â”€â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ HeroSection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface HeroProps { game: RawgGameDetail }

function HeroSection({ game }: HeroProps) {
  const year = game.released != null ? game.released.split('-')[0] : null
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
            {year != null && <Text variant="caption">{year}</Text>}
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
                <Text variant="label" color={Colors.warning}> {game.rating.toFixed(1)}</Text>
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

// â”€â”€â”€ InfoSection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface InfoProps {
  description: string
  genres: { id: number; name: string; slug: string }[]
}

function InfoSection({ description, genres }: InfoProps) {
  const [expanded, setExpanded] = useState(false)
  const trimmed = description.trim()

  return (
    <View style={styles.section}>
      {genres.length > 0 && (
        <View style={styles.genreRow}>
          {genres.map(g => (
            <View key={g.id} style={styles.genreChip}>
              <Text variant="label" color={Colors.primary}>{g.name}</Text>
            </View>
          ))}
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

// â”€â”€â”€ ScreenshotGallery â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface GalleryProps { screenshots: RawgScreenshot[] }

function ScreenshotGallery({ screenshots }: GalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  if (screenshots.length === 0) return null

  return (
    <View style={styles.section}>
      <Text variant="subheading" style={styles.sectionTitle}>Screenshots</Text>
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

      <Modal
        visible={selectedIndex != null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedIndex(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedIndex(null)} />
          {selectedIndex != null && (
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

// â”€â”€â”€ RatingInput â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface RatingInputProps {
  value: number | null
  onChange: (v: number | null) => void
}

function RatingInput({ value, onChange }: RatingInputProps) {
  function increment() {
    const next = Math.min(10, Math.round(((value ?? 0) + 0.5) * 10) / 10)
    onChange(next)
  }
  function decrement() {
    if (value == null) return
    const next = Math.round((value - 0.5) * 10) / 10
    onChange(next <= 0 ? null : next)
  }

  return (
    <View style={styles.ratingRow}>
      <Pressable onPress={decrement} hitSlop={8} style={styles.ratingBtn}>
        <Ionicons name="remove-circle-outline" size={26} color={Colors.textSecondary} />
      </Pressable>
      <Pressable onPress={() => onChange(null)} hitSlop={4} style={styles.ratingDisplay}>
        <Text
          variant="subheading"
          color={value != null ? Colors.warning : Colors.textMuted}
          style={styles.ratingValue}
        >
          {value != null ? value.toFixed(1) : 'â€”'}
        </Text>
        <Text variant="caption">/ 10  Â·  tap to clear</Text>
      </Pressable>
      <Pressable onPress={increment} hitSlop={8} style={styles.ratingBtn}>
        <Ionicons name="add-circle-outline" size={26} color={Colors.textSecondary} />
      </Pressable>
    </View>
  )
}

// â”€â”€â”€ PersonalTracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

  function handleStartedBlur() {
    if (startedAt === '' || DATE_REGEX.test(startedAt)) {
      updateMutation.mutate({ id: entry.id, started_at: startedAt === '' ? null : startedAt })
    } else {
      setStartedAt(entry.started_at ?? '')
    }
  }

  function handleFinishedBlur() {
    if (finishedAt === '' || DATE_REGEX.test(finishedAt)) {
      updateMutation.mutate({ id: entry.id, finished_at: finishedAt === '' ? null : finishedAt })
    } else {
      setFinishedAt(entry.finished_at ?? '')
    }
  }

  return (
    <View style={styles.trackingSection}>
      <Text variant="subheading" style={styles.sectionTitle}>My Playthrough</Text>

      <View style={styles.trackingCard}>
        {/* Rating */}
        <View style={styles.trackingRow}>
          <Text variant="caption" style={styles.trackingLabel}>Personal Rating</Text>
          <RatingInput value={rating} onChange={handleRatingChange} />
        </View>

        <View style={styles.trackingDivider} />

        {/* Playtime */}
        <View style={styles.trackingRow}>
          <Text variant="caption" style={styles.trackingLabel}>Playtime (hours)</Text>
          <TextInput
            value={playtimeHours}
            onChangeText={setPlaytimeHours}
            onBlur={handlePlaytimeBlur}
            placeholder="e.g. 12.5"
            placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad"
            style={styles.shortInput}
          />
        </View>

        <View style={styles.trackingDivider} />

        {/* Dates */}
        <View style={styles.datesRow}>
          <View style={styles.dateField}>
            <Text variant="caption" style={styles.trackingLabel}>Started</Text>
            <TextInput
              value={startedAt}
              onChangeText={setStartedAt}
              onBlur={handleStartedBlur}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
              style={styles.shortInput}
            />
          </View>
          <View style={styles.dateField}>
            <Text variant="caption" style={styles.trackingLabel}>Finished</Text>
            <TextInput
              value={finishedAt}
              onChangeText={setFinishedAt}
              onBlur={handleFinishedBlur}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
              style={styles.shortInput}
            />
          </View>
        </View>

        <View style={styles.trackingDivider} />

        {/* Notes */}
        <View>
          <Text variant="caption" style={styles.trackingLabel}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={handleNotesChange}
            placeholder="Your thoughts, strategies, memorable moments..."
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

// â”€â”€â”€ MoreLikeThis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface MoreLikeThisProps { gameId: number }

function MoreLikeThis({ gameId }: MoreLikeThisProps) {
  const { data } = useSuggestedGames(gameId)
  const games = data?.results ?? []
  if (games.length === 0) return null

  return (
    <View style={styles.section}>
      <Text variant="subheading" style={styles.sectionTitle}>More Like This</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.moreGamesRow}
      >
        {games.slice(0, 10).map(game => (
          <GameCard key={game.id} game={game} style={styles.moreGameCard} />
        ))}
      </ScrollView>
    </View>
  )
}

// â”€â”€â”€ Main Screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
          <InfoSection description={game.description_raw} genres={game.genres ?? []} />
          <ScreenshotGallery screenshots={game.short_screenshots ?? []} />
          {entry != null && <PersonalTracking entry={entry} />}
          <MoreLikeThis gameId={game.id} />
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

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  metacriticBadge: {
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: Colors.background,
  },
  rawgRating: {
    flexDirection: 'row',
    alignItems: 'center',
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
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
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

  // Personal Tracking
  trackingSection: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  trackingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  trackingLabel: {
    flex: 1,
  },
  trackingDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  datesRow: {
    flexDirection: 'row',
  },
  dateField: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  shortInput: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.textPrimary,
    minWidth: 100,
    textAlign: 'right',
  },
  notesInput: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 100,
    padding: Spacing.md,
    paddingTop: Spacing.sm,
  },

  // Rating
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  ratingBtn: {
    padding: 2,
  },
  ratingDisplay: {
    alignItems: 'center',
    minWidth: 70,
  },
  ratingValue: {
    fontSize: 22,
    lineHeight: 28,
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
