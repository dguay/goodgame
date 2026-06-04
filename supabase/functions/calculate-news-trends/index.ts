import { createClient } from 'npm:@supabase/supabase-js@2';
import { effectiveArticleTime, type ArticleTimeFields } from '../_shared/articleTime.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OFFICIAL_SOURCE_IDS = new Set(['playstation-blog', 'xbox-wire']);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

interface ArticleMatchRow {
  game_id: string;
  news_articles: ArticleTimeFields & { source_id: string };
}

function isInWindow(row: ArticleMatchRow, start: string, end?: string): boolean {
  const articleTime = effectiveArticleTime(row.news_articles);
  return articleTime >= start && (end == null || articleTime < end);
}

function groupByGame(rows: ArticleMatchRow[]): Map<string, ArticleMatchRow[]> {
  const rowsByGame = new Map<string, ArticleMatchRow[]>();

  for (const row of rows) {
    const existing = rowsByGame.get(row.game_id) ?? [];
    existing.push(row);
    rowsByGame.set(row.game_id, existing);
  }

  return rowsByGame;
}

async function calculateTrends(): Promise<{ gamesUpdated: number }> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  const now = new Date();
  const t24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const t72h = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
  const t7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const t14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // DB-bound by audit creation time to avoid unbounded scans, then refine by
  // article freshness: published_at -> fetched_at -> created_at.
  const { data: matches, error } = await supabase
    .from('news_article_games')
    .select('game_id, news_articles!inner(source_id, published_at, fetched_at, created_at)')
    .gte('created_at', t14d);

  if (error) throw new Error(`Failed to load article-game matches: ${error.message}`);

  const rows = ((matches ?? []) as unknown as ArticleMatchRow[])
    .filter((row) => isInWindow(row, t14d));
  const rowsByGame = groupByGame(rows);
  let gamesUpdated = 0;

  for (const [gameId, gameRows] of rowsByGame) {
    const currentRows = gameRows.filter((row) => isInWindow(row, t7d));
    if (!currentRows.length) continue;

    const mentions24h = currentRows.filter((row) => isInWindow(row, t24h)).length;
    const mentions72h = currentRows.filter((row) => isInWindow(row, t72h)).length;
    const mentions7d = currentRows.length;

    const rows72h = currentRows.filter((row) => isInWindow(row, t72h));
    const uniqueSources72h = new Set(
      rows72h.map((row) => row.news_articles.source_id)
    ).size;
    const officialMentions72h = rows72h.filter(
      (row) => OFFICIAL_SOURCE_IDS.has(row.news_articles.source_id)
    ).length;

    const previousRows = gameRows.filter((row) => isInWindow(row, t14d, t7d));
    const mentions7dPrevAvg = previousRows.length / 7;
    const spikeBonus = mentions24h >= 3 && mentions7dPrevAvg <= 1 ? 15 : 0;

    const trendingScore =
      mentions24h * 4 +
      mentions72h * 2 +
      uniqueSources72h * 8 +
      officialMentions72h * 10 +
      spikeBonus;

    const { error: upsertError } = await supabase.from('news_game_trends').upsert({
      game_id: gameId,
      mentions_24h: mentions24h,
      mentions_72h: mentions72h,
      mentions_7d: mentions7d,
      unique_sources_72h: uniqueSources72h,
      official_mentions_72h: officialMentions72h,
      trending_score: trendingScore,
      calculated_at: now.toISOString(),
    });

    if (!upsertError) gamesUpdated++;
  }

  return { gamesUpdated };
}

function verifyCronSecret(req: Request): boolean {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret) return false;
  return req.headers.get('x-cron-secret') === secret;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!verifyCronSecret(req)) return json({ error: 'Unauthorized' }, 401);

  try {
    const result = await calculateTrends();
    return json({ success: true, ...result });
  } catch (err) {
    console.error('Trends calculation error:', err);
    return json({ error: String(err) }, 500);
  }
});
