import { Platform } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import { supabase } from './supabase'

WebBrowser.maybeCompleteAuthSession()

export async function signInWithGoogle(): Promise<void> {
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    })
    if (error) throw error
    return
  }

  // Native: open Google OAuth in an in-app browser, then exchange the code for a session.
  // makeRedirectUri returns gamelog://auth/callback in standalone builds,
  // or exp://... in Expo Go development.
  const redirectUrl = makeRedirectUri({ scheme: 'gamelog', path: 'auth/callback' })

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  })
  if (error) throw error
  if (!data.url) throw new Error('No auth URL returned from Supabase')

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)
  if (result.type !== 'success') return

  const callbackUrl = new URL(result.url)
  const code = callbackUrl.searchParams.get('code')
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) throw exchangeError
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
