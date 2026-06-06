import { useState, useCallback, useRef } from 'react'
import { useFocusEffect } from 'expo-router'
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Platform,
  Keyboard,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '@/components/ui/Text'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { EmptyState } from '@/components/ui/EmptyState'
import { RawgFooter } from '@/components/RawgFooter'
import { GameListCard } from '@/components/GameDisplayCards'
import { useGameSearchInfinite } from '@/hooks/useRawg'
import { useDebounce } from '@/hooks/useDebounce'
import { Colors, Spacing } from '@/constants'
import type { RawgGame } from '@/types/rawg'

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
  const inputRef = useRef<TextInput>(null)

  const isSearching = debouncedQuery.length > 1

  const searchResult = useGameSearchInfinite(debouncedQuery)

  const gameData: RawgGame[] = isSearching
    ? searchResult.data?.pages.flatMap(p => p.results) ?? []
    : []

  const isLoading = isSearching && searchResult.isLoading
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
    ({ item }: { item: RawgGame }) => <GameListCard game={item} />,
    [],
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
      {isLoading && <ListSkeletons />}

      {/* No results */}
      {hasNoResults && (
        <EmptyState
          icon="search-outline"
          heading="No results"
          subtext={`No games found for "${debouncedQuery}"`}
        />
      )}

      {/* Results */}
      {isSearching && !isLoading && !hasNoResults && (
        <FlatList
          data={gameData}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
          ListFooterComponent={
            <View>
              {searchResult.isFetchingNextPage && (
                <View style={styles.loadingMore}>
                  <SkeletonLoader height={60} borderRadius={8} />
                </View>
              )}
              {searchResult.hasNextPage && !searchResult.isFetchingNextPage && (
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
