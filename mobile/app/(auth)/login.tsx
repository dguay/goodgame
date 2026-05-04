import { useState } from 'react'
import { View, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FontAwesome } from '@expo/vector-icons'
import { Text } from '@/components/ui/Text'
import { RawgFooter } from '@/components/RawgFooter'
import { signInWithGoogle } from '@/lib/auth'
import { Colors, Spacing, FontSize } from '@/constants'

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      await signInWithGoogle()
    } catch {
      Alert.alert('Sign in failed', 'Could not sign in with Google. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text variant="display" style={styles.logo}>GameLog</Text>
          <Text variant="body" color={Colors.textSecondary} style={styles.tagline}>
            Your gaming journey, tracked.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#1F1F1F" size="small" />
            ) : (
              <>
                <FontAwesome name="google" size={18} color="#4285F4" />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </Pressable>
        </View>
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
    justifyContent: 'space-evenly',
    paddingHorizontal: Spacing.xl,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logo: {
    color: Colors.primary,
    letterSpacing: -1,
  },
  tagline: {
    textAlign: 'center',
    maxWidth: 240,
  },
  actions: {
    width: '100%',
    gap: Spacing.md,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FFFFFF',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 12,
    minHeight: 52,
  },
  googleButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: FontSize.md,
    color: '#1F1F1F',
  },
  pressed: {
    opacity: 0.85,
  },
})
