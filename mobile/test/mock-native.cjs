require('./resolve-alias.cjs')
const Module = require('module')
const React = require('react')

function host(type) {
  return function Host(props) {
    return React.createElement(type, props, props && props.children)
  }
}

const reactNative = {
  ActivityIndicator: host('div'),
  Modal: host('div'),
  Platform: { OS: 'web', select: (options) => options.web ?? options.default },
  Pressable: host('div'),
  ScrollView: host('div'),
  StyleSheet: { create: (styles) => styles, absoluteFill: {} },
  Text: host('span'),
  TextInput: host('input'),
  View: host('div'),
}

const original = Module.prototype.require
Module.prototype.require = function (id) {
  const screen = globalThis.__pcgwScreenFixture
  if (screen) {
    if (id === '@/hooks/useRawg') return {
      useGameDetail: () => ({ data: screen.game, isLoading: false, isError: false }),
      useGameScreenshots: () => ({ data: { results: [] }, isLoading: false, isError: false }),
    }
    if (id === '@/hooks/useLibrary') return {
      useLibraryEntry: () => null,
      useUpdateLibraryEntry: () => ({ mutate: () => undefined }),
    }
    if (id === '@/hooks/useSteam') return {
      useSteamAppId: () => ({ data: screen.steamAppId, isFetched: true, isError: false, isLoading: false }),
    }
    if (id === '@/lib/supabase') return { supabase: screen.supabase }
    if (id === '@/components/AddToLibraryButton') return { AddToLibraryButton: host('div') }
    if (id === '@/components/DateField') return { DateField: host('div') }
    if (id === '@/components/RatingInput') return { RatingInput: host('div') }
    if (id === '@/components/RawgFooter') return { RawgFooter: host('div') }
    if (id === '@/components/ui') return { LoadingSpinner: host('div'), EmptyState: host('div') }
  }
  if (id === 'react-native') return reactNative
  if (id === 'expo-secure-store') {
    return {
      getItemAsync: async () => null,
      setItemAsync: async () => undefined,
      deleteItemAsync: async () => undefined,
    }
  }
  if (id === 'expo-image') return { Image: host('img') }
  if (id === 'expo-linear-gradient') return { LinearGradient: host('div') }
  if (id === '@expo/vector-icons') return { Ionicons: host('i') }
  if (id === 'expo-router') {
    return {
      Stack: { Screen: host('div') },
      router: { back: () => undefined },
      useLocalSearchParams: () => ({ id: '10533' }),
    }
  }
  if (id === 'react-native-safe-area-context') {
    return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }
  }
  return original.apply(this, arguments)
}
