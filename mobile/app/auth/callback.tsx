import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import * as Linking from 'expo-linking'
import { router, useLocalSearchParams } from 'expo-router'
import { Text } from '@/components/ui/Text'
import { RawgFooter } from '@/components/RawgFooter'
import { completeNativeAuthSession } from '@/lib/auth'
import { Colors, Spacing } from '@/constants'

const NativeRedirectUrl = 'goodgame://auth/callback'

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value
  return value?.[0] ?? null
}

function callbackUrlFromParams(params: Record<string, string | string[] | undefined>): string | null {
  const callbackParams = new URLSearchParams()

  for (const key of ['code', 'access_token', 'refresh_token', 'error', 'error_code', 'error_description']) {
    const value = firstParam(params[key])
    if (value != null) {
      callbackParams.set(key, value)
    }
  }

  const query = callbackParams.toString()
  return query.length > 0 ? `${NativeRedirectUrl}?${query}` : null
}

export default function AuthCallbackScreen() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const params = useLocalSearchParams()
  const paramsUrl = useMemo(() => callbackUrlFromParams(params), [params])

  useEffect(() => {
    let isMounted = true

    async function finishWithUrl(url: string): Promise<void> {
      try {
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

    async function completeSignIn(): Promise<(() => void) | undefined> {
      const initialUrl = await Linking.getInitialURL()
      const callbackUrl = initialUrl ?? paramsUrl

      if (callbackUrl != null) {
        await finishWithUrl(callbackUrl)
        return
      }

      const subscription = Linking.addEventListener('url', ({ url }) => {
        finishWithUrl(url)
      })

      return () => {
        subscription.remove()
      }
    }

    let removeUrlListener: (() => void) | undefined

    completeSignIn()
      .then((cleanup) => {
        removeUrlListener = cleanup
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not finish sign in'
        if (isMounted) {
          setErrorMessage(message)
        }
      })

    return () => {
      isMounted = false
      removeUrlListener?.()
    }
  }, [paramsUrl])

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
