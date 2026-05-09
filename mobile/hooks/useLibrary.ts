import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import {
  scheduleReleaseNotifications,
  cancelReleaseNotifications,
} from '@/lib/notifications'
import type { LibraryEntry, LibraryEntryInsert, LibraryEntryUpdate } from '@/types/database'

function libraryKey(userId: string) {
  return ['library', userId] as const
}

function getNextCustomOrder(entries: LibraryEntry[], requestedOrder?: number | null): number {
  if (requestedOrder != null) return requestedOrder

  const minCustomOrder = entries.reduce<number | null>((currentMin, entry) => {
    if (entry.custom_order == null) return currentMin
    return currentMin == null ? entry.custom_order : Math.min(currentMin, entry.custom_order)
  }, null)

  return minCustomOrder == null ? 1 : minCustomOrder - 1
}

export function useLibraryEntries() {
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
    enabled: user != null,
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
      const { data, error } = await supabase
        .from('library_entries')
        .insert({ ...entry, custom_order: customOrder, user_id: user.id })
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
      const customOrder = getNextCustomOrder(prev ?? [], entry.custom_order)
      const now = new Date().toISOString()
      const optimistic: LibraryEntry = {
        id: `optimistic-${Date.now()}`,
        user_id: user.id,
        created_at: entry.created_at ?? now,
        updated_at: entry.updated_at ?? now,
        finished_at: entry.finished_at ?? null,
        started_at: entry.started_at ?? null,
        personal_notes: entry.personal_notes ?? null,
        personal_playtime_minutes: entry.personal_playtime_minutes ?? null,
        personal_rating: entry.personal_rating ?? null,
        custom_order: customOrder,
        game_cover_url: entry.game_cover_url ?? null,
        game_title: entry.game_title,
        rawg_game_id: entry.rawg_game_id,
        release_date: entry.release_date ?? null,
        status: entry.status,
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
      const { data, error } = await supabase
        .from('library_entries')
        .update(update)
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
          e.id === id ? { ...e, ...update, updated_at: new Date().toISOString() } : e
        )
      )
      return { prev }
    },
    onSuccess: async (entry, variables) => {
      if (variables.status != null) {
        if (entry.status === 'want_to_play' && entry.release_date != null) {
          await scheduleReleaseNotifications(entry.rawg_game_id, entry.game_title, entry.release_date)
        } else {
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
