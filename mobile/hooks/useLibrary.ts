import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import {
  scheduleReleaseNotifications,
  cancelReleaseNotifications,
} from '@/lib/notifications'
import { formatLocalDate } from '@/lib/dates'
import type { LibraryEntry, LibraryEntryInsert, LibraryEntryUpdate } from '@/types/database'

function libraryKey(userId: string) {
  return ['library', userId] as const
}

const rawgMetadataSyncAttempts = new Set<string>()
const rawgMetadataSyncInFlight = new Set<string>()

function normalizePlatformKey(platforms: string[] | null): string {
  return [...(platforms ?? [])].sort().join(',')
}

function getNextCustomOrder(entries: LibraryEntry[], requestedOrder?: number | null): number {
  if (requestedOrder != null) return requestedOrder

  const minCustomOrder = entries.reduce<number | null>((currentMin, entry) => {
    if (entry.custom_order == null) return currentMin
    return currentMin == null ? entry.custom_order : Math.min(currentMin, entry.custom_order)
  }, null)

  return minCustomOrder == null ? 1 : minCustomOrder - 1
}

function withDefaultStartedAtForPlaying<T extends { status?: string; started_at?: string | null }>(
  update: T,
  currentEntry?: Pick<LibraryEntry, 'started_at'> | null,
): T {
  if (update.status !== 'playing') return update
  if ('started_at' in update) return update
  if (currentEntry != null && currentEntry.started_at != null) return update

  return {
    ...update,
    started_at: formatLocalDate(new Date()),
  }
}

async function getStoredStartedAt(id: string): Promise<Pick<LibraryEntry, 'started_at'> | null> {
  const { data, error } = await supabase
    .from('library_entries')
    .select('started_at')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

export function useLibraryEntries(enabled = true) {
  const user = useAuthStore(s => s.user)

  return useQuery({
    queryKey: ['library', user?.id ?? null] as const,
    queryFn: async (): Promise<LibraryEntry[]> => {
      if (user == null) return []
      const { data, error } = await supabase
        .from('library_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
    enabled: enabled && user != null,
    staleTime: 5 * 60 * 1000,
  })
}

export function useLibraryEntry(rawgGameId: number | null): LibraryEntry | null {
  const { data: entries } = useLibraryEntries()
  if (rawgGameId == null || entries == null) return null
  return entries.find(e => e.rawg_game_id === rawgGameId) ?? null
}

export function useAddToLibrary() {
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)

  return useMutation({
    mutationFn: async (entry: Omit<LibraryEntryInsert, 'user_id'>): Promise<LibraryEntry> => {
      if (user == null) throw new Error('Not authenticated')
      const existingEntries = queryClient.getQueryData<LibraryEntry[]>(libraryKey(user.id)) ?? []
      const customOrder = getNextCustomOrder(existingEntries, entry.custom_order)
      const insert = withDefaultStartedAtForPlaying(entry)
      const { data, error } = await supabase
        .from('library_entries')
        .insert({ ...insert, custom_order: customOrder, user_id: user.id })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data
    },
    onMutate: async (entry) => {
      if (user == null) return undefined
      const key = libraryKey(user.id)
      await queryClient.cancelQueries({ queryKey: key })
      const prev = queryClient.getQueryData<LibraryEntry[]>(key)
      const insert = withDefaultStartedAtForPlaying(entry)
      const customOrder = getNextCustomOrder(prev ?? [], entry.custom_order)
      const now = new Date().toISOString()
      const optimistic: LibraryEntry = {
        id: `optimistic-${Date.now()}`,
        user_id: user.id,
        created_at: insert.created_at ?? now,
        updated_at: insert.updated_at ?? now,
        finished_at: insert.finished_at ?? null,
        started_at: insert.started_at ?? null,
        personal_notes: insert.personal_notes ?? null,
        personal_playtime_minutes: insert.personal_playtime_minutes ?? null,
        personal_rating: insert.personal_rating ?? null,
        custom_order: customOrder,
        game_cover_url: insert.game_cover_url ?? null,
        game_title: insert.game_title,
        platforms: insert.platforms ?? null,
        rawg_game_id: insert.rawg_game_id,
        rawg_metadata_synced_at: insert.rawg_metadata_synced_at ?? null,
        release_date: insert.release_date ?? null,
        status: insert.status,
      }
      queryClient.setQueryData<LibraryEntry[]>(key, old => [optimistic, ...(old ?? [])])
      return { prev }
    },
    onSuccess: async (entry) => {
      if (entry.status === 'want_to_play' && entry.release_date != null) {
        await scheduleReleaseNotifications(entry.rawg_game_id, entry.game_title, entry.release_date)
      }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev != null && user != null) {
        queryClient.setQueryData(libraryKey(user.id), ctx.prev)
      }
    },
    onSettled: async () => {
      if (user != null) {
        await queryClient.invalidateQueries({ queryKey: libraryKey(user.id) })
      }
    },
  })
}

export function useUpdateLibraryCustomOrder() {
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)

  return useMutation({
    mutationFn: async (orderedIds: string[]): Promise<void> => {
      if (user == null) throw new Error('Not authenticated')

      const updates = orderedIds.map(async (id, index) => {
        const { error } = await supabase
          .from('library_entries')
          .update({ custom_order: index + 1 })
          .eq('id', id)
          .eq('user_id', user.id)

        if (error) throw new Error(error.message)
      })

      await Promise.all(updates)
    },
    onMutate: async (orderedIds) => {
      if (user == null) return undefined
      const key = libraryKey(user.id)
      await queryClient.cancelQueries({ queryKey: key })
      const prev = queryClient.getQueryData<LibraryEntry[]>(key)
      const orderById = new Map(orderedIds.map((id, index) => [id, index + 1]))
      queryClient.setQueryData<LibraryEntry[]>(key, old =>
        (old ?? []).map(entry => {
          const customOrder = orderById.get(entry.id)
          return customOrder == null ? entry : { ...entry, custom_order: customOrder }
        })
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev != null && user != null) {
        queryClient.setQueryData(libraryKey(user.id), ctx.prev)
      }
    },
    onSettled: async () => {
      if (user != null) {
        await queryClient.invalidateQueries({ queryKey: libraryKey(user.id) })
      }
    },
  })
}

export function useUpdateLibraryEntry() {
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)

  return useMutation({
    mutationFn: async ({ id, ...update }: LibraryEntryUpdate & { id: string }): Promise<LibraryEntry> => {
      const currentEntry = user == null
        ? null
        : queryClient.getQueryData<LibraryEntry[]>(libraryKey(user.id))?.find(entry => entry.id === id)
      const entryForStartedAt = currentEntry == null && update.status === 'playing' && !('started_at' in update)
        ? await getStoredStartedAt(id)
        : currentEntry
      const nextUpdate = withDefaultStartedAtForPlaying(update, entryForStartedAt)
      const { data, error } = await supabase
        .from('library_entries')
        .update(nextUpdate)
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data
    },
    onMutate: async ({ id, ...update }) => {
      if (user == null) return undefined
      const key = libraryKey(user.id)
      await queryClient.cancelQueries({ queryKey: key })
      const prev = queryClient.getQueryData<LibraryEntry[]>(key)
      queryClient.setQueryData<LibraryEntry[]>(key, old =>
        (old ?? []).map(e =>
          e.id === id
            ? {
                ...e,
                ...withDefaultStartedAtForPlaying(update, e),
                updated_at: new Date().toISOString(),
              }
            : e
        )
      )
      return { prev }
    },
    onSuccess: async (entry, variables) => {
      const didUpdateReleaseDate = 'release_date' in variables
      if (variables.status != null || didUpdateReleaseDate) {
        if (entry.status === 'want_to_play' && entry.release_date != null) {
          await scheduleReleaseNotifications(entry.rawg_game_id, entry.game_title, entry.release_date)
        } else if (variables.status != null) {
          await cancelReleaseNotifications(entry.rawg_game_id)
        }
      }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev != null && user != null) {
        queryClient.setQueryData(libraryKey(user.id), ctx.prev)
      }
    },
    onSettled: async () => {
      if (user != null) {
        await queryClient.invalidateQueries({ queryKey: libraryKey(user.id) })
      }
    },
  })
}

export async function syncLibraryRawgMetadata(
  queryClient: QueryClient,
  userId: string,
  rawgGameId: number,
  releaseDate: string | null,
  platforms: string[] | null,
): Promise<void> {
  if (releaseDate == null && platforms == null) return

  const key = libraryKey(userId)
  const entries = queryClient.getQueryData<LibraryEntry[]>(key)
  const entry = entries?.find(
    currentEntry =>
      currentEntry.rawg_game_id === rawgGameId &&
      (currentEntry.release_date !== releaseDate ||
        normalizePlatformKey(currentEntry.platforms) !== normalizePlatformKey(platforms))
  )
  if (entry == null) return

  const syncKey = `${userId}:${entry.id}:${releaseDate}:${normalizePlatformKey(platforms)}`
  if (rawgMetadataSyncAttempts.has(syncKey) || rawgMetadataSyncInFlight.has(syncKey)) return

  rawgMetadataSyncAttempts.add(syncKey)
  rawgMetadataSyncInFlight.add(syncKey)

  const previousEntries = entries ?? []
  const rawgMetadataSyncedAt = new Date().toISOString()
  queryClient.setQueryData<LibraryEntry[]>(key, old =>
    (old ?? []).map(currentEntry =>
      currentEntry.id === entry.id
        ? {
            ...currentEntry,
            platforms,
            rawg_metadata_synced_at: rawgMetadataSyncedAt,
            release_date: releaseDate,
            updated_at: rawgMetadataSyncedAt,
          }
        : currentEntry
    )
  )

  try {
    const { data, error } = await supabase
      .from('library_entries')
      .update({
        platforms,
        rawg_metadata_synced_at: rawgMetadataSyncedAt,
        release_date: releaseDate,
      })
      .eq('id', entry.id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw new Error(error.message)

    queryClient.setQueryData<LibraryEntry[]>(key, old =>
      (old ?? []).map(currentEntry => (currentEntry.id === data.id ? data : currentEntry))
    )

    if (data.status === 'want_to_play' && data.release_date != null) {
      await scheduleReleaseNotifications(data.rawg_game_id, data.game_title, data.release_date)
    }
  } catch (error) {
    console.warn('Could not sync RAWG metadata to library', error)
    queryClient.setQueryData<LibraryEntry[]>(key, previousEntries)
  } finally {
    rawgMetadataSyncInFlight.delete(syncKey)
  }
}

export function useRemoveFromLibrary() {
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('library_entries')
        .delete()
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onMutate: async (id) => {
      if (user == null) return undefined
      const key = libraryKey(user.id)
      await queryClient.cancelQueries({ queryKey: key })
      const prev = queryClient.getQueryData<LibraryEntry[]>(key)
      const rawgGameId = prev?.find(e => e.id === id)?.rawg_game_id ?? null
      queryClient.setQueryData<LibraryEntry[]>(key, old =>
        (old ?? []).filter(e => e.id !== id)
      )
      return { prev, rawgGameId }
    },
    onSuccess: async (_data, _vars, context) => {
      if (context?.rawgGameId != null) {
        await cancelReleaseNotifications(context.rawgGameId)
      }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev != null && user != null) {
        queryClient.setQueryData(libraryKey(user.id), ctx.prev)
      }
    },
    onSettled: async () => {
      if (user != null) {
        await queryClient.invalidateQueries({ queryKey: libraryKey(user.id) })
      }
    },
  })
}
