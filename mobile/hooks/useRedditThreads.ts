import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { RedditThread } from '@/types/database'

const STALE = 30 * 60 * 1000
const CACHE = 60 * 60 * 1000

export function useRedditThreads() {
  return useQuery({
    queryKey: ['redditThreads'],
    queryFn: async (): Promise<RedditThread[]> => {
      const { data, error } = await supabase
        .from('reddit_threads')
        .select('*')
        .order('subreddit', { ascending: true })
        .order('rank', { ascending: true })
      if (error) throw new Error(error.message)
      return data
    },
    staleTime: STALE,
    gcTime: CACHE,
  })
}
