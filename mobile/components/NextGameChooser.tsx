import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Text } from '@/components/ui/Text'
import { Colors, FontFamily, Radius, Spacing } from '@/constants'
import { formatDate } from '@/lib/releaseDates'
import { STATUS_COLORS } from '@/types'
import type { LibraryEntry } from '@/types/database'

const SELECTOR_ROLL_DURATION_MS = 1800
const SELECTOR_PREVIEW_INTERVAL_MS = 120
const SELECTOR_REVEAL_LIFT_MS = 420
const SELECTOR_REVEAL_SETTLE_MS = 1000
const SELECTOR_FINAL_SETTLE_MS = 300
const SELECTOR_REVEAL_PEAK = 0.42
const SELECTOR_OPACITY_REVEAL_START = 0.18
const SELECTOR_IDLE_OPACITY = 0.68
const SELECTOR_INITIAL_SCALE = 0.96
const SELECTOR_PEAK_SCALE = 1.035
const SELECTOR_INITIAL_LIFT = 10
const SELECTOR_SCAN_START_X = -110
const SELECTOR_SCAN_END_X = 210

interface Props {
  candidates: LibraryEntry[]
  isLoading: boolean
}

export function NextGameChooser({ candidates, isLoading }: Props) {
  const [selectedEntry, setSelectedEntry] = useState<LibraryEntry | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [isChoosing, setIsChoosing] = useState(false)
  const revealProgress = useRef(new Animated.Value(0)).current
  const scanProgress = useRef(new Animated.Value(0)).current
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewEntry = candidates[previewIndex % Math.max(candidates.length, 1)] ?? null
  const displayEntry = isChoosing ? previewEntry : selectedEntry
  const hasCandidates = candidates.length > 0
  const buttonLabel = selectedEntry == null ? 'Roll' : 'Roll again'
  const selectedReleaseLabel =
    selectedEntry?.release_date != null
      ? formatDate(selectedEntry.release_date)
      : 'Tap the button to draw one'

  useEffect(() => {
    return () => {
      if (intervalRef.current != null) clearInterval(intervalRef.current)
      if (timeoutRef.current != null) clearTimeout(timeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (candidates.length === 0) {
      setSelectedEntry(null)
      setPreviewIndex(0)
      return
    }

    setSelectedEntry((current) =>
      current != null && candidates.some((entry) => entry.id === current.id) ? current : null
    )
    setPreviewIndex((current) => current % candidates.length)
  }, [candidates])

  const handleChoose = useCallback(() => {
    if (candidates.length === 0 || isChoosing) return

    if (intervalRef.current != null) clearInterval(intervalRef.current)
    if (timeoutRef.current != null) clearTimeout(timeoutRef.current)

    const chosenIndex = Math.floor(Math.random() * candidates.length)
    setIsChoosing(true)
    setSelectedEntry(null)
    revealProgress.setValue(0)
    scanProgress.setValue(0)

    intervalRef.current = setInterval(() => {
      setPreviewIndex((current) => (current + 1) % candidates.length)
    }, SELECTOR_PREVIEW_INTERVAL_MS)

    Animated.parallel([
      Animated.sequence([
        Animated.timing(revealProgress, {
          toValue: SELECTOR_REVEAL_PEAK,
          duration: SELECTOR_REVEAL_LIFT_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(revealProgress, {
          toValue: 1,
          duration: SELECTOR_REVEAL_SETTLE_MS,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(scanProgress, {
        toValue: 1,
        duration: SELECTOR_ROLL_DURATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start()

    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current != null) clearInterval(intervalRef.current)
      intervalRef.current = null
      setPreviewIndex(chosenIndex)
      setSelectedEntry(candidates[chosenIndex] ?? null)
      setIsChoosing(false)
      scanProgress.stopAnimation()
      scanProgress.setValue(0)
      Animated.timing(revealProgress, {
        toValue: 1,
        duration: SELECTOR_FINAL_SETTLE_MS,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }).start()
    }, SELECTOR_ROLL_DURATION_MS)
  }, [candidates, isChoosing, revealProgress, scanProgress])

  const handleOpenSelected = useCallback(() => {
    if (selectedEntry == null || isChoosing) return
    router.push(`/game/${selectedEntry.rawg_game_id}`)
  }, [isChoosing, selectedEntry])

  const { coverScale, coverLift, coverOpacity, scanTranslate } = useMemo(
    () => ({
      coverScale: revealProgress.interpolate({
        inputRange: [0, SELECTOR_REVEAL_PEAK, 1],
        outputRange: [SELECTOR_INITIAL_SCALE, SELECTOR_PEAK_SCALE, 1],
      }),
      coverLift: revealProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [SELECTOR_INITIAL_LIFT, 0],
      }),
      coverOpacity: revealProgress.interpolate({
        inputRange: [0, SELECTOR_OPACITY_REVEAL_START, 1],
        outputRange: [SELECTOR_IDLE_OPACITY, 1, 1],
      }),
      scanTranslate: scanProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [SELECTOR_SCAN_START_X, SELECTOR_SCAN_END_X],
      }),
    }),
    [revealProgress, scanProgress]
  )

  return (
    <View style={styles.section}>
      <View style={styles.shell}>
        <View style={styles.copy}>
          <Text variant="subheading" style={styles.title}>
            Pick your next game!
          </Text>
          <Text variant="caption" style={styles.meta} numberOfLines={2}>
            {isLoading
              ? 'Reading your released TBP games.'
              : hasCandidates
                ? `${candidates.length} released TBP ${candidates.length === 1 ? 'game' : 'games'} ready.`
                : 'Released TBP games will appear here.'}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            selectedEntry != null ? `Open ${selectedEntry.game_title}` : 'Chosen game'
          }
          disabled={selectedEntry == null || isChoosing}
          onPress={handleOpenSelected}
          style={({ pressed }) => [
            styles.poster,
            pressed && selectedEntry != null && styles.posterPressed,
          ]}
        >
          <Animated.View
            style={[
              styles.posterAnimated,
              {
                opacity: coverOpacity,
                transform: [{ translateY: coverLift }, { scale: coverScale }],
              },
            ]}
          >
            {displayEntry?.game_cover_url != null ? (
              <Image
                source={{ uri: displayEntry.game_cover_url }}
                style={styles.cover}
                contentFit="cover"
                transition={160}
                cachePolicy="disk"
              />
            ) : (
              <View style={styles.placeholder}>
                <Text variant="label" color={Colors.textMuted} numberOfLines={1}>
                  No pick yet
                </Text>
              </View>
            )}
          </Animated.View>
          {isChoosing && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.scan,
                {
                  transform: [{ translateX: scanTranslate }],
                },
              ]}
            />
          )}
        </Pressable>

        <View style={styles.result}>
          <Text variant="body" style={styles.resultTitle} numberOfLines={2}>
            {isChoosing
              ? (displayEntry?.game_title ?? 'Rolling...')
              : (selectedEntry?.game_title ?? 'No game selected')}
          </Text>
          <Text variant="caption" style={styles.resultMeta} numberOfLines={1}>
            {isChoosing ? 'Scanning the released shelf' : selectedReleaseLabel}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose my next game"
          disabled={!hasCandidates || isChoosing || isLoading}
          onPress={handleChoose}
          style={({ pressed }) => [
            styles.button,
            (!hasCandidates || isChoosing || isLoading) && styles.buttonDisabled,
            pressed && hasCandidates && !isChoosing && styles.buttonPressed,
          ]}
        >
          <Text variant="label" style={styles.buttonText}>
            {isChoosing ? 'Rolling...' : buttonLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
  },
  shell: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    gap: Spacing.md,
    overflow: 'hidden',
  },
  copy: {
    gap: Spacing.xxs,
  },
  eyebrow: {
    color: STATUS_COLORS.want_to_play,
  },
  title: {
    maxWidth: 310,
  },
  meta: {
    maxWidth: 320,
    color: Colors.textSecondary,
  },
  poster: {
    height: 178,
    borderRadius: Radius.lg,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    overflow: 'hidden',
  },
  posterPressed: {
    opacity: 0.86,
  },
  posterAnimated: {
    flex: 1,
  },
  cover: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surfaceRaised,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  scan: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 86,
    backgroundColor: 'rgba(124, 167, 255, 0.16)',
  },
  result: {
    minHeight: 48,
  },
  resultTitle: {
    fontFamily: FontFamily.semibold,
    marginBottom: Spacing.xxxs,
  },
  resultMeta: {
    color: Colors.textMuted,
  },
  button: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  buttonPressed: {
    backgroundColor: Colors.primaryActive,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: Colors.textPrimary,
  },
})
