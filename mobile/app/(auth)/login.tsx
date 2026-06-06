import { useState } from 'react'
import { View, StyleSheet, Pressable, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FontAwesome } from '@expo/vector-icons'
import { Text } from '@/components/ui/Text'
import { signInWithGoogle, signInWithMagicLink, signInWithEmail, signUpWithEmail } from '@/lib/auth'
import { Colors, Spacing, FontSize, Radius, FontFamily } from '@/constants'
import appIcon from '../../assets/images/icon.png'

type LoginMode = 'default' | 'magic-link-sent' | 'password'
type PasswordTab = 'signin' | 'signup'

export default function LoginScreen() {
  const [mode, setMode] = useState<LoginMode>('default')
  const [passwordTab, setPasswordTab] = useState<PasswordTab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  const handleMagicLink = async () => {
    if (!email.trim()) {
      Alert.alert('Email required', 'Enter your email address.')
      return
    }
    try {
      setIsLoading(true)
      await signInWithMagicLink(email.trim())
      setMode('magic-link-sent')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not send magic link.'
      Alert.alert('Sign in failed', message)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Enter both email and password.')
      return
    }
    try {
      setIsLoading(true)
      if (passwordTab === 'signin') {
        await signInWithEmail(email.trim(), password)
      } else {
        await signUpWithEmail(email.trim(), password)
        Alert.alert('Account created', 'Check your email to confirm your address, then sign in.')
        setPasswordTab('signin')
        setPassword('')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed.'
      Alert.alert(passwordTab === 'signin' ? 'Sign in failed' : 'Sign up failed', message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <View style={styles.hero}>
            <Image source={appIcon} style={styles.appIcon} contentFit="cover" />
            <Text variant="display" style={styles.logo}>Goodgame</Text>
            <Text variant="body" color={Colors.textSecondary} style={styles.tagline}>
              Your gaming journey, tracked.
            </Text>
          </View>

          {mode === 'magic-link-sent' ? (
            <MagicLinkSentView email={email} onBack={() => setMode('default')} />
          ) : (
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

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text variant="caption" color={Colors.textMuted}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {mode === 'password' ? (
                <PasswordForm
                  email={email}
                  password={password}
                  tab={passwordTab}
                  isLoading={isLoading}
                  onEmailChange={setEmail}
                  onPasswordChange={setPassword}
                  onTabChange={setPasswordTab}
                  onSubmit={handlePasswordSubmit}
                  onSwitchToMagicLink={() => { setMode('default'); setPassword('') }}
                />
              ) : (
                <MagicLinkForm
                  email={email}
                  isLoading={isLoading}
                  onEmailChange={setEmail}
                  onSubmit={handleMagicLink}
                  onSwitchToPassword={() => setMode('password')}
                />
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

interface MagicLinkFormProps {
  email: string
  isLoading: boolean
  onEmailChange: (v: string) => void
  onSubmit: () => void
  onSwitchToPassword: () => void
}

function MagicLinkForm({ email, isLoading, onEmailChange, onSubmit, onSwitchToPassword }: MagicLinkFormProps) {
  return (
    <>
      <TextInput
        style={styles.input}
        placeholder="Email address"
        placeholderTextColor={Colors.textMuted}
        value={email}
        onChangeText={onEmailChange}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <Pressable
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, isLoading && styles.disabledButton]}
        onPress={onSubmit}
        disabled={isLoading}
      >
        {isLoading
          ? <ActivityIndicator color={Colors.textPrimary} size="small" />
          : <Text style={styles.primaryButtonText}>Send magic link</Text>
        }
      </Pressable>
      <Pressable onPress={onSwitchToPassword} style={styles.linkButton}>
        <Text variant="caption" color={Colors.textSecondary}>Use password instead</Text>
      </Pressable>
    </>
  )
}

interface MagicLinkSentViewProps {
  email: string
  onBack: () => void
}

function MagicLinkSentView({ email, onBack }: MagicLinkSentViewProps) {
  return (
    <View style={styles.sentContainer}>
      <FontAwesome name="envelope-o" size={40} color={Colors.primary} />
      <Text variant="subheading" style={styles.sentTitle}>Check your email</Text>
      <Text variant="body" color={Colors.textSecondary} style={styles.sentBody}>
        We sent a sign-in link to{' '}
        <Text variant="body" color={Colors.textPrimary}>{email}</Text>
      </Text>
      <Pressable onPress={onBack} style={styles.linkButton}>
        <Text variant="caption" color={Colors.textSecondary}>Back to sign in</Text>
      </Pressable>
    </View>
  )
}

interface PasswordFormProps {
  email: string
  password: string
  tab: PasswordTab
  isLoading: boolean
  onEmailChange: (v: string) => void
  onPasswordChange: (v: string) => void
  onTabChange: (t: PasswordTab) => void
  onSubmit: () => void
  onSwitchToMagicLink: () => void
}

function PasswordForm({
  email, password, tab, isLoading,
  onEmailChange, onPasswordChange, onTabChange, onSubmit, onSwitchToMagicLink,
}: PasswordFormProps) {
  return (
    <>
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, tab === 'signin' && styles.tabActive]}
          onPress={() => onTabChange('signin')}
        >
          <Text variant="label" color={tab === 'signin' ? Colors.textPrimary : Colors.textMuted}>
            Sign in
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'signup' && styles.tabActive]}
          onPress={() => onTabChange('signup')}
        >
          <Text variant="label" color={tab === 'signup' ? Colors.textPrimary : Colors.textMuted}>
            Sign up
          </Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Email address"
        placeholderTextColor={Colors.textMuted}
        value={email}
        onChangeText={onEmailChange}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={Colors.textMuted}
        value={password}
        onChangeText={onPasswordChange}
        secureTextEntry
        textContentType={tab === 'signup' ? 'newPassword' : 'password'}
      />

      <Pressable
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, isLoading && styles.disabledButton]}
        onPress={onSubmit}
        disabled={isLoading}
      >
        {isLoading
          ? <ActivityIndicator color={Colors.textPrimary} size="small" />
          : <Text style={styles.primaryButtonText}>{tab === 'signin' ? 'Sign in' : 'Sign up'}</Text>
        }
      </Pressable>

      <Pressable onPress={onSwitchToMagicLink} style={styles.linkButton}>
        <Text variant="caption" color={Colors.textSecondary}>Use magic link instead</Text>
      </Pressable>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoid: {
    flex: 1,
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
  appIcon: {
    width: 96,
    height: 96,
    borderRadius: Radius.xl,
    marginBottom: Spacing.sm,
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
    fontFamily: FontFamily.medium,
    fontSize: FontSize.md,
    color: '#1F1F1F',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  input: {
    width: '100%',
    height: 52,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
    fontFamily: FontFamily.body,
    fontSize: FontSize.md,
  },
  primaryButton: {
    width: '100%',
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  disabledButton: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.85,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.surfaceRaised,
  },
  sentContainer: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  sentTitle: {
    color: Colors.textPrimary,
  },
  sentBody: {
    textAlign: 'center',
  },
})
