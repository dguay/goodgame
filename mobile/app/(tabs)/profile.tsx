import { useState, useRef, useCallback } from 'react'
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import Svg, { Rect } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { useQueryClient } from '@tanstack/react-query'
import { Text } from '@/components/ui/Text'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { signOut } from '@/lib/auth'
import { Colors, Spacing, FontSize } from '@/constants'
import { STATUS_LABELS, STATUS_COLORS, type LibraryStatus } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import { useProfile, useUpdateDisplayName } from '@/hooks/useProfile'
import { useProfileStats } from '@/hooks/useProfileStats'

const STATUS_ORDER: LibraryStatus[] = ['want_to_play', 'playing', 'done', 'did_not_finish']

const STAT_SHORT: Record<LibraryStatus, string> = {
  want_to_play: 'TBP',
  playing: 'Playing',
  done: 'Done',
  did_not_finish: 'DNF',
}

function formatPlaytime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}m`
}

export default function ProfileScreen() {
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useProfile()
  const { data: stats, isLoading: statsLoading } = useProfileStats()
  const updateDisplayName = useUpdateDisplayName()

  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [barWidth, setBarWidth] = useState(0)
  const nameInputRef = useRef<TextInput>(null)

  const displayName = profile?.display_name ?? (user?.user_metadata?.['full_name'] as string | undefined) ?? 'Gamer'
  const subLabel = profile?.username != null ? `@${profile.username}` : (user?.email ?? '')
  const avatarUrl: string | null = profile?.avatar_url ?? (typeof user?.user_metadata?.['avatar_url'] === 'string' ? user.user_metadata['avatar_url'] : null)

  const handleStartEdit = useCallback(() => {
    if (isEditing) {
      nameInputRef.current?.focus()
      return
    }
    setEditedName(profile?.display_name ?? '')
    setIsEditing(true)
    setTimeout(() => nameInputRef.current?.focus(), 50)
  }, [isEditing, profile?.display_name])

  const handleSaveName = useCallback(async () => {
    const name = editedName.trim()
    setIsEditing(false)
    if (name.length === 0 || name === profile?.display_name) return
    try {
      await updateDisplayName.mutateAsync(name)
    } catch {
      Alert.alert('Error', 'Could not update display name. Please try again.')
    }
  }, [editedName, profile?.display_name, updateDisplayName])

  const handleSignOut = useCallback(() => {
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
  }, [])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        refetchProfile(),
        queryClient.invalidateQueries({ queryKey: ['library'] }),
      ])
    } finally {
      setIsRefreshing(false)
    }
  }, [refetchProfile, queryClient])

  if (profileLoading && profile == null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LoadingSpinner size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          {avatarUrl != null ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatar}
              contentFit="cover"
              transition={200}
              cachePolicy="disk"
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={36} color={Colors.textMuted} />
            </View>
          )}

          {isEditing ? (
            <TextInput
              ref={nameInputRef}
              style={styles.nameInput}
              value={editedName}
              onChangeText={setEditedName}
              onBlur={() => { void handleSaveName() }}
              onSubmitEditing={() => { void handleSaveName() }}
              returnKeyType="done"
              autoCorrect={false}
              maxLength={50}
              placeholderTextColor={Colors.textMuted}
              placeholder="Your name"
            />
          ) : (
            <Pressable onPress={handleStartEdit} style={styles.namePressable}>
              <Text variant="heading" style={styles.displayName}>{displayName}</Text>
              <Ionicons name="pencil-outline" size={16} color={Colors.textMuted} style={styles.editIcon} />
            </Pressable>
          )}

          {subLabel.length > 0 && (
            <Text variant="caption" style={styles.subLabel}>{subLabel}</Text>
          )}
        </View>

        {/* Stats Card */}
        <Card style={styles.card}>
          <Text variant="subheading" style={styles.cardTitle}>Stats</Text>

          <View style={styles.statusGrid}>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: Colors.textPrimary }]}>
                {stats.totalGames}
              </Text>
              <Text variant="caption" style={styles.statLabel}>Total</Text>
            </View>
            {STATUS_ORDER.map(status => (
              <View key={status} style={styles.statBox}>
                <Text style={[styles.statNumber, { color: STATUS_COLORS[status] }]}>
                  {stats.byStatus[status]}
                </Text>
                <Text variant="caption" style={styles.statLabel}>
                  {STAT_SHORT[status]}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
            <Text variant="body" style={styles.metaLabel}>Total Playtime</Text>
            <Text variant="body" style={styles.metaValue}>
              {formatPlaytime(stats.totalPlaytimeMinutes)}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="star-outline" size={16} color={Colors.textSecondary} />
            <Text variant="body" style={styles.metaLabel}>Avg. Rating</Text>
            <Text variant="body" style={styles.metaValue}>
              {stats.averageRating != null ? `${stats.averageRating} / 10` : 'No ratings yet'}
            </Text>
          </View>
        </Card>

        {/* Library Breakdown Chart */}
        <Card style={styles.card}>
          <Text variant="subheading" style={styles.cardTitle}>Library Breakdown</Text>

          <View
            onLayout={e => setBarWidth(e.nativeEvent.layout.width)}
            style={styles.chartContainer}
          >
            {barWidth > 0 && stats.totalGames > 0 ? (
              <View style={styles.barWrapper}>
                <Svg width={barWidth} height={24}>
                  {(() => {
                    const total = stats.totalGames
                    let x = 0
                    return STATUS_ORDER.map(status => {
                      const segWidth = (stats.byStatus[status] / total) * barWidth
                      const rect = (
                        <Rect
                          key={status}
                          x={x}
                          y={0}
                          width={segWidth}
                          height={24}
                          fill={STATUS_COLORS[status]}
                        />
                      )
                      x += segWidth
                      return rect
                    })
                  })()}
                </Svg>
              </View>
            ) : (
              <View style={styles.emptyBar} />
            )}
          </View>

          <View style={styles.legend}>
            {STATUS_ORDER.map(status => (
              <View key={status} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS[status] }]} />
                <Text variant="caption" style={styles.legendLabel}>
                  {STATUS_LABELS[status]}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Top Genres */}
        {(stats.topGenres.length > 0 || statsLoading) && (
          <View style={styles.section}>
            <Text variant="subheading" style={styles.sectionTitle}>Top Genres</Text>
            {statsLoading && stats.topGenres.length === 0 ? (
              <LoadingSpinner size="small" />
            ) : (
              <View style={styles.genreChips}>
                {stats.topGenres.map(genre => (
                  <View key={genre} style={styles.genreChip}>
                    <Text variant="caption" style={styles.genreChipText}>{genre}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Settings */}
        <View style={styles.settingsSection}>
          <Text variant="label" style={styles.settingsSectionTitle}>ACCOUNT</Text>
          <View style={styles.settingsCard}>
            <Pressable
              style={({ pressed }) => [styles.settingsRow, pressed && styles.rowPressed]}
              onPress={handleStartEdit}
            >
              <Ionicons name="create-outline" size={20} color={Colors.textSecondary} />
              <Text variant="body" style={styles.settingsLabel}>Edit Display Name</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </Pressable>

            <View style={styles.rowDivider} />

            <Pressable
              style={({ pressed }) => [styles.settingsRow, pressed && styles.rowPressed]}
              onPress={handleSignOut}
              disabled={isSigningOut}
            >
              <Ionicons name="log-out-outline" size={20} color={Colors.error} />
              <Text variant="body" style={[styles.settingsLabel, styles.signOutLabel]}>
                {isSigningOut ? 'Signing out...' : 'Sign Out'}
              </Text>
            </Pressable>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  // Header
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  namePressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  displayName: {
    color: Colors.textPrimary,
  },
  editIcon: {
    marginTop: 2,
  },
  nameInput: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    minWidth: 160,
    textAlign: 'center',
    paddingVertical: Spacing.xs,
  },
  subLabel: {
    color: Colors.textMuted,
  },
  // Cards
  card: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
  },
  cardTitle: {
    marginBottom: Spacing.md,
  },
  // Stats grid
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xl,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  metaLabel: {
    flex: 1,
    color: Colors.textSecondary,
  },
  metaValue: {
    color: Colors.textPrimary,
  },
  // Chart
  chartContainer: {
    marginBottom: Spacing.md,
  },
  barWrapper: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  emptyBar: {
    height: 24,
    borderRadius: 6,
    backgroundColor: Colors.surfaceRaised,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: Colors.textSecondary,
  },
  // Top Genres
  section: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  genreChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  genreChip: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  genreChipText: {
    color: Colors.textSecondary,
  },
  // Settings
  settingsSection: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.lg,
  },
  settingsSectionTitle: {
    marginBottom: Spacing.sm,
    letterSpacing: 1,
  },
  settingsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  rowPressed: {
    opacity: 0.6,
    backgroundColor: Colors.surfaceRaised,
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },
  settingsLabel: {
    flex: 1,
  },
  signOutLabel: {
    color: Colors.error,
  },
})
