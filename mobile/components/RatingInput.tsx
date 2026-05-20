import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { Colors, Spacing } from '@/constants'

interface Props {
  value: number | null
  onChange: (value: number | null) => void
}

function normalizeRating(value: number): number {
  const clamped = Math.min(10, Math.max(0, value))
  return Math.round(clamped * 2) / 2
}

export function RatingInput({ value, onChange }: Props) {
  const [trackWidth, setTrackWidth] = useState(0)
  const [draftValue, setDraftValue] = useState(value != null ? value.toFixed(1) : '')
  const ratingValue = value ?? 0
  const canDecrease = ratingValue !== 0
  const canIncrease = ratingValue !== 10
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

  function stepRating(direction: -1 | 1) {
    const next = normalizeRating((value ?? 0) + direction * 0.5)
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

      <View style={styles.ratingInputControls}>
        <Pressable
          accessibilityLabel="Decrease rating"
          accessibilityRole="button"
          disabled={!canDecrease}
          hitSlop={8}
          onPress={() => stepRating(-1)}
          style={({ pressed }) => [
            styles.ratingStepBtn,
            pressed && styles.ratingStepBtnPressed,
            !canDecrease && styles.ratingStepBtnDisabled,
          ]}
        >
          <Ionicons name="remove" size={16} color={canDecrease ? Colors.textSecondary : Colors.textMutedSoft} />
        </Pressable>

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

        <Pressable
          accessibilityLabel="Increase rating"
          accessibilityRole="button"
          disabled={!canIncrease}
          hitSlop={8}
          onPress={() => stepRating(1)}
          style={({ pressed }) => [
            styles.ratingStepBtn,
            pressed && styles.ratingStepBtnPressed,
            !canIncrease && styles.ratingStepBtnDisabled,
          ]}
        >
          <Ionicons name="add" size={16} color={canIncrease ? Colors.textSecondary : Colors.textMutedSoft} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
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
  ratingInputControls: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: Spacing.xs,
  },
  ratingInputGroup: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
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
    minWidth: 0,
    width: 112,
    paddingVertical: 4,
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 19,
    lineHeight: 24,
    color: Colors.warning,
    textAlign: 'center',
  },
  ratingValueInputNative: {
    minWidth: 0,
    width: 96,
    fontSize: 17,
    lineHeight: 22,
  },
  ratingStepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  ratingStepBtnPressed: {
    opacity: 0.75,
  },
  ratingStepBtnDisabled: {
    opacity: 0.4,
  },
  ratingClearBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
})
