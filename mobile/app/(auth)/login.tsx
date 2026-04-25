import { View, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text } from '@/components/ui/Text'
import { RawgFooter } from '@/components/RawgFooter'
import { Colors } from '@/constants'

export default function LoginScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text variant="display" style={styles.logo}>GameLog</Text>
        <Text variant="body" color={Colors.textSecondary} style={styles.tagline}>
          Your gaming journey, tracked.
        </Text>
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
  logo: {
    color: Colors.primary,
    letterSpacing: -1,
  },
  tagline: {
    textAlign: 'center',
  },
})
