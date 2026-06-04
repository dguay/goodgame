import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const SAME_STORY_THRESHOLD = 0.72;
const CLUSTER_WINDOW_HOURS = 72;

interface ArticleRow {
  id: string;
  normalized_title: string;
  title: string;
  source_id: string;
  published_at: string | null;
}

interface ClusterRow {
  id: string;
  normalized_title: string;
  representative_title: string;
  article_count: number;
  unique_source_count: number;
  latest_published_at: string | null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const prev = Array.from({ length: n + 1 }, (_, i) => i);
  const curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev.splice(0, n + 1, ...curr);
  }

  return prev[n];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

async function countUniqueSources(
  supabase: SupabaseClient,
  clusterId: string,
  newSourceId: string
): Promise<number> {
  const { data } = await supabase
    .from('news_articles')
    .select('source_id')
    .eq('cluster_id', clusterId);

  const sources = new Set(
    (data ?? []).map((r: { source_id: string }) => r.source_id)
  );
  sources.add(newSourceId);
  return sources.size;
}

export async function clusterRecentArticles(supabase: SupabaseClient): Promise<void> {
  const cutoff = new Date(
    Date.now() - CLUSTER_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data: unclustered } = await supabase
    .from('news_articles')
    .select('id, normalized_title, title, source_id, published_at')
    .is('cluster_id', null)
    .gte('fetched_at', cutoff)
    .order('published_at', { ascending: true });

  if (!unclustered?.length) return;

  const { data: existing } = await supabase
    .from('news_story_clusters')
    .select('id, normalized_title, representative_title, article_count, unique_source_count, latest_published_at')
    .gte('updated_at', cutoff);

  const clusters: ClusterRow[] = existing ?? [];

  for (const article of unclustered as ArticleRow[]) {
    let bestCluster: ClusterRow | null = null;
    let bestSim = 0;

    for (const cluster of clusters) {
      const sim = similarity(article.normalized_title, cluster.normalized_title);
      if (sim >= SAME_STORY_THRESHOLD && sim > bestSim) {
        bestSim = sim;
        bestCluster = cluster;
      }
    }

    if (bestCluster) {
      const uniqueSources = await countUniqueSources(supabase, bestCluster.id, article.source_id);
      const newLatest =
        article.published_at && bestCluster.latest_published_at
          ? article.published_at > bestCluster.latest_published_at
            ? article.published_at
            : bestCluster.latest_published_at
          : (article.published_at ?? bestCluster.latest_published_at);

      const { error } = await supabase
        .from('news_story_clusters')
        .update({
          article_count: bestCluster.article_count + 1,
          unique_source_count: uniqueSources,
          latest_published_at: newLatest,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bestCluster.id);

      if (!error) {
        await supabase
          .from('news_articles')
          .update({ cluster_id: bestCluster.id })
          .eq('id', article.id);

        bestCluster.article_count++;
        bestCluster.unique_source_count = uniqueSources;
        bestCluster.latest_published_at = newLatest;
      }
    } else {
      const { data: created, error } = await supabase
        .from('news_story_clusters')
        .insert({
          representative_title: article.title,
          normalized_title: article.normalized_title,
          primary_article_id: article.id,
          article_count: 1,
          unique_source_count: 1,
          first_published_at: article.published_at,
          latest_published_at: article.published_at,
        })
        .select('id, normalized_title, representative_title, article_count, unique_source_count, latest_published_at')
        .single();

      if (!error && created) {
        await supabase
          .from('news_articles')
          .update({ cluster_id: (created as ClusterRow).id })
          .eq('id', article.id);

        clusters.push(created as ClusterRow);
      }
    }
  }
}
