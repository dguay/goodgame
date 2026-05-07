import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
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
import { Colors, Radius, Spacing } from '@/constants'
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
  { key: 'want_to_play', label: 'Wanted' },
  { key: 'playing', label: 'Playing' },
  { key: 'done', label: 'Done' },
  { key: 'did_not_finish', label: 'DNF' },
]

const FILTER_ICONS: Record<FilterStatus, keyof typeof Ionicons.glyphMap> = {
  all: 'library-outline',
  want_to_play: 'bookmark-outline',
  playing: 'game-controller-outline',
  done: 'checkmark-circle-outline',
  did_not_finish: 'ban-outline',
}

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

function getFilterColor(filter: FilterStatus): string {
  if (filter === 'all') return Colors.primary
  return STATUS_COLORS[filter]
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

function LibraryFilters({
  activeFilter,
  activeViewMode,
  counts,
  currentSortLabel,
  filteredCount,
  isCustomSort,
  isWide,
  onFilterChange,
  onSortPress,
  onViewModeChange,
}: {
  activeFilter: FilterStatus
  activeViewMode: ViewMode
  counts: Record<FilterStatus, number>
  currentSortLabel: string
  filteredCount: number
  isCustomSort: boolean
  isWide: boolean
  onFilterChange: (filter: FilterStatus) => void
  onSortPress: () => void
  onViewModeChange: (viewMode: ViewMode) => void
}) {
  const resultLabel = filteredCount === 1 ? '1 game' : `${filteredCount} games`

  return (
    <View style={[styles.filterPanel, isWide && styles.filterPanelWide]}>
      <View style={styles.filterHeader}>
        <View style={styles.filterTitleRow}>
          <Text variant="label" style={styles.filterEyebrow}>
            Filters
          </Text>
          <Text variant="caption" style={styles.filterResult}>
            {resultLabel}
          </Text>
        </View>

        <View style={styles.controls}>
          <View style={styles.viewToggle}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Grid view"
              accessibilityState={{ selected: activeViewMode === 'grid', disabled: isCustomSort }}
              style={[
                styles.toggleBtn,
                activeViewMode === 'grid' && styles.toggleBtnActive,
                isCustomSort && styles.toggleBtnDisabled,
              ]}
              onPress={() => onViewModeChange('grid')}
              disabled={isCustomSort}
              hitSlop={4}
            >
              <Ionicons
                name="grid-outline"
                size={18}
                color={activeViewMode === 'grid' ? Colors.primary : Colors.textSecondary}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="List view"
              accessibilityState={{ selected: activeViewMode === 'list' }}
              style={[styles.toggleBtn, activeViewMode === 'list' && styles.toggleBtnActive]}
              onPress={() => onViewModeChange('list')}
              hitSlop={4}
            >
              <Ionicons
                name="list-outline"
                size={18}
                color={activeViewMode === 'list' ? Colors.primary : Colors.textSecondary}
              />
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${currentSortLabel}`}
            style={({ pressed }) => [styles.sortBtn, pressed && styles.sortBtnPressed]}
            onPress={onSortPress}
          >
            <Ionicons name="swap-vertical-outline" size={16} color={Colors.textSecondary} />
            <Text variant="caption" numberOfLines={1} style={styles.sortLabel}>
              {currentSortLabel}
            </Text>
            <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.filterContent, isWide && styles.filterContentWide]}>
        {FILTER_OPTIONS.map(({ key, label }) => {
          const count = counts[key]
          const isActive = activeFilter === key
          const filterColor = getFilterColor(key)
          const iconColor = isActive ? filterColor : Colors.textMuted

          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={({ pressed }) => [
                styles.filterTab,
                isActive && [
                  styles.filterTabActive,
                  { borderColor: filterColor },
                ],
                pressed && styles.filterTabPressed,
              ]}
              onPress={() => onFilterChange(key)}
            >
              <Ionicons name={FILTER_ICONS[key]} size={15} color={iconColor} />
              <Text
                variant="label"
                style={[styles.filterLabel, isActive && { color: filterColor }]}
              >
                {label}
              </Text>
              <View
                style={[
                  styles.badge,
                  isActive && [styles.badgeActive, { borderColor: filterColor }],
                ]}
              >
                <Text variant="label" style={[styles.badgeText, isActive && { color: filterColor }]}>
                  {count}
                </Text>
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}


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
  const isWide = width >= 768

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

      <LibraryFilters
        activeFilter={filter}
        activeViewMode={activeViewMode}
        counts={counts}
        currentSortLabel={currentSortLabel}
        filteredCount={filtered.length}
        isCustomSort={sort === 'custom'}
        isWide={isWide}
        onFilterChange={setFilter}
        onSortPress={() => setSortPickerVisible(true)}
        onViewModeChange={setViewMode}
      />

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
  filterPanel: {
    flexShrink: 0,
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  filterPanelWide: {
    paddingHorizontal: Spacing.md,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  filterTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  filterEyebrow: {
    color: Colors.textMuted,
  },
  filterResult: {
    color: Colors.textSecondary,
  },
  filterContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  filterContentWide: {
    paddingHorizontal: 0,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: 40,
    flexGrow: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterTabActive: {
    backgroundColor: Colors.surfaceRaised,
  },
  filterTabPressed: {
    backgroundColor: Colors.surfaceRaised,
  },
  filterLabel: {
    color: Colors.textSecondary,
    flexShrink: 0,
  },
  badge: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    minWidth: 22,
    minHeight: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeActive: {
    backgroundColor: Colors.surfaceRaised,
  },
  badgeText: {
    color: Colors.textMuted,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  viewToggle: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  toggleBtn: {
    width: 36,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  toggleBtnActive: {
    backgroundColor: Colors.surfaceRaised,
  },
  toggleBtnDisabled: {
    opacity: 0.35,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
    minHeight: 40,
    maxWidth: 190,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  sortBtnPressed: {
    backgroundColor: Colors.surfaceRaised,
  },
  sortLabel: {
    color: Colors.textSecondary,
    flexShrink: 1,
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
