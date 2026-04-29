import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { LibraryEntry, LibraryEntryInsert, LibraryEntryUpdate } from '@/types/database'

function libraryKey(userId: string) {
  return ['library', userId] as const
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
      const { data, error } = await supabase
        .from('library_entries')
        .insert({ ...entry, user_id: user.id })
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
        game_cover_url: entry.game_cover_url ?? null,
        game_title: entry.game_title,
        rawg_game_id: entry.rawg_game_id,
        status: entry.status,
      }
      queryClient.setQueryData<LibraryEntry[]>(key, old => [optimistic, ...(old ?? [])])
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
      queryClient.setQueryData<LibraryEntry[]>(key, old =>
        (old ?? []).filter(e => e.id !== id)
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
