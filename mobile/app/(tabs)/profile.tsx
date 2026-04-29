import { useState } from 'react'
import { View, StyleSheet, Pressable, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '@/components/ui/Text'
import { RawgFooter } from '@/components/RawgFooter'
import { signOut } from '@/lib/auth'
import { Colors, Spacing, FontSize } from '@/constants'

export default function ProfileScreen() {
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsSigningOut(true)
            await signOut()
          } catch {
            Alert.alert('Error', 'Could not sign out. Please try again.')
          } finally {
            setIsSigningOut(false)
          }
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text variant="heading">Profile</Text>
        <Text variant="caption" style={styles.subtitle}>
          Full profile coming in a later phase
        </Text>
      </View>

      <View style={styles.settings}>
        <Pressable
          style={({ pressed }) => [styles.settingsRow, pressed && styles.rowPressed]}
          onPress={handleSignOut}
          disabled={isSigningOut}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.signOutLabel}>
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </Text>
        </Pressable>
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
    gap: Spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
  },
  settings: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  rowPressed: {
    opacity: 0.6,
  },
  signOutLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: FontSize.md,
    color: Colors.error,
  },
})
