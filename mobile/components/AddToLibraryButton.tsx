import { useState } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Text } from '@/components/ui/Text'
import { StatusPicker } from '@/components/StatusPicker'
import {
  useAddToLibrary,
  useLibraryEntry,
  useRemoveFromLibrary,
  useUpdateLibraryEntry,
} from '@/hooks/useLibrary'
import { Colors, Spacing, Radius } from '@/constants'
import { STATUS_COLORS, STATUS_LABELS, type LibraryStatus } from '@/types'
import type { RawgGame } from '@/types/rawg'

interface Props {
  game: Pick<RawgGame, 'id' | 'name' | 'background_image' | 'released' | 'platforms'>
}

export function AddToLibraryButton({ game }: Props) {
  const [pickerVisible, setPickerVisible] = useState(false)

  const entry = useLibraryEntry(game.id)
  const addMutation = useAddToLibrary()
  const updateMutation = useUpdateLibraryEntry()
  const removeMutation = useRemoveFromLibrary()

  const isPending =
    addMutation.isPending || updateMutation.isPending || removeMutation.isPending

  function handlePress() {
    setPickerVisible(true)
  }

  function handleSelect(status: LibraryStatus) {
    setPickerVisible(false)
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
    }
    if (entry != null) {
      updateMutation.mutate({
        id: entry.id,
        status,
        ...(entry.release_date == null && game.released != null
          ? { release_date: game.released }
          : {}),
      })
    } else {
      addMutation.mutate({
        rawg_game_id: game.id,
        game_title: game.name,
        game_cover_url: game.background_image ?? null,
        release_date: game.released ?? null,
        platforms: game.platforms != null ? game.platforms.map(p => p.platform.slug) : null,
        rawg_metadata_synced_at: new Date().toISOString(),
        status,
      })
    }
  }

  function handleRemove() {
    setPickerVisible(false)
    if (entry != null) {
      removeMutation.mutate(entry.id)
    }
  }

  if (isPending) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    )
  }

  const currentStatus = entry != null ? (entry.status as LibraryStatus) : null

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          entry != null ? styles.statusChip : styles.addButton,
          entry != null && { borderColor: STATUS_COLORS[entry.status as LibraryStatus] },
          pressed && styles.pressed,
        ]}
        onPress={handlePress}
        hitSlop={8}
      >
        {entry != null ? (
          <Text variant="label" color={STATUS_COLORS[entry.status as LibraryStatus]}>
            {STATUS_LABELS[entry.status as LibraryStatus]}
          </Text>
        ) : (
          <>
            <Ionicons name="add" size={13} color={Colors.textPrimary} />
            <Text variant="label">Add</Text>
          </>
        )}
      </Pressable>
      <StatusPicker
        visible={pickerVisible}
        currentStatus={currentStatus}
        onSelect={handleSelect}
        onRemove={handleRemove}
        onDismiss={() => setPickerVisible(false)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: 'center',
  },
  statusChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignSelf: 'center',
  },
  loadingContainer: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    alignSelf: 'flex-start',
    minWidth: 50,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
})
