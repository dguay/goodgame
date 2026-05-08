import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import { Text } from '@/components/ui/Text'
import { RawgFooter } from '@/components/RawgFooter'
import { completeNativeAuthSession } from '@/lib/auth'
import { Colors, Spacing } from '@/constants'

export default function AuthCallbackScreen() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function completeSignIn(): Promise<void> {
      try {
        const url = await Linking.getInitialURL()
        if (url == null) {
          throw new Error('No sign-in callback URL was provided')
        }

        await completeNativeAuthSession(url)
        if (isMounted) {
          router.replace('/')
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Could not finish sign in'
        if (isMounted) {
          setErrorMessage(message)
        }
      }
    }

    completeSignIn()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {errorMessage == null ? (
          <>
            <ActivityIndicator color={Colors.primary} size="small" />
            <Text color={Colors.textSecondary} style={styles.message}>
              Finishing sign in...
            </Text>
          </>
        ) : (
          <>
            <Text variant="subheading" style={styles.title}>
              Sign in failed
            </Text>
            <Text color={Colors.textSecondary} style={styles.message}>
              {errorMessage}
            </Text>
          </>
        )}
      </View>
      <RawgFooter />
    </View>
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
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  title: {
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
})
