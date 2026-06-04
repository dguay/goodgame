import { useState, useCallback, useRef } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  useWindowDimensions,
  Platform,
  Keyboard,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '@/components/ui/Text'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { EmptyState } from '@/components/ui/EmptyState'
import { RawgFooter } from '@/components/RawgFooter'
import { GameListCard, SmallGameCard } from '@/components/GameDisplayCards'
import { useGameSearchInfinite, useTopRated } from '@/hooks/useRawg'
import { useDebounce } from '@/hooks/useDebounce'
import { Colors, Spacing } from '@/constants'
import type { RawgGame } from '@/types/rawg'

const H_PAD = Spacing.md      // 16
const COL_GAP = Spacing.sm    // 8
// Each card: marginHorizontal = COL_GAP/2 = 4
// FlatList paddingHorizontal = H_PAD - COL_GAP/2 = 12
// Net edge space = 12 + 4 = 16 = H_PAD
// Net gap between cards = 4 + 4 = 8 = COL_GAP
const CARD_MARGIN = COL_GAP / 2

function GridSkeletons({ cardWidth }: { cardWidth: number }) {
  return (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: 6 }, (_, i) => (
        <View key={i} style={[styles.skeletonCard, { width: cardWidth }]}>
          <SkeletonLoader height={130} borderRadius={8} />
          <SkeletonLoader height={14} style={styles.skeletonGap} />
          <SkeletonLoader height={12} width="60%" style={styles.skeletonGap} />
        </View>
      ))}
    </View>
  )
}

function ListSkeletons() {
  return (
    <View>
      {Array.from({ length: 8 }, (_, i) => (
        <View key={i} style={styles.skeletonListItem}>
          <SkeletonLoader width={60} height={80} borderRadius={6} />
          <View style={styles.skeletonListInfo}>
            <SkeletonLoader height={14} />
            <SkeletonLoader height={12} width="50%" style={styles.skeletonGap} />
          </View>
        </View>
      ))}
    </View>
  )
}

export default function SearchScreen() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query)
  const { width } = useWindowDimensions()
  const inputRef = useRef<TextInput>(null)

  const isSearching = debouncedQuery.length > 1

  const topRated = useTopRated()
  const searchResult = useGameSearchInfinite(debouncedQuery)

  const cardWidth = (width - (H_PAD - CARD_MARGIN) * 2 - COL_GAP) / 2

  const gameData: RawgGame[] = isSearching
    ? (searchResult.data?.pages.flatMap(p => p.results) ?? [])
    : (topRated.data?.results ?? [])

  const isLoading = isSearching ? searchResult.isLoading : topRated.isLoading
  const hasNoResults =
    isSearching &&
    !searchResult.isLoading &&
    gameData.length === 0 &&
    debouncedQuery.length > 1

  const handleLoadMore = useCallback(() => {
    if (searchResult.hasNextPage && !searchResult.isFetchingNextPage) {
      void searchResult.fetchNextPage()
    }
  }, [searchResult])

  const renderItem = useCallback(
    ({ item }: { item: RawgGame }) => {
      if (isSearching) return <GameListCard game={item} />
      return <SmallGameCard game={item} style={styles.gridCard} />
    },
    [isSearching],
  )

  useFocusEffect(
    useCallback(() => {
      inputRef.current?.focus()
    }, []),
  )

  const clearQuery = useCallback(() => {
    setQuery('')
    inputRef.current?.focus()
  }, [])

  const COLUMNS = isSearching ? 1 : 2

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="Search games..."
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {query.length > 0 && Platform.OS !== 'ios' && (
          <Pressable onPress={clearQuery} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Loading */}
      {isLoading && (
        isSearching
          ? <ListSkeletons />
          : <GridSkeletons cardWidth={cardWidth} />
      )}

      {/* No results */}
      {hasNoResults && (
        <EmptyState
          icon="search-outline"
          heading="No results"
          subtext={`No games found for "${debouncedQuery}"`}
        />
      )}

      {/* Results */}
      {!isLoading && !hasNoResults && (
        <FlatList
          key={isSearching ? 'list' : 'grid'}
          data={gameData}
          keyExtractor={item => String(item.id)}
          numColumns={COLUMNS}
          contentContainerStyle={
            isSearching ? styles.listContent : styles.gridContent
          }
          renderItem={renderItem}
          onEndReached={isSearching ? handleLoadMore : undefined}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
          ListHeaderComponent={
            !isSearching ? (
              <Text variant="subheading" style={styles.sectionTitle}>
                Popular Games
              </Text>
            ) : null
          }
          ListFooterComponent={
            <View>
              {isSearching && searchResult.isFetchingNextPage && (
                <View style={styles.loadingMore}>
                  <SkeletonLoader height={60} borderRadius={8} />
                </View>
              )}
              {isSearching &&
                searchResult.hasNextPage &&
                !searchResult.isFetchingNextPage && (
                  <Pressable style={styles.loadMoreBtn} onPress={handleLoadMore}>
                    <Text variant="body" color={Colors.primary}>
                      Load more
                    </Text>
                  </Pressable>
                )}
              <RawgFooter />
            </View>
          }
        />
      )}

      {/* Footer visible when loading (no FlatList) */}
      {isLoading && <RawgFooter />}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    padding: 0,
  },
  // Grid layout
  gridContent: {
    paddingHorizontal: H_PAD - CARD_MARGIN,
    paddingBottom: Spacing.xl,
  },
  gridCard: {
    flex: 1,
    marginHorizontal: CARD_MARGIN,
    marginBottom: COL_GAP,
  },
  sectionTitle: {
    marginHorizontal: CARD_MARGIN,
    marginBottom: Spacing.md,
  },
  // List layout
  listContent: {
    paddingBottom: Spacing.xl,
  },
  // Load more
  loadingMore: {
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.md,
  },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  // Skeletons
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: H_PAD - CARD_MARGIN,
  },
  skeletonCard: {
    marginHorizontal: CARD_MARGIN,
    marginBottom: COL_GAP,
    gap: Spacing.xs,
  },
  skeletonGap: {
    marginTop: Spacing.xs,
  },
  skeletonListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  skeletonListInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
})
