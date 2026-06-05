import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { decodeHtmlEntities } from '@/lib/htmlEntities'

export interface ClusterSource {
  id: string
  name: string
  articleUrl: string
}

export interface StoryCluster {
  id: string
  title: string
  score: number
  articleCount: number
  uniqueSourceCount: number
  firstPublishedAt: string | null
  latestPublishedAt: string | null
  imageUrl: string | null
  sources: ClusterSource[]
}

async function fetchStoryClusters(limit = 25): Promise<StoryCluster[]> {
  const { data: clusters, error: clustersError } = await supabase
    .from('news_story_clusters')
    .select('id, representative_title, story_score, article_count, unique_source_count, first_published_at, latest_published_at')
    .order('story_score', { ascending: false })
    .order('latest_published_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (clustersError) throw clustersError
  if (!clusters || clusters.length === 0) return []

  const clusterIds = clusters.map((c) => c.id)

  const { data: articles, error: articlesError } = await supabase
    .from('news_articles')
    .select('id, url, image_url, cluster_id, source_id, news_sources(id, name)')
    .in('cluster_id', clusterIds)

  if (articlesError) throw articlesError

  const articlesByCluster = new Map<string, typeof articles>()
  for (const article of articles ?? []) {
    if (article.cluster_id == null) continue
    const existing = articlesByCluster.get(article.cluster_id) ?? []
    existing.push(article)
    articlesByCluster.set(article.cluster_id, existing)
  }

  return clusters.map((cluster) => {
    const clusterArticles = articlesByCluster.get(cluster.id) ?? []
    const seenSources = new Set<string>()
    const sources: ClusterSource[] = []

    let imageUrl: string | null = null

    for (const article of clusterArticles) {
      if (imageUrl == null && article.image_url != null) {
        imageUrl = article.image_url
      }
      const source = article.news_sources as { id: string; name: string } | null
      if (source != null && !seenSources.has(source.id)) {
        seenSources.add(source.id)
        sources.push({ id: source.id, name: source.name, articleUrl: article.url })
      }
    }

    return {
      id: cluster.id,
      title: decodeHtmlEntities(cluster.representative_title),
      score: cluster.story_score,
      articleCount: cluster.article_count,
      uniqueSourceCount: cluster.unique_source_count,
      firstPublishedAt: cluster.first_published_at,
      latestPublishedAt: cluster.latest_published_at,
      imageUrl,
      sources,
    }
  })
}

export function useStoryClusters(limit = 25) {
  return useQuery({
    queryKey: ['news-clusters', limit],
    queryFn: () => fetchStoryClusters(limit),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}
