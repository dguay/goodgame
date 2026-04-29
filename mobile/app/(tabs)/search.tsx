import { View, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text } from '@/components/ui/Text'
import { RawgFooter } from '@/components/RawgFooter'
import { Colors } from '@/constants'
import { useNewReleases } from '@/hooks/useRawg'

export default function SearchScreen() {
  const { data, isLoading, error } = useNewReleases()

  const firstGame = data?.results[0]

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text variant="heading">Search</Text>
        {isLoading && <Text variant="body">Loading…</Text>}
        {error != null && <Text variant="body">Error: {(error as Error).message}</Text>}
        {firstGame != null && (
          <Text variant="body">Latest release: {firstGame.name}</Text>
        )}
      </View>
      <RawgFooter />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
})
