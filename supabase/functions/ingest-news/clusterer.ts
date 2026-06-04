import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { effectiveArticleTime, type ArticleTimeFields } from '../_shared/articleTime.ts';

const SAME_STORY_THRESHOLD = 0.72;
const CLUSTER_WINDOW_HOURS = 72;
const RECENCY_SCORE_2H = 50;
const RECENCY_SCORE_6H = 40;
const RECENCY_SCORE_12H = 30;
const RECENCY_SCORE_24H = 20;
const RECENCY_SCORE_48H = 10;

interface ArticleRow extends ArticleTimeFields {
  id: string;
  normalized_title: string;
  title: string;
  source_id: string;
}

interface ClusterRow {
  id: string;
  normalized_title: string;
  representative_title: string;
  article_count: number;
  unique_source_count: number;
  latest_published_at: string | null;
}

interface ClusterScoreArticleRow extends ArticleTimeFields {
  id: string;
  cluster_id: string | null;
  source_id: string;
  news_sources: { source_weight: number } | Array<{ source_weight: number }> | null;
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

function recencyScore(timestamp: string | null): number {
  if (timestamp == null) return 0;

  const publishedAt = new Date(timestamp);
  if (Number.isNaN(publishedAt.getTime())) return 0;

  const hoursOld = (Date.now() - publishedAt.getTime()) / (60 * 60 * 1000);
  if (hoursOld <= 2) return RECENCY_SCORE_2H;
  if (hoursOld <= 6) return RECENCY_SCORE_6H;
  if (hoursOld <= 12) return RECENCY_SCORE_12H;
  if (hoursOld <= 24) return RECENCY_SCORE_24H;
  if (hoursOld <= 48) return RECENCY_SCORE_48H;
  return 0;
}

function setsOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const value of a) {
    if (b.has(value)) return true;
  }
  return false;
}

function sourceWeightForArticle(article: ClusterScoreArticleRow): number {
  const source = Array.isArray(article.news_sources)
    ? article.news_sources[0] ?? null
    : article.news_sources;

  return source?.source_weight ?? 1;
}

async function fetchArticleGameMap(
  supabase: SupabaseClient,
  articleIds: string[]
): Promise<Map<string, Set<string>>> {
  if (articleIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('news_article_games')
    .select('article_id, game_id')
    .in('article_id', articleIds);

  if (error) {
    console.error('Error loading article game matches for clustering:', error.message);
    return new Map();
  }

  const gamesByArticle = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const articleId = (row as { article_id: string }).article_id;
    const gameId = (row as { game_id: string }).game_id;
    const games = gamesByArticle.get(articleId) ?? new Set<string>();
    games.add(gameId);
    gamesByArticle.set(articleId, games);
  }

  return gamesByArticle;
}

async function fetchClusterGameMap(
  supabase: SupabaseClient,
  clusterIds: string[]
): Promise<Map<string, Set<string>>> {
  if (clusterIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('news_article_games')
    .select('game_id, news_articles!inner(cluster_id)')
    .filter('news_articles.cluster_id', 'in', `(${clusterIds.join(',')})`);

  if (error) {
    console.error('Error loading cluster games for game-aware clustering:', error.message);
    return new Map();
  }

  const gamesByCluster = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const relation = (row as {
      game_id: string;
      news_articles: { cluster_id: string | null } | Array<{ cluster_id: string | null }>;
    });
    const article = Array.isArray(relation.news_articles)
      ? relation.news_articles[0] ?? null
      : relation.news_articles;
    const clusterId = article?.cluster_id;
    if (clusterId == null) continue;

    const games = gamesByCluster.get(clusterId) ?? new Set<string>();
    games.add(relation.game_id);
    gamesByCluster.set(clusterId, games);
  }

  return gamesByCluster;
}

function canJoinCluster(
  articleGameIds: Set<string>,
  clusterGameIds: Set<string>
): boolean {
  if (articleGameIds.size === 0 || clusterGameIds.size === 0) return true;
  return setsOverlap(articleGameIds, clusterGameIds);
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

function scoreClusterFromRows(
  articles: ClusterScoreArticleRow[],
  uniqueSourceCount: number,
  latestPublishedAt: string | null,
  maxGameTrendingScore: number
): number {
  if (articles.length === 0) return 0;

  const bestSourceWeight = Math.max(...articles.map(sourceWeightForArticle));
  const sourceCounts = new Map<string, number>();
  for (const article of articles) {
    sourceCounts.set(article.source_id, (sourceCounts.get(article.source_id) ?? 0) + 1);
  }

  const sameSourceDuplicateCount = [...sourceCounts.values()]
    .reduce((total, count) => total + Math.max(0, count - 1), 0);
  const latestArticleTime = articles
    .map(effectiveArticleTime)
    .sort()
    .at(-1) ?? null;
  const latestEffectiveTime = latestPublishedAt ?? latestArticleTime;

  return (
    recencyScore(latestEffectiveTime) +
    bestSourceWeight * 10 +
    Math.min(maxGameTrendingScore / 10, 25) +
    uniqueSourceCount * 5 -
    sameSourceDuplicateCount * 5
  );
}

async function updateRecentClusterScores(
  supabase: SupabaseClient,
  cutoff: string
): Promise<void> {
  const { data: clusters, error } = await supabase
    .from('news_story_clusters')
    .select('id, unique_source_count, latest_published_at')
    .gte('updated_at', cutoff);

  if (error) {
    console.error('Error loading clusters for score update:', error.message);
    return;
  }

  const clusterRows = (clusters ?? []) as Array<{
    id: string;
    unique_source_count: number;
    latest_published_at: string | null;
  }>;
  if (clusterRows.length === 0) return;

  const clusterIds = clusterRows.map((cluster) => cluster.id);
  const { data: articles, error: articlesError } = await supabase
    .from('news_articles')
    .select('id, cluster_id, source_id, published_at, fetched_at, created_at, news_sources(source_weight)')
    .in('cluster_id', clusterIds);

  if (articlesError) {
    console.error('Error loading articles for cluster score update:', articlesError.message);
    return;
  }

  const articleRows = (articles ?? []) as unknown as ClusterScoreArticleRow[];
  const articleIds = articleRows.map((article) => article.id);
  const articlesByCluster = new Map<string, ClusterScoreArticleRow[]>();

  for (const article of articleRows) {
    if (article.cluster_id == null) continue;
    const existing = articlesByCluster.get(article.cluster_id) ?? [];
    existing.push(article);
    articlesByCluster.set(article.cluster_id, existing);
  }

  const { data: articleGames, error: articleGamesError } = articleIds.length > 0
    ? await supabase
      .from('news_article_games')
      .select('article_id, game_id')
      .in('article_id', articleIds)
    : { data: [], error: null };

  if (articleGamesError) {
    console.error('Error loading games for cluster score update:', articleGamesError.message);
  }

  const clusterByArticle = new Map(
    articleRows
      .filter((article) => article.cluster_id != null)
      .map((article) => [article.id, article.cluster_id as string])
  );
  const gamesByCluster = new Map<string, Set<string>>();

  for (const row of articleGames ?? []) {
    const articleId = (row as { article_id: string }).article_id;
    const gameId = (row as { game_id: string }).game_id;
    const clusterId = clusterByArticle.get(articleId);
    if (clusterId == null) continue;

    const existing = gamesByCluster.get(clusterId) ?? new Set<string>();
    existing.add(gameId);
    gamesByCluster.set(clusterId, existing);
  }

  const allGameIds = [
    ...new Set([...gamesByCluster.values()].flatMap((gameIds) => [...gameIds])),
  ];
  const { data: trends, error: trendsError } = allGameIds.length > 0
    ? await supabase
      .from('news_game_trends')
      .select('game_id, trending_score')
      .in('game_id', allGameIds)
    : { data: [], error: null };

  if (trendsError) {
    console.error('Error loading trends for cluster score update:', trendsError.message);
  }

  const trendByGame = new Map(
    (trends ?? []).map((row: { game_id: string; trending_score: number }) => [
      row.game_id,
      row.trending_score,
    ])
  );

  const now = new Date().toISOString();

  for (const cluster of clusterRows) {
    const clusterGameIds = gamesByCluster.get(cluster.id) ?? new Set<string>();
    const maxGameTrendingScore = Math.max(
      0,
      ...[...clusterGameIds].map((gameId) => trendByGame.get(gameId) ?? 0)
    );
    const storyScore = scoreClusterFromRows(
      articlesByCluster.get(cluster.id) ?? [],
      cluster.unique_source_count,
      cluster.latest_published_at,
      maxGameTrendingScore
    );

    const { error: updateError } = await supabase
      .from('news_story_clusters')
      .update({
        story_score: storyScore,
        updated_at: now,
      })
      .eq('id', cluster.id);

    if (updateError) {
      console.error(`Error updating cluster score ${cluster.id}:`, updateError.message);
    }
  }
}

export async function clusterRecentArticles(supabase: SupabaseClient): Promise<void> {
  const cutoff = new Date(
    Date.now() - CLUSTER_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data: unclustered } = await supabase
    .from('news_articles')
    .select('id, normalized_title, title, source_id, published_at, fetched_at, created_at')
    .is('cluster_id', null)
    .gte('fetched_at', cutoff)
    .order('published_at', { ascending: true });

  const { data: existing } = await supabase
    .from('news_story_clusters')
    .select('id, normalized_title, representative_title, article_count, unique_source_count, latest_published_at')
    .gte('updated_at', cutoff);

  const clusters: ClusterRow[] = existing ?? [];

  if (!unclustered?.length) {
    await updateRecentClusterScores(supabase, cutoff);
    return;
  }

  const unclusteredArticles = unclustered as ArticleRow[];
  const articleGameMap = await fetchArticleGameMap(
    supabase,
    unclusteredArticles.map((article) => article.id)
  );
  const clusterGameMap = await fetchClusterGameMap(
    supabase,
    clusters.map((cluster) => cluster.id)
  );

  for (const article of unclusteredArticles) {
    let bestCluster: ClusterRow | null = null;
    let bestSim = 0;
    const articleGameIds = articleGameMap.get(article.id) ?? new Set<string>();

    for (const cluster of clusters) {
      const clusterGameIds = clusterGameMap.get(cluster.id) ?? new Set<string>();
      if (!canJoinCluster(articleGameIds, clusterGameIds)) continue;

      const sim = similarity(article.normalized_title, cluster.normalized_title);
      if (sim >= SAME_STORY_THRESHOLD && sim > bestSim) {
        bestSim = sim;
        bestCluster = cluster;
      }
    }

    if (bestCluster) {
      const uniqueSources = await countUniqueSources(supabase, bestCluster.id, article.source_id);
      const articleTime = effectiveArticleTime(article);
      const newLatest =
        bestCluster.latest_published_at == null || articleTime > bestCluster.latest_published_at
          ? articleTime
          : bestCluster.latest_published_at;

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

        const clusterGames = clusterGameMap.get(bestCluster.id) ?? new Set<string>();
        for (const gameId of articleGameIds) clusterGames.add(gameId);
        clusterGameMap.set(bestCluster.id, clusterGames);

        bestCluster.article_count++;
        bestCluster.unique_source_count = uniqueSources;
        bestCluster.latest_published_at = newLatest;
      }
    } else {
      const articleTime = effectiveArticleTime(article);
      const { data: created, error } = await supabase
        .from('news_story_clusters')
        .insert({
          representative_title: article.title,
          normalized_title: article.normalized_title,
          primary_article_id: article.id,
          article_count: 1,
          unique_source_count: 1,
          first_published_at: articleTime,
          latest_published_at: articleTime,
        })
        .select('id, normalized_title, representative_title, article_count, unique_source_count, latest_published_at')
        .single();

      if (!error && created) {
        await supabase
          .from('news_articles')
          .update({ cluster_id: (created as ClusterRow).id })
          .eq('id', article.id);

        clusters.push(created as ClusterRow);
        clusterGameMap.set((created as ClusterRow).id, articleGameIds);
      }
    }
  }

  await updateRecentClusterScores(supabase, cutoff);
}
