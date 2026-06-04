import { createClient } from 'npm:@supabase/supabase-js@2';

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
  created_at: string;
  news_articles: { source_id: string };
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

  const { data: mentioned } = await supabase
    .from('news_article_games')
    .select('game_id')
    .gte('created_at', t7d);

  if (!mentioned?.length) return { gamesUpdated: 0 };

  const gameIds = [...new Set(mentioned.map((r: { game_id: string }) => r.game_id))];
  let gamesUpdated = 0;

  for (const gameId of gameIds) {
    const { data: matches } = await supabase
      .from('news_article_games')
      .select('created_at, news_articles!inner(source_id)')
      .eq('game_id', gameId)
      .gte('created_at', t7d);

    if (!matches?.length) continue;

    const rows = matches as ArticleMatchRow[];

    const mentions24h = rows.filter((r) => r.created_at >= t24h).length;
    const mentions72h = rows.filter((r) => r.created_at >= t72h).length;
    const mentions7d = rows.length;

    const sources72h = new Set(
      rows.filter((r) => r.created_at >= t72h).map((r) => r.news_articles.source_id)
    );
    const uniqueSources72h = sources72h.size;

    const officialMentions72h = rows.filter(
      (r) => r.created_at >= t72h && OFFICIAL_SOURCE_IDS.has(r.news_articles.source_id)
    ).length;

    const { data: prevMatches } = await supabase
      .from('news_article_games')
      .select('created_at')
      .eq('game_id', gameId)
      .gte('created_at', t14d)
      .lt('created_at', t7d);

    const mentions7dPrevAvg = (prevMatches?.length ?? 0) / 7;
    const spikeBonus = mentions24h >= 3 && mentions7dPrevAvg <= 1 ? 15 : 0;

    const trendingScore =
      mentions24h * 4 +
      mentions72h * 2 +
      uniqueSources72h * 8 +
      officialMentions72h * 10 +
      spikeBonus;

    const { error } = await supabase.from('news_game_trends').upsert({
      game_id: gameId,
      mentions_24h: mentions24h,
      mentions_72h: mentions72h,
      mentions_7d: mentions7d,
      unique_sources_72h: uniqueSources72h,
      official_mentions_72h: officialMentions72h,
      trending_score: trendingScore,
      calculated_at: now.toISOString(),
    });

    if (!error) gamesUpdated++;
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
