import { ScrollView, RefreshControl, View, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArpgEvents } from '@/components/ArpgEvents'
import { TrendingGamesNews } from '@/components/TrendingGamesNews'
import { GamingNews } from '@/components/GamingNews'
import { Text } from '@/components/ui/Text'
import { Colors, FontFamily, FontSize, Spacing } from '@/constants'

export default function NewsScreen() {
  const [refreshing, setRefreshing] = useState(false)
  const queryClient = useQueryClient()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['news'] }),
        queryClient.invalidateQueries({ queryKey: ['news-clusters'] }),
        queryClient.invalidateQueries({ queryKey: ['trending-games'] }),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [queryClient])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text variant="heading" style={styles.headerTitle}>News</Text>
        </View>
        <ArpgEvents />
        <TrendingGamesNews />
        <GamingNews />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xxl,
  },
})
