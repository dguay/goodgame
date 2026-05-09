export interface RedditThread {
  id: string
  reddit_id: string
  subreddit: string
  title: string
  url: string
  permalink: string
  score: number
  num_comments: number
  thumbnail_url: string | null
  created_utc: string
  rank_score: number
  fetched_at: string
}
