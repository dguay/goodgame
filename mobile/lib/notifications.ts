import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

const earlyId = (rawgGameId: number) => `tbp-early-${rawgGameId}`
const dayId = (rawgGameId: number) => `tbp-day-${rawgGameId}`

// Returns the trigger date to use, or null if the window has fully passed.
function resolveTrigger(target: Date, now: Date): Date | null {
  if (target > now) return target
  return null
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

export async function scheduleReleaseNotifications(
  rawgGameId: number,
  gameTitle: string,
  releaseDate: string,
): Promise<void> {
  if (Platform.OS === 'web') return

  const granted = await requestNotificationPermission()
  if (!granted) return

  const now = new Date()
  const releaseDay = new Date(`${releaseDate}T00:00:00`)

  await cancelReleaseNotifications(rawgGameId)

  const earlyTarget = new Date(releaseDay)
  earlyTarget.setDate(earlyTarget.getDate() - 3)
  earlyTarget.setHours(9, 0, 0, 0)

  const dayTarget = new Date(releaseDay)
  dayTarget.setHours(9, 0, 0, 0)

  const earlyTrigger = resolveTrigger(earlyTarget, now)
  if (earlyTrigger != null) {
    await Notifications.scheduleNotificationAsync({
      identifier: earlyId(rawgGameId),
      content: {
        title: 'Coming soon',
        body: `${gameTitle} releases in 3 days!`,
        data: { rawgGameId, type: 'release-early' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: earlyTrigger,
      },
    })
  }

  const dayTriggerDate = resolveTrigger(dayTarget, now)
  if (dayTriggerDate != null) {
    await Notifications.scheduleNotificationAsync({
      identifier: dayId(rawgGameId),
      content: {
        title: 'Out today!',
        body: `${gameTitle} is out now - time to play!`,
        data: { rawgGameId, type: 'release-day' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: dayTriggerDate,
      },
    })
  }
}

export async function cancelReleaseNotifications(rawgGameId: number): Promise<void> {
  if (Platform.OS === 'web') return
  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(earlyId(rawgGameId)).catch(() => undefined),
    Notifications.cancelScheduledNotificationAsync(dayId(rawgGameId)).catch(() => undefined),
  ])
}

export async function syncAllReleaseNotifications(
  entries: Array<{ rawg_game_id: number; game_title: string; release_date: string | null; status: string }>,
): Promise<void> {
  if (Platform.OS === 'web') return

  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  const staleIds = scheduled
    .map(n => n.identifier)
    .filter(id => id.startsWith('tbp-'))
  await Promise.all(
    staleIds.map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined))
  )

  const tbpEntries = entries.filter(
    e => e.status === 'want_to_play' && e.release_date != null
  )
  await Promise.all(
    tbpEntries.map(e =>
      scheduleReleaseNotifications(e.rawg_game_id, e.game_title, e.release_date!)
    )
  )
}
