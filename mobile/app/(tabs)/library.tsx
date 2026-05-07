import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type NativeSyntheticEvent,
  type NativeTouchEvent,
  useWindowDimensions,
} from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text } from '@/components/ui/Text'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { RawgFooter } from '@/components/RawgFooter'
import { StatusPicker } from '@/components/StatusPicker'
import {
  useLibraryEntries,
  useRemoveFromLibrary,
  useUpdateLibraryCustomOrder,
  useUpdateLibraryEntry,
} from '@/hooks/useLibrary'
import { useUpdateUserPreferences, useUserPreferences } from '@/hooks/useUserPreferences'
import { Colors, Spacing } from '@/constants'
import {
  LIBRARY_SORT_KEYS,
  STATUS_COLORS,
  STATUS_LABELS,
  type LibrarySortKey,
  type LibraryStatus,
} from '@/types'
import type { LibraryEntry } from '@/types/database'

type FilterStatus = LibraryStatus | 'all'
type SortKey = LibrarySortKey
type ViewMode = 'grid' | 'list'

const FILTER_OPTIONS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'want_to_play', label: 'Want to Play' },
  { key: 'playing', label: 'Playing' },
  { key: 'done', label: 'Done' },
  { key: 'did_not_finish', label: 'DNF' },
]

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Recently Added' },
  { key: 'title', label: 'Title' },
  { key: 'rating', label: 'Rating' },
  { key: 'playtime', label: 'Playtime' },
  { key: 'custom', label: 'Custom' },
]

function isSortKey(value: string | null): value is SortKey {
  return value != null && LIBRARY_SORT_KEYS.includes(value as SortKey)
}

function formatPlaytime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function sortEntries(entries: LibraryEntry[], sort: SortKey): LibraryEntry[] {
  return [...entries].sort((a, b) => {
    switch (sort) {
      case 'recent':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'title':
        return a.game_title.localeCompare(b.game_title)
      case 'rating': {
        const rA = a.personal_rating ?? -1
        const rB = b.personal_rating ?? -1
        return rB - rA
      }
      case 'playtime': {
        const pA = a.personal_playtime_minutes ?? -1
        const pB = b.personal_playtime_minutes ?? -1
        return pB - pA
      }
      case 'custom':
        return 0
    }
  })
}

function orderEntriesByIds(entries: LibraryEntry[], orderedIds: string[]): LibraryEntry[] {
  const positions = new Map(orderedIds.map((id, index) => [id, index]))

  return [...entries].sort((a, b) => {
    const aPosition = positions.get(a.id) ?? Number.MAX_SAFE_INTEGER
    const bPosition = positions.get(b.id) ?? Number.MAX_SAFE_INTEGER

    if (aPosition !== bPosition) return aPosition - bPosition
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

function getCustomOrderedIds(entries: LibraryEntry[]): string[] {
  return [...entries]
    .sort((a, b) => {
      const aOrder = a.custom_order ?? Number.MAX_SAFE_INTEGER
      const bOrder = b.custom_order ?? Number.MAX_SAFE_INTEGER

      if (aOrder !== bOrder) return aOrder - bOrder
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    .map(entry => entry.id)
}

function swapItems<T>(items: T[], firstIndex: number, secondIndex: number): T[] {
  if (
    firstIndex === secondIndex ||
    firstIndex < 0 ||
    secondIndex < 0 ||
    firstIndex >= items.length ||
    secondIndex >= items.length
  ) {
    return items
  }

  const next = [...items]
  const firstItem = next[firstIndex]
  const secondItem = next[secondIndex]
  if (firstItem == null || secondItem == null) return items
  next[firstIndex] = secondItem
  next[secondIndex] = firstItem
  return next
}

function LibraryEntryCard({
  entry,
  mode,
  onStatusPress,
  onDelete,
}: {
  entry: LibraryEntry
  mode: ViewMode
  onStatusPress: (entry: LibraryEntry) => void
  onDelete: (id: string) => void
}) {
  const status = entry.status as LibraryStatus

  if (mode === 'list') {
    return (
      <Pressable
        style={({ pressed }) => [lcStyles.listItem, pressed && lcStyles.pressed]}
        onPress={() => router.push(`/game/${entry.rawg_game_id}`)}
      >
        <Image
          source={entry.game_cover_url != null ? { uri: entry.game_cover_url } : null}
          style={lcStyles.thumb}
          contentFit="cover"
          transition={200}
          cachePolicy="disk"
        />
        <View style={lcStyles.listInfo}>
          <Text variant="body" numberOfLines={2} style={lcStyles.listTitle}>
            {entry.game_title}
          </Text>
          <Pressable
            style={[lcStyles.chip, { borderColor: STATUS_COLORS[status] }]}
            onPress={() => onStatusPress(entry)}
            hitSlop={4}
          >
            <Text variant="label" color={STATUS_COLORS[status]}>
              {STATUS_LABELS[status]}
            </Text>
          </Pressable>
          {(entry.personal_rating != null ||
            (entry.personal_playtime_minutes != null && entry.personal_playtime_minutes > 0)) && (
            <View style={lcStyles.metaRow}>
              {entry.personal_rating != null && (
                <Text variant="caption">Rating {entry.personal_rating.toFixed(1)}</Text>
              )}
              {entry.personal_playtime_minutes != null && entry.personal_playtime_minutes > 0 && (
                <Text variant="caption">{formatPlaytime(entry.personal_playtime_minutes)}</Text>
              )}
            </View>
          )}
        </View>
        <Pressable style={lcStyles.deleteBtn} onPress={() => onDelete(entry.id)} hitSlop={12}>
          <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
        </Pressable>
      </Pressable>
    )
  }

  return (
    <Pressable
      style={({ pressed }) => [lcStyles.gridCard, pressed && lcStyles.pressed]}
      onPress={() => router.push(`/game/${entry.rawg_game_id}`)}
    >
      <Image
        source={entry.game_cover_url != null ? { uri: entry.game_cover_url } : null}
        style={lcStyles.gridCover}
        contentFit="cover"
        transition={200}
        cachePolicy="disk"
      />
      <View style={lcStyles.gridInfo}>
        <Text variant="body" numberOfLines={2} style={lcStyles.gridTitle}>
          {entry.game_title}
        </Text>
        <Pressable
          style={[lcStyles.chip, { borderColor: STATUS_COLORS[status] }]}
          onPress={() => onStatusPress(entry)}
          hitSlop={4}
        >
          <Text variant="label" color={STATUS_COLORS[status]}>
            {STATUS_LABELS[status]}
          </Text>
        </Pressable>
        {(entry.personal_rating != null ||
          (entry.personal_playtime_minutes != null && entry.personal_playtime_minutes > 0)) && (
          <View style={lcStyles.metaRow}>
            {entry.personal_rating != null && (
              <Text variant="caption">Rating {entry.personal_rating.toFixed(1)}</Text>
            )}
            {entry.personal_playtime_minutes != null && entry.personal_playtime_minutes > 0 && (
              <Text variant="caption">{formatPlaytime(entry.personal_playtime_minutes)}</Text>
            )}
          </View>
        )}
      </View>
    </Pressable>
  )
}

const lcStyles = StyleSheet.create({
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  thumb: {
    width: 60,
    height: 80,
    borderRadius: 6,
    backgroundColor: Colors.surfaceRaised,
    flexShrink: 0,
  },
  listInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  listTitle: {
    fontSize: 14,
  },
  deleteBtn: {
    padding: Spacing.xs,
    flexShrink: 0,
  },
  gridCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  gridCover: {
    width: '100%',
    height: 130,
    backgroundColor: Colors.surfaceRaised,
  },
  gridInfo: {
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  gridTitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  pressed: {
    opacity: 0.85,
  },
})

function ReorderableLibraryEntry({
  entry,
  children,
  canMoveUp,
  canMoveDown,
  onMove,
  onDragEnd,
}: {
  entry: LibraryEntry
  children: ReactNode
  canMoveUp: boolean
  canMoveDown: boolean
  onMove: (id: string, direction: -1 | 1) => void
  onDragEnd: () => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const dragOffsetRef = useRef(0)
  const isDraggingRef = useRef(false)
  const movedRef = useRef(false)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const webStartYRef = useRef(0)

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current != null) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }, [])

  const stopDragging = useCallback(() => {
    clearHoldTimer()
    const didMove = movedRef.current
    isDraggingRef.current = false
    movedRef.current = false
    dragOffsetRef.current = 0
    setIsDragging(false)
    if (didMove) onDragEnd()
  }, [clearHoldTimer, onDragEnd])

  const moveFromDelta = useCallback((delta: number) => {
    if (delta <= -48) {
      dragOffsetRef.current += delta
      movedRef.current = true
      onMove(entry.id, -1)
    }

    if (delta >= 48) {
      dragOffsetRef.current += delta
      movedRef.current = true
      onMove(entry.id, 1)
    }
  }, [entry.id, onMove])

  const beginDragging = useCallback(() => {
    isDraggingRef.current = true
    setIsDragging(true)
  }, [])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          movedRef.current = false
          dragOffsetRef.current = 0
          clearHoldTimer()
          holdTimerRef.current = setTimeout(() => {
            beginDragging()
          }, 220)
        },
        onPanResponderMove: (_event, gestureState) => {
          if (!isDraggingRef.current) return
          const delta = gestureState.dy - dragOffsetRef.current
          moveFromDelta(delta)
        },
        onPanResponderRelease: stopDragging,
        onPanResponderTerminate: stopDragging,
      }),
    [beginDragging, clearHoldTimer, moveFromDelta, stopDragging]
  )

  const startWebDrag = useCallback((event: GestureResponderEvent) => {
    if (Platform.OS !== 'web') return

    clearHoldTimer()
    movedRef.current = false
    webStartYRef.current = event.nativeEvent.pageY
    dragOffsetRef.current = 0

    holdTimerRef.current = setTimeout(() => {
      beginDragging()
    }, 120)
  }, [beginDragging, clearHoldTimer])

  const updateWebDrag = useCallback((event: NativeSyntheticEvent<NativeTouchEvent>) => {
    if (Platform.OS !== 'web' || !isDraggingRef.current) return

    const totalDelta = event.nativeEvent.pageY - webStartYRef.current
    const delta = totalDelta - dragOffsetRef.current
    moveFromDelta(delta)
  }, [moveFromDelta])

  const handleStep = useCallback((direction: -1 | 1) => {
    movedRef.current = true
    onMove(entry.id, direction)
    onDragEnd()
  }, [entry.id, onDragEnd, onMove])

  return (
    <View style={[rdStyles.row, isDragging && rdStyles.rowDragging]}>
      <View
        style={[rdStyles.handle, isDragging && rdStyles.handleActive]}
        accessibilityLabel={`Reorder ${entry.game_title}`}
      >
        <Pressable
          style={[rdStyles.stepButton, !canMoveUp && rdStyles.stepButtonDisabled]}
          disabled={!canMoveUp}
          onPress={() => handleStep(-1)}
          accessibilityRole="button"
          accessibilityLabel={`Move ${entry.game_title} up`}
          hitSlop={4}
        >
          <Ionicons name="chevron-up" size={16} color={canMoveUp ? Colors.textSecondary : Colors.textMutedSoft} />
        </Pressable>
        <View
          style={rdStyles.grip}
          accessibilityRole="button"
          accessibilityHint="Hold, then drag up or down to reorder"
          onStartShouldSetResponder={() => Platform.OS === 'web'}
          onResponderGrant={startWebDrag}
          onResponderMove={updateWebDrag}
          onResponderRelease={stopDragging}
          onResponderTerminate={stopDragging}
          {...(Platform.OS === 'web' ? {} : panResponder.panHandlers)}
        >
          <Ionicons
            name="reorder-three-outline"
            size={24}
            color={isDragging ? Colors.primary : Colors.textMuted}
          />
        </View>
        <Pressable
          style={[rdStyles.stepButton, !canMoveDown && rdStyles.stepButtonDisabled]}
          disabled={!canMoveDown}
          onPress={() => handleStep(1)}
          accessibilityRole="button"
          accessibilityLabel={`Move ${entry.game_title} down`}
          hitSlop={4}
        >
          <Ionicons name="chevron-down" size={16} color={canMoveDown ? Colors.textSecondary : Colors.textMutedSoft} />
        </Pressable>
      </View>
      <View style={rdStyles.card}>{children}</View>
    </View>
  )
}

const rdStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowDragging: {
    backgroundColor: Colors.surface,
  },
  handle: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.borderSoft,
    paddingVertical: 4,
  },
  handleActive: {
    backgroundColor: Colors.surfaceRaised,
  },
  stepButton: {
    width: 32,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  stepButtonDisabled: {
    opacity: 0.35,
  },
  grip: {
    width: 36,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flex: 1,
  },
})


function SortPicker({
  visible,
  currentSort,
  onSelect,
  onDismiss,
}: {
  visible: boolean
  currentSort: SortKey
  onSelect: (sort: SortKey) => void
  onDismiss: () => void
}) {
  const isWeb = Platform.OS === 'web'

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={[spStyles.overlay, isWeb ? spStyles.overlayCenter : spStyles.overlayBottom]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <View
          style={isWeb ? spStyles.card : spStyles.sheet}
          onStartShouldSetResponder={(_e) => true}
        >
          {!isWeb && <View style={spStyles.handle} />}
          <Text variant="subheading" style={spStyles.title}>
            Sort by
          </Text>
          {SORT_OPTIONS.map(({ key, label }) => (
            <Pressable
              key={key}
              style={({ pressed }) => [
                spStyles.row,
                currentSort === key && spStyles.rowSelected,
                pressed && spStyles.rowPressed,
              ]}
              onPress={() => onSelect(key)}
            >
              <Text
                variant="body"
                style={currentSort === key ? { color: Colors.primary } : undefined}
              >
                {label}
              </Text>
              {currentSort === key && (
                <Ionicons name="checkmark" size={18} color={Colors.primary} />
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  )
}

const spStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  overlayBottom: {
    justifyContent: 'flex-end',
  },
  overlayCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Spacing.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.border,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    width: 300,
    paddingBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  title: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  rowSelected: {
    backgroundColor: Colors.surfaceRaised,
  },
  rowPressed: {
    backgroundColor: Colors.surfaceRaised,
  },
})


export default function LibraryScreen() {
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortPickerVisible, setSortPickerVisible] = useState(false)
  const [statusPickerEntry, setStatusPickerEntry] = useState<LibraryEntry | null>(null)
  const [customOrderIds, setCustomOrderIds] = useState<string[]>([])
  const customOrderIdsRef = useRef<string[]>([])

  const { data: entries, isLoading, refetch, isRefetching } = useLibraryEntries()
  const { mutate: updateEntry } = useUpdateLibraryEntry()
  const { mutate: removeEntry } = useRemoveFromLibrary()
  const { mutate: updateCustomOrder } = useUpdateLibraryCustomOrder()
  const { data: userPreferences, isSuccess: preferencesLoaded } = useUserPreferences()
  const { mutate: updateUserPreferences } = useUpdateUserPreferences()

  const { width } = useWindowDimensions()
  const activeViewMode = sort === 'custom' ? 'list' : viewMode
  const numColumns = activeViewMode === 'grid' ? (width >= 768 ? 3 : 2) : 1

  useEffect(() => {
    if (!preferencesLoaded || userPreferences == null) return
    if (isSortKey(userPreferences.library_sort)) {
      setSort(userPreferences.library_sort)
    }
  }, [preferencesLoaded, userPreferences])

  useEffect(() => {
    const entryIds = getCustomOrderedIds(entries ?? [])
    setCustomOrderIds(current => {
      const currentSet = new Set(current)
      const entryIdSet = new Set(entryIds)
      const existingIds = current.filter(id => entryIdSet.has(id))
      const newIds = entryIds.filter(id => !currentSet.has(id))
      const next = [...existingIds, ...newIds]
      customOrderIdsRef.current = next
      return next
    })
  }, [entries])

  const filtered = useMemo(() => {
    const all = entries ?? []
    const byStatus = filter === 'all' ? all : all.filter(e => e.status === filter)
    return sort === 'custom' ? orderEntriesByIds(byStatus, customOrderIds) : sortEntries(byStatus, sort)
  }, [customOrderIds, entries, filter, sort])

  const counts = useMemo((): Record<FilterStatus, number> => {
    const all = entries ?? []
    return {
      all: all.length,
      want_to_play: all.filter(e => e.status === 'want_to_play').length,
      playing: all.filter(e => e.status === 'playing').length,
      done: all.filter(e => e.status === 'done').length,
      did_not_finish: all.filter(e => e.status === 'did_not_finish').length,
    }
  }, [entries])

  function handleDelete(id: string) {
    if (Platform.OS === 'web') {
      removeEntry(id)
    } else {
      Alert.alert('Remove Game', 'Remove this game from your library?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeEntry(id) },
      ])
    }
  }

  function handleStatusSelect(status: LibraryStatus) {
    if (statusPickerEntry != null) {
      updateEntry({ id: statusPickerEntry.id, status })
    }
    setStatusPickerEntry(null)
  }

  function handleStatusRemove() {
    if (statusPickerEntry != null) {
      removeEntry(statusPickerEntry.id)
    }
    setStatusPickerEntry(null)
  }

  const handleCustomMove = useCallback((id: string, direction: -1 | 1) => {
    const visibleIndex = filtered.findIndex(entry => entry.id === id)
    const targetVisibleEntry = filtered[visibleIndex + direction]
    if (visibleIndex === -1 || targetVisibleEntry == null) return

    setCustomOrderIds(current => {
      const currentIndex = current.indexOf(id)
      const targetIndex = current.indexOf(targetVisibleEntry.id)
      const next = swapItems(current, currentIndex, targetIndex)
      customOrderIdsRef.current = next
      return next
    })
  }, [filtered])

  const handleCustomDragEnd = useCallback(() => {
    updateCustomOrder(customOrderIdsRef.current)
  }, [updateCustomOrder])

  const handleSortSelect = useCallback((nextSort: SortKey) => {
    setSort(nextSort)
    setSortPickerVisible(false)
    updateUserPreferences({ library_sort: nextSort })
  }, [updateUserPreferences])

  const currentSortLabel = SORT_OPTIONS.find(s => s.key === sort)?.label ?? 'Sort'

  const emptyHeading =
    filter === 'all'
      ? 'No games yet'
      : `No ${filter === 'did_not_finish' ? 'Did Not Finish' : STATUS_LABELS[filter]} games`

  const emptySubtext =
    filter === 'all'
      ? 'Search for games and add them to your library'
      : 'Games with this status will appear here'

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text variant="heading">Library</Text>
        </View>
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLoader key={i} height={200} borderRadius={10} style={styles.skeletonCard} />
          ))}
        </View>
        <RawgFooter />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text variant="heading">Library</Text>
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {FILTER_OPTIONS.map(({ key, label }) => {
          const count = counts[key]
          const isActive = filter === key
          return (
            <Pressable
              key={key}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
              onPress={() => setFilter(key)}
            >
              <Text
                variant="label"
                style={[styles.filterLabel, isActive && styles.filterLabelActive]}
              >
                {label}
              </Text>
              {count > 0 && (
                <View style={[styles.badge, isActive && styles.badgeActive]}>
                  <Text
                    variant="label"
                    style={[styles.badgeText, isActive && styles.badgeTextActive]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Controls row */}
      <View style={styles.controls}>
        <View style={styles.viewToggle}>
          <Pressable
            style={[styles.toggleBtn, activeViewMode === 'grid' && styles.toggleBtnActive]}
            onPress={() => setViewMode('grid')}
            disabled={sort === 'custom'}
          >
            <Ionicons
              name="grid-outline"
              size={18}
              color={activeViewMode === 'grid' ? Colors.primary : Colors.textSecondary}
            />
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, activeViewMode === 'list' && styles.toggleBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons
              name="list-outline"
              size={18}
              color={activeViewMode === 'list' ? Colors.primary : Colors.textSecondary}
            />
          </Pressable>
        </View>
        <Pressable style={styles.sortBtn} onPress={() => setSortPickerVisible(true)}>
          <Ionicons name="swap-vertical-outline" size={15} color={Colors.textSecondary} />
          <Text variant="caption" style={styles.sortLabel}>
            {currentSortLabel}
          </Text>
          <Ionicons name="chevron-down" size={13} color={Colors.textMuted} />
        </Pressable>
      </View>

      {/* Game list */}
      <FlatList
        data={filtered}
        renderItem={({ item, index }) => {
          const card = (
            <LibraryEntryCard
              entry={item}
              mode={activeViewMode}
              onStatusPress={setStatusPickerEntry}
              onDelete={handleDelete}
            />
          )
          if (sort === 'custom') {
            return (
              <ReorderableLibraryEntry
                entry={item}
                canMoveUp={index > 0}
                canMoveDown={index < filtered.length - 1}
                onMove={handleCustomMove}
                onDragEnd={handleCustomDragEnd}
              >
                {card}
              </ReorderableLibraryEntry>
            )
          }
          if (activeViewMode === 'list' && Platform.OS !== 'web') {
            return (
              <Swipeable
                renderRightActions={() => (
                  <Pressable
                    style={styles.swipeDeleteAction}
                    onPress={() => handleDelete(item.id)}
                  >
                    <Ionicons name="trash-outline" size={22} color="#fff" />
                  </Pressable>
                )}
                rightThreshold={64}
                overshootRight={false}
                friction={2}
              >
                {card}
              </Swipeable>
            )
          }
          return card
        }}
        keyExtractor={item => item.id}
        numColumns={numColumns}
        key={`${activeViewMode}-${numColumns}-${sort}`}
        contentContainerStyle={[
          styles.listContent,
          filtered.length === 0 && styles.listContentEmpty,
        ]}
        columnWrapperStyle={activeViewMode === 'grid' ? styles.gridRow : undefined}
        ItemSeparatorComponent={activeViewMode === 'grid' ? () => <View style={styles.gridGap} /> : undefined}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrapper}>
            <EmptyState
              icon="bookmark-outline"
              heading={emptyHeading}
              subtext={emptySubtext}
              ctaLabel={filter === 'all' ? 'Browse Games' : undefined}
              onCta={filter === 'all' ? () => router.push('/(tabs)/search') : undefined}
            />
          </View>
        }
        ListFooterComponent={<RawgFooter />}
      />

      <SortPicker
        visible={sortPickerVisible}
        currentSort={sort}
        onSelect={handleSortSelect}
        onDismiss={() => setSortPickerVisible(false)}
      />

      <StatusPicker
        visible={statusPickerEntry != null}
        currentStatus={statusPickerEntry != null ? (statusPickerEntry.status as LibraryStatus) : null}
        onSelect={handleStatusSelect}
        onRemove={handleStatusRemove}
        onDismiss={() => setStatusPickerEntry(null)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterScroll: {
    flexShrink: 0,
  },
  filterContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterTabActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(124,106,247,0.12)',
  },
  filterLabel: {
    color: Colors.textSecondary,
  },
  filterLabelActive: {
    color: Colors.primary,
  },
  badge: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 10,
    minWidth: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: 'rgba(124,106,247,0.25)',
  },
  badgeText: {
    color: Colors.textMuted,
  },
  badgeTextActive: {
    color: Colors.primary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 2,
  },
  toggleBtn: {
    padding: Spacing.xs,
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: Colors.surfaceRaised,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  sortLabel: {
    color: Colors.textSecondary,
  },
  listContent: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    flexGrow: 1,
  },
  listContentEmpty: {
    flex: 1,
  },
  gridRow: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  gridGap: {
    height: Spacing.sm,
  },
  emptyWrapper: {
    flex: 1,
    minHeight: 300,
  },
  skeletonGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  skeletonCard: {
    width: '47%',
  },
  swipeDeleteAction: {
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
  },
})
