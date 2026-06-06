import { Platform } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from './supabase'
import { parseAuthCallbackParams } from './authHelpers'

WebBrowser.maybeCompleteAuthSession()

const NativeRedirectScheme = process.env.EXPO_PUBLIC_AUTH_REDIRECT_SCHEME ?? 'goodgame'
const NativeRedirectUrl = `${NativeRedirectScheme}://auth/callback`

export async function completeNativeAuthSession(url: string): Promise<void> {
  const params = parseAuthCallbackParams(url)
  const error = params.get('error') ?? params.get('error_code')
  if (error != null) {
    throw new Error(params.get('error_description') ?? error)
  }

  const code = params.get('code')
  if (code != null) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) throw exchangeError
    return
  }

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (accessToken != null && refreshToken != null) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (sessionError) throw sessionError
    return
  }

  throw new Error('No auth session returned from Supabase')
}

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

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: NativeRedirectUrl,
      skipBrowserRedirect: true,
    },
  })
  if (error) throw error
  if (!data.url) throw new Error('No auth URL returned from Supabase')

  const result = await WebBrowser.openAuthSessionAsync(data.url, NativeRedirectUrl)
  if (result.type !== 'success') return

  await completeNativeAuthSession(result.url)
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function signInWithMagicLink(email: string): Promise<void> {
  const emailRedirectTo = Platform.OS === 'web'
    ? (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined)
    : NativeRedirectUrl

  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })
  if (error) throw error
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  const emailRedirectTo = Platform.OS === 'web'
    ? (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined)
    : NativeRedirectUrl

  const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } })
  if (error) throw error
}
