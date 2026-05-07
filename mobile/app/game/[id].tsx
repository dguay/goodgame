import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  PanResponder,
  Platform,
  type GestureResponderEvent,
  type LayoutChangeEvent,
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

// helpers

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

// HeroSection

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

// InfoSection

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

// ScreenshotGallery

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

// RatingInput

interface RatingInputProps {
  value: number | null
  onChange: (v: number | null) => void
}

function normalizeRating(value: number): number {
  const clamped = Math.min(10, Math.max(0, value))
  return Math.round(clamped * 2) / 2
}

function RatingInput({ value, onChange }: RatingInputProps) {
  const [trackWidth, setTrackWidth] = useState(0)
  const [draftValue, setDraftValue] = useState(value != null ? value.toFixed(1) : '')
  const ratingValue = value ?? 0
  const ratingPercent = ratingValue / 10
  const fillFlex = Math.max(0.001, ratingPercent)
  const emptyFlex = Math.max(0.001, 1 - ratingPercent)

  useEffect(() => {
    setDraftValue(value != null ? value.toFixed(1) : '')
  }, [value])

  const setFromLocation = useCallback((event: GestureResponderEvent) => {
    if (trackWidth <= 0) return
    const next = normalizeRating((event.nativeEvent.locationX / trackWidth) * 10)
    onChange(next)
  }, [onChange, trackWidth])

  const sliderResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: setFromLocation,
        onPanResponderMove: setFromLocation,
      }),
    [setFromLocation]
  )

  function handleTrackLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width)
  }

  function commitDraftValue() {
    const trimmed = draftValue.trim()
    if (trimmed === '') {
      onChange(null)
      return
    }

    const parsed = Number(trimmed)
    if (Number.isNaN(parsed)) {
      setDraftValue(value != null ? value.toFixed(1) : '')
      return
    }

    const next = normalizeRating(parsed)
    setDraftValue(next.toFixed(1))
    onChange(next)
  }

  return (
    <View style={styles.ratingRow}>
      <View
        style={styles.ratingSlider}
        onLayout={handleTrackLayout}
        {...sliderResponder.panHandlers}
      >
        <View style={styles.ratingTrack}>
          <View style={[styles.ratingTrackFill, { flex: fillFlex }]} />
          <View style={[styles.ratingTrackEmpty, { flex: emptyFlex }]} />
        </View>
        <View style={styles.ratingTicks}>
          {Array.from({ length: 11 }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.ratingTick,
                index <= ratingValue && styles.ratingTickActive,
              ]}
            />
          ))}
        </View>
      </View>

      <View style={[styles.ratingInputGroup, Platform.OS === 'web' && styles.ratingInputGroupWeb]}>
        <TextInput
          value={draftValue}
          onChangeText={setDraftValue}
          onBlur={commitDraftValue}
          onSubmitEditing={commitDraftValue}
          keyboardType="decimal-pad"
          placeholder="-"
          placeholderTextColor={Colors.textMuted}
          selectTextOnFocus
          style={[
            styles.ratingValueInput,
            Platform.OS !== 'web' && styles.ratingValueInputNative,
          ]}
        />
        {value != null && (
          <Pressable onPress={() => onChange(null)} hitSlop={8} style={styles.ratingClearBtn}>
            <Ionicons name="close" size={14} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>
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

        <View style={styles.trackingGrid}>
          <View style={styles.trackingField}>
            <View style={styles.fieldHeader}>
              <Ionicons name="time-outline" size={17} color={Colors.textSecondary} />
              <Text variant="label" style={styles.trackingLabel}>Playtime</Text>
            </View>
            <View style={styles.inputShell}>
              <TextInput
                value={playtimeHours}
                onChangeText={setPlaytimeHours}
                onBlur={handlePlaytimeBlur}
                placeholder="12.5"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                style={styles.shortInput}
              />
              <Text variant="caption" style={styles.inputSuffix}>hours</Text>
            </View>
          </View>

          <View style={styles.trackingField}>
            <View style={styles.fieldHeader}>
              <Ionicons name="flag-outline" size={17} color={Colors.textSecondary} />
              <Text variant="label" style={styles.trackingLabel}>Started</Text>
            </View>
            <View style={styles.inputShell}>
              <TextInput
                value={startedAt}
                onChangeText={setStartedAt}
                onBlur={handleStartedBlur}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                style={styles.shortInput}
              />
            </View>
          </View>

          <View style={styles.trackingField}>
            <View style={styles.fieldHeader}>
              <Ionicons name="checkmark-done-outline" size={17} color={Colors.textSecondary} />
              <Text variant="label" style={styles.trackingLabel}>Finished</Text>
            </View>
            <View style={styles.inputShell}>
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

// MoreLikeThis

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
  trackingField: {
    flexGrow: 1,
    flexBasis: 150,
    gap: Spacing.xs,
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

  // Rating
  ratingRow: {
    gap: Spacing.sm,
  },
  ratingSlider: {
    minHeight: 52,
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  ratingTrack: {
    height: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  ratingTrackFill: {
    backgroundColor: Colors.warning,
  },
  ratingTrackEmpty: {
    backgroundColor: Colors.background,
  },
  ratingTicks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 1,
  },
  ratingTick: {
    width: 2,
    height: 7,
    borderRadius: 1,
    backgroundColor: Colors.border,
  },
  ratingTickActive: {
    backgroundColor: Colors.warning,
  },
  ratingInputGroup: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.background,
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.xs,
  },
  ratingInputGroupWeb: {
    alignSelf: 'center',
    minHeight: 48,
  },
  ratingValueInput: {
    minWidth: 48,
    paddingVertical: 4,
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 19,
    lineHeight: 24,
    color: Colors.warning,
    textAlign: 'center',
  },
  ratingValueInputNative: {
    minWidth: 42,
    fontSize: 17,
    lineHeight: 22,
  },
  ratingMax: {
    color: Colors.textMuted,
  },
  ratingClearBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
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
