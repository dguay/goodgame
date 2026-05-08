import { Tabs, router, usePathname, type Href } from 'expo-router'
import { Platform, useWindowDimensions, View, Pressable, StyleSheet, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TabActions } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, Spacing, FontSize } from '@/constants'

type IoniconsName = keyof typeof Ionicons.glyphMap

const TABS: { name: string; path: Href; label: string; icon: IoniconsName; iconActive: IoniconsName }[] = [
  { name: 'index', path: '/', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'search', path: '/search', label: 'Search', icon: 'search-outline', iconActive: 'search' },
  { name: 'library', path: '/library', label: 'Library', icon: 'bookmark-outline', iconActive: 'bookmark' },
  { name: 'profile', path: '/profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
]

type Route = { key: string; name: string }
type TabState = { index: number; routes: Route[]; key: string }
type TabNavigation = {
  emit: (opts: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean }
  dispatch: (action: ReturnType<typeof TabActions.jumpTo>) => void
}
type TabBarProps = { state: TabState; descriptors: Record<string, unknown>; navigation: TabNavigation }

function SideNavBar() {
  const pathname = usePathname()

  return (
    <View style={styles.sideNav}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>Goodgame</Text>
      </View>
      {TABS.map((tab) => {
        const isFocused = pathname === tab.path || (pathname === '/' && tab.path === '/')
        return (
          <Pressable
            key={tab.name}
            onPress={() => router.push(tab.path)}
            style={[styles.sideNavItem, isFocused && styles.sideNavItemActive]}
          >
            <Ionicons
              name={isFocused ? tab.iconActive : tab.icon}
              size={20}
              color={isFocused ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.sideNavLabel, isFocused && styles.sideNavLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function BottomTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[index]
        const isFocused = state.index === index
        return (
          <Pressable
            key={route.key}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
              if (!isFocused && !event.defaultPrevented) {
                navigation.dispatch(TabActions.jumpTo(route.name))
              }
            }}
            style={styles.bottomTabItem}
          >
            <Ionicons
              name={isFocused ? tab.iconActive : tab.icon}
              size={24}
              color={isFocused ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.bottomTabLabel, isFocused && styles.bottomTabLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export default function TabLayout() {
  const { width } = useWindowDimensions()
  const isSideNav = Platform.OS === 'web' && width >= 768

  if (isSideNav) {
    return (
      <View style={styles.webContainer}>
        <SideNavBar />
        <View style={styles.webContent}>
          <Tabs
            tabBar={() => null}
            screenOptions={{ headerShown: false }}
          >
            <Tabs.Screen name="index" options={{ title: 'Home' }} />
            <Tabs.Screen name="search" options={{ title: 'Search' }} />
            <Tabs.Screen name="library" options={{ title: 'Library' }} />
            <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
          </Tabs>
        </View>
      </View>
    )
  }

  return (
    <Tabs
      tabBar={(props) => <BottomTabBar {...(props as unknown as TabBarProps)} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
  },
  webContent: {
    flex: 1,
  },
  sideNav: {
    width: 220,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  logoContainer: {
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  logoText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xl,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  sideNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: 10,
    marginBottom: Spacing.xs,
  },
  sideNavItemActive: {
    backgroundColor: Colors.surfaceRaised,
  },
  sideNavLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  sideNavLabelActive: {
    fontFamily: 'Inter-Medium',
    color: Colors.primary,
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
  },
  bottomTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    gap: 2,
  },
  bottomTabLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  bottomTabLabelActive: {
    color: Colors.primary,
    fontFamily: 'Inter-Medium',
  },
})
