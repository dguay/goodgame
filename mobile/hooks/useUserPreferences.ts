import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { LIBRARY_SORT_KEYS, isLibraryViewKey, type LibrarySortKey } from '@/types'
import type { UserPreferences, UserPreferencesUpdate } from '@/types/database'

function userPreferencesKey(userId: string) {
  return ['user_preferences', userId] as const
}

function isLibrarySortKey(value: string): value is LibrarySortKey {
  return LIBRARY_SORT_KEYS.includes(value as LibrarySortKey)
}

export function useUserPreferences() {
  const user = useAuthStore(s => s.user)

  return useQuery({
    queryKey: ['user_preferences', user?.id ?? null] as const,
    queryFn: async (): Promise<UserPreferences | null> => {
      if (user == null) return null

      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw new Error(error.message)
      return data
    },
    enabled: user != null,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateUserPreferences() {
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)

  return useMutation({
    mutationFn: async (update: Pick<UserPreferencesUpdate, 'library_sort' | 'library_view'>): Promise<UserPreferences> => {
      if (user == null) throw new Error('Not authenticated')

      if (update.library_sort != null && !isLibrarySortKey(update.library_sort)) {
        throw new Error('Invalid library sort preference')
      }
      if (update.library_view != null && !isLibraryViewKey(update.library_view)) {
        throw new Error('Invalid library view preference')
      }

      const patch: { user_id: string; library_sort?: string; library_view?: string } = { user_id: user.id }
      if (update.library_sort != null) patch.library_sort = update.library_sort
      if (update.library_view != null) patch.library_view = update.library_view

      const { data, error } = await supabase
        .from('user_preferences')
        .upsert(patch, { onConflict: 'user_id' })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return data
    },
    onMutate: async (update) => {
      if (user == null) return undefined
      const key = userPreferencesKey(user.id)
      await queryClient.cancelQueries({ queryKey: key })
      const prev = queryClient.getQueryData<UserPreferences | null>(key)
      const now = new Date().toISOString()
      queryClient.setQueryData<UserPreferences>(key, {
        user_id: user.id,
        library_sort: update.library_sort ?? prev?.library_sort ?? 'custom',
        library_view: update.library_view ?? prev?.library_view ?? 'grid',
        created_at: prev?.created_at ?? now,
        updated_at: now,
      })
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined && user != null) {
        queryClient.setQueryData(userPreferencesKey(user.id), ctx.prev)
      }
    },
    onSettled: async () => {
      if (user != null) {
        await queryClient.invalidateQueries({ queryKey: userPreferencesKey(user.id) })
      }
    },
  })
}
