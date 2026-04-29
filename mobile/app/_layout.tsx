import { Stack, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { useFonts } from 'expo-font'
import { Syne_400Regular, Syne_700Bold } from '@expo-google-fonts/syne'
import { DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
    },
  },
})

// Separate component so hooks run inside the QueryClientProvider tree
function AuthGuard() {
  const { isAuthenticated, isLoading, setSession } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('[Auth] page URL on mount:', window.location.href)
    }

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('[Auth] getSession →', session?.user?.email ?? 'null', error ?? '')
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] onAuthStateChange →', event, session?.user?.email ?? 'null')
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [setSession])

  useEffect(() => {
    if (isLoading) return
    const inAuthGroup = segments[0] === '(auth)'
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/')
    }
  }, [isAuthenticated, isLoading, segments, router])

  return null
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Syne-Regular': Syne_400Regular,
    'Syne-Bold': Syne_700Bold,
    'DMSans-Regular': DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
  })

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, fontError])

  if (!fontsLoaded && !fontError) {
    return null
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="game/[id]" options={{ headerShown: true }} />
      </Stack>
    </QueryClientProvider>
  )
}
