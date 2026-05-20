import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type GestureResponderEvent,
  type NativeSyntheticEvent,
  type NativeTouchEvent,
  useWindowDimensions,
} from 'react-native'
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { GameListCard, LargeGameCard } from '@/components/GameDisplayCards'
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
import { isUpcomingRelease } from '@/lib/releaseDates'
import {
  LIBRARY_SORT_KEYS,
  STATUS_LABELS,
  type LibrarySortKey,
  type LibraryStatus,
} from '@/types'
import type { LibraryEntry } from '@/types/database'

type FilterStatus = Exclude<LibraryStatus, 'playing'> | 'all' | 'next'
type SortKey = LibrarySortKey
type ViewMode = 'grid' | 'list'
type SortDirection = 'asc' | 'desc'

const FILTER_OPTIONS: { key: FilterStatus; label: string; compactLabel: string }[] = [
  { key: 'all', label: 'All', compactLabel: 'All' },
  { key: 'want_to_play', label: 'TBP', compactLabel: 'TBP' },
  { key: 'done', label: 'Done', compactLabel: 'Done' },
  { key: 'did_not_finish', label: 'DNF', compactLabel: 'DNF' },
  { key: 'next', label: 'Next', compactLabel: 'Next' },
]

const FILTER_KEYS: FilterStatus[] = FILTER_OPTIONS.map(option => option.key)

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Recently Added' },
  { key: 'title', label: 'Title' },
  { key: 'rating', label: 'Rating' },
  { key: 'release_date', label: 'Release Date' },
  { key: 'finished_at', label: 'Finished Date' },
  { key: 'custom', label: 'Custom' },
]

const SORT_DEFAULT_DIRECTION: Record<SortKey, SortDirection> = {
  recent: 'desc',
  title: 'asc',
  rating: 'desc',
  release_date: 'desc',
  finished_at: 'desc',
  custom: 'asc',
}

function isSortKey(value: string | null): value is SortKey {
  return value != null && LIBRARY_SORT_KEYS.includes(value as SortKey)
}

function isFilterStatus(value: string | null): value is FilterStatus {
  return value != null && FILTER_KEYS.includes(value as FilterStatus)
}

function fuzzyMatch(text: string, query: string): boolean {
  if (query.length === 0) return true
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  return qi === q.length
}

function sortEntries(entries: LibraryEntry[], sort: SortKey, direction: SortDirection): LibraryEntry[] {
  const dir = direction === 'asc' ? 1 : -1
  return [...entries].sort((a, b) => {
    switch (sort) {
      case 'recent':
        return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      case 'title':
        return dir * a.game_title.localeCompare(b.game_title)
      case 'rating': {
        const rA = a.personal_rating ?? -1
        const rB = b.personal_rating ?? -1
        return dir * (rA - rB)
      }
      case 'release_date': {
        const dA = a.release_date != null ? new Date(a.release_date).getTime() : -1
        const dB = b.release_date != null ? new Date(b.release_date).getTime() : -1
        return dir * (dA - dB)
      }
      case 'finished_at': {
        const dA = a.finished_at != null ? new Date(a.finished_at).getTime() : -1
        const dB = b.finished_at != null ? new Date(b.finished_at).getTime() : -1
        return dir * (dA - dB)
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
  const insets = useSafeAreaInsets()
  const sheetPaddingBottom = isWeb ? Spacing.md : Math.max(insets.bottom + Spacing.xl, Spacing.section)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={[spStyles.overlay, isWeb ? spStyles.overlayCenter : spStyles.overlayBottom]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <View
          style={[isWeb ? spStyles.card : spStyles.sheet, { paddingBottom: sheetPaddingBottom }]}
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

function GameContextMenu({
  visible,
  entry,
  isCustomSort,
  isFirst,
  isLast,
  onDelete,
  onPushToTop,
  onPushToBottom,
  onDismiss,
}: {
  visible: boolean
  entry: LibraryEntry | null
  isCustomSort: boolean
  isFirst: boolean
  isLast: boolean
  onDelete: (id: string) => void
  onPushToTop: (id: string) => void
  onPushToBottom: (id: string) => void
  onDismiss: () => void
}) {
  const isWeb = Platform.OS === 'web'
  const insets = useSafeAreaInsets()
  const sheetPaddingBottom = isWeb ? Spacing.md : Math.max(insets.bottom + Spacing.xl, Spacing.section)

  if (entry == null) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={[cmStyles.overlay, isWeb ? cmStyles.overlayCenter : cmStyles.overlayBottom]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <View
          style={[isWeb ? cmStyles.card : cmStyles.sheet, { paddingBottom: sheetPaddingBottom }]}
          onStartShouldSetResponder={() => true}
        >
          {!isWeb && <View style={cmStyles.handle} />}
          <Text variant="subheading" style={cmStyles.title} numberOfLines={2}>
            {entry.game_title}
          </Text>
          {isCustomSort && !isFirst && (
            <Pressable
              style={({ pressed }) => [cmStyles.row, pressed && cmStyles.rowPressed]}
              onPress={() => { onPushToTop(entry.id); onDismiss() }}
            >
              <Ionicons name="arrow-up-circle-outline" size={20} color={Colors.textSecondary} />
              <Text variant="body">Move to top</Text>
            </Pressable>
          )}
          {isCustomSort && !isLast && (
            <Pressable
              style={({ pressed }) => [cmStyles.row, pressed && cmStyles.rowPressed]}
              onPress={() => { onPushToBottom(entry.id); onDismiss() }}
            >
              <Ionicons name="arrow-down-circle-outline" size={20} color={Colors.textSecondary} />
              <Text variant="body">Move to bottom</Text>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [cmStyles.row, pressed && cmStyles.rowPressed]}
            onPress={() => { onDismiss(); onDelete(entry.id) }}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.error} />
            <Text variant="body" style={{ color: Colors.error }}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const cmStyles = StyleSheet.create({
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
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  rowPressed: {
    backgroundColor: Colors.surfaceRaised,
  },
})

function LibraryFilters({
  activeFilter,
  activeViewMode,
  currentSortLabel,
  isCustomSort,
  isWide,
  searchQuery,
  sortDirection,
  onFilterChange,
  onSortPress,
  onViewModeChange,
  onSearchChange,
  onDirectionToggle,
}: {
  activeFilter: FilterStatus
  activeViewMode: ViewMode
  currentSortLabel: string
  isCustomSort: boolean
  isWide: boolean
  searchQuery: string
  sortDirection: SortDirection
  onFilterChange: (filter: FilterStatus) => void
  onSortPress: () => void
  onViewModeChange: (viewMode: ViewMode) => void
  onSearchChange: (q: string) => void
  onDirectionToggle: () => void
}) {
  return (
    <View style={[styles.filterPanel, isWide && styles.filterPanelWide]}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search games..."
        placeholderTextColor={Colors.textMuted}
        value={searchQuery}
        onChangeText={onSearchChange}
        clearButtonMode="while-editing"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={styles.controls}>
        <View style={styles.viewToggle}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Grid view"
            accessibilityState={{ selected: activeViewMode === 'grid' }}
            style={[styles.toggleBtn, activeViewMode === 'grid' && styles.toggleBtnActive]}
            onPress={() => onViewModeChange('grid')}
            hitSlop={4}
          >
            <Ionicons
              name="grid-outline"
              size={18}
              color={activeViewMode === 'grid' ? Colors.textPrimary : Colors.textSecondary}
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
              color={activeViewMode === 'list' ? Colors.textPrimary : Colors.textSecondary}
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

        {!isCustomSort && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={sortDirection === 'asc' ? 'Ascending order' : 'Descending order'}
            style={({ pressed }) => [styles.directionBtn, pressed && styles.sortBtnPressed]}
            onPress={onDirectionToggle}
            hitSlop={4}
          >
            <Ionicons
              name={sortDirection === 'asc' ? 'arrow-up-outline' : 'arrow-down-outline'}
              size={16}
              color={Colors.textSecondary}
            />
          </Pressable>
        )}
      </View>

      <View style={[styles.filterContent, isWide && styles.filterContentWide]}>
        {FILTER_OPTIONS.map(({ key, label, compactLabel }) => {
          const isActive = activeFilter === key
          const displayLabel = isWide ? label : compactLabel

          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={({ pressed }) => [
                styles.filterTab,
                isWide && styles.filterTabWide,
                !isWide && styles.filterTabCompact,
                isActive && styles.filterTabActive,
                pressed && !isActive && styles.filterTabPressed,
              ]}
              onPress={() => onFilterChange(key)}
            >
              <Text
                variant="label"
                numberOfLines={1}
                style={[styles.filterLabel, isActive && styles.filterLabelActive]}
              >
                {displayLabel}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}


export default function LibraryScreen() {
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>()
  const [filter, setFilter] = useState<FilterStatus>('want_to_play')
  const [sort, setSort] = useState<SortKey>('custom')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortPickerVisible, setSortPickerVisible] = useState(false)
  const [statusPickerEntry, setStatusPickerEntry] = useState<LibraryEntry | null>(null)
  const [contextMenuEntry, setContextMenuEntry] = useState<LibraryEntry | null>(null)
  const [customOrderIds, setCustomOrderIds] = useState<string[]>([])
  const customOrderIdsRef = useRef<string[]>([])

  const { data: entries, isLoading } = useLibraryEntries()
  const { mutate: updateEntry } = useUpdateLibraryEntry()
  const { mutate: removeEntry } = useRemoveFromLibrary()
  const { mutate: updateCustomOrder } = useUpdateLibraryCustomOrder()
  const { data: userPreferences, isSuccess: preferencesLoaded } = useUserPreferences()
  const { mutate: updateUserPreferences } = useUpdateUserPreferences()

  const { width } = useWindowDimensions()
  const activeViewMode = viewMode
  const numColumns = activeViewMode === 'grid' ? (width >= 768 ? 3 : 2) : 1
  const isWide = width >= 768

  useEffect(() => {
    const nextFilter = Array.isArray(filterParam) ? filterParam[0] : filterParam
    if (isFilterStatus(nextFilter)) {
      setFilter(nextFilter)
    }
  }, [filterParam])

  useEffect(() => {
    if (!preferencesLoaded || userPreferences == null) return
    if (isSortKey(userPreferences.library_sort)) {
      setSort(userPreferences.library_sort)
      setSortDirection(SORT_DEFAULT_DIRECTION[userPreferences.library_sort])
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
    const byStatus =
      filter === 'all'
        ? all
        : filter === 'next'
          ? all.filter(e => isUpcomingRelease(e.release_date))
          : all.filter(e => e.status === filter)
    return sort === 'custom' ? orderEntriesByIds(byStatus, customOrderIds) : sortEntries(byStatus, sort, sortDirection)
  }, [customOrderIds, entries, filter, sort, sortDirection])

  const searchFiltered = useMemo(() => {
    const q = searchQuery.trim()
    if (q.length === 0) return filtered
    return filtered.filter(e => fuzzyMatch(e.game_title, q))
  }, [filtered, searchQuery])

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

  const handlePushToTop = useCallback((id: string) => {
    const next = [id, ...customOrderIdsRef.current.filter(i => i !== id)]
    customOrderIdsRef.current = next
    setCustomOrderIds(next)
    updateCustomOrder(next)
  }, [updateCustomOrder])

  const handlePushToBottom = useCallback((id: string) => {
    const next = [...customOrderIdsRef.current.filter(i => i !== id), id]
    customOrderIdsRef.current = next
    setCustomOrderIds(next)
    updateCustomOrder(next)
  }, [updateCustomOrder])

  const handleSortSelect = useCallback((nextSort: SortKey) => {
    setSort(nextSort)
    setSortDirection(SORT_DEFAULT_DIRECTION[nextSort])
    setSortPickerVisible(false)
    updateUserPreferences({ library_sort: nextSort })
  }, [updateUserPreferences])

  const currentSortLabel = SORT_OPTIONS.find(s => s.key === sort)?.label ?? 'Sort'

  const emptyHeading =
    filter === 'all'
      ? 'No games yet'
      : filter === 'next'
        ? 'No upcoming games'
        : `No ${filter === 'did_not_finish' ? 'Did Not Finish' : STATUS_LABELS[filter]} games`

  const emptySubtext =
    filter === 'all'
      ? 'Search for games and add them to your library'
      : filter === 'next'
        ? 'Games that are not yet released will appear here'
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

  const contextMenuIndex = contextMenuEntry != null ? filtered.findIndex(e => e.id === contextMenuEntry.id) : -1

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text variant="heading">Library</Text>
        <Text variant="caption" style={styles.resultLabel}>
          {searchFiltered.length === 1 ? '1 game' : `${searchFiltered.length} games`}
        </Text>
      </View>

      <LibraryFilters
        activeFilter={filter}
        activeViewMode={activeViewMode}
        currentSortLabel={currentSortLabel}
        isCustomSort={sort === 'custom'}
        isWide={isWide}
        searchQuery={searchQuery}
        sortDirection={sortDirection}
        onFilterChange={setFilter}
        onSortPress={() => setSortPickerVisible(true)}
        onViewModeChange={setViewMode}
        onSearchChange={setSearchQuery}
        onDirectionToggle={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
      />

      {/* Game list */}
      <FlatList
        data={searchFiltered}
        renderItem={({ item, index }) => {
          const card =
            activeViewMode === 'grid' ? (
              <LargeGameCard
                entry={item}
                onStatusPress={setStatusPickerEntry}
                onLongPress={() => setContextMenuEntry(item)}
              />
            ) : (
              <GameListCard
                entry={item}
                onStatusPress={setStatusPickerEntry}
                onDelete={handleDelete}
                onLongPress={() => setContextMenuEntry(item)}
              />
            )
          if (sort === 'custom' && activeViewMode === 'list' && searchQuery.trim().length === 0) {
            return (
              <ReorderableLibraryEntry
                entry={item}
                canMoveUp={index > 0}
                canMoveDown={index < searchFiltered.length - 1}
                onMove={handleCustomMove}
                onDragEnd={handleCustomDragEnd}
              >
                {card}
              </ReorderableLibraryEntry>
            )
          }
          if (activeViewMode === 'list' && Platform.OS !== 'web') {
            return (
              <ReanimatedSwipeable
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
              </ReanimatedSwipeable>
            )
          }
          return card
        }}
        keyExtractor={item => item.id}
        numColumns={numColumns}
        key={`${activeViewMode}-${numColumns}-${sort}`}
        contentContainerStyle={[
          styles.listContent,
          searchFiltered.length === 0 && styles.listContentEmpty,
        ]}
        columnWrapperStyle={activeViewMode === 'grid' ? styles.gridRow : undefined}
        ItemSeparatorComponent={activeViewMode === 'grid' ? () => <View style={styles.gridGap} /> : undefined}
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

      <GameContextMenu
        visible={contextMenuEntry != null}
        entry={contextMenuEntry}
        isCustomSort={sort === 'custom'}
        isFirst={contextMenuIndex === 0}
        isLast={contextMenuIndex === filtered.length - 1}
        onDelete={handleDelete}
        onPushToTop={handlePushToTop}
        onPushToBottom={handlePushToBottom}
        onDismiss={() => setContextMenuEntry(null)}
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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.xxs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterPanel: {
    flexShrink: 0,
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    marginTop: -Spacing.xs,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
    backgroundColor: Colors.background,
  },
  filterPanelWide: {
    paddingHorizontal: Spacing.lg,
  },
  resultLabel: {
    color: Colors.textSecondary,
  },
  filterContent: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: Spacing.xs,
  },
  filterContentWide: {
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    width: 92,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterTabCompact: {
    width: 60,
    minHeight: 40,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xxs,
  },
  filterTabWide: {
    width: 108,
    paddingHorizontal: Spacing.md,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterTabPressed: {
    backgroundColor: Colors.surfaceRaised,
  },
  filterLabel: {
    color: Colors.textSecondary,
    flexShrink: 1,
    minWidth: 0,
  },
  filterLabelActive: {
    color: Colors.textPrimary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.xs,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    backgroundColor: Colors.background,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: Spacing.xxs,
    padding: 1,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    backgroundColor: Colors.surface,
  },
  toggleBtn: {
    width: 34,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: 'transparent',
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
    marginLeft: 'auto',
    minHeight: 36,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  sortBtnPressed: {
    opacity: 0.82,
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
  searchInput: {
    height: 38,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  directionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
})
