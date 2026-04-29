import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Profile } from '@/types/database'

export function useProfile() {
  const user = useAuthStore(s => s.user)
  return useQuery({
    queryKey: ['profile', user?.id ?? null] as const,
    queryFn: async (): Promise<Profile | null> => {
      if (user == null) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (error) throw new Error(error.message)
      return data
    },
    enabled: user != null,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateDisplayName() {
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)

  return useMutation({
    mutationFn: async (displayName: string): Promise<Profile> => {
      if (user == null) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', user.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: async () => {
      if (user != null) {
        await queryClient.invalidateQueries({ queryKey: ['profile', user.id] })
      }
    },
  })
}
