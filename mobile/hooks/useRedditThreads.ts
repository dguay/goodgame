import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { RedditThread } from '@/types/reddit'

export function useRedditThreads() {
  return useQuery({
    queryKey: ['reddit', 'threads'],
    queryFn: async (): Promise<RedditThread[]> => {
      const { data, error } = await supabase
        .from('reddit_threads')
        .select('*')
        .order('rank_score', { ascending: false })
        .limit(10)
      if (error) throw new Error(error.message)
      return data
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  })
}
