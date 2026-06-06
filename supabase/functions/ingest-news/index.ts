import { createClient } from 'npm:@supabase/supabase-js@2';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { fetchFeed } from './fetcher.ts';
import { parseRSS } from './parser.ts';
import { upsertArticles, updateSourceState } from './articles.ts';
import { clusterRecentArticles } from './clusterer.ts';
import { matchArticleToGames, saveArticleGameMatches } from './gameMatcher.ts';
import { sendFeedAlertEmail } from './emailAlerts.ts';
import { sendErrorAlert } from '../_shared/errorAlert.ts';
import type { NewsSource } from './types.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

interface IngestResult {
  processed: number;
  totalInserted: number;
  errors: string[];
}

const MATCH_WINDOW_HOURS = 72;

type ArticleRow = { id: string; title: string; excerpt: string | null };

async function matchUnmatchedArticles(
  supabase: SupabaseClient,
  sourceId: string,
  now: Date
): Promise<void> {
  const cutoff = new Date(now.getTime() - MATCH_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  // Only fetch articles that have never been through the matcher.
  // game_match_attempted_at is set after each attempt regardless of result,
  // so articles with no confident RAWG match are not re-queried on every cycle.
  const { data: toMatch } = await supabase
    .from('news_articles')
    .select('id, title, excerpt')
    .eq('source_id', sourceId)
    .gte('fetched_at', cutoff)
    .is('game_match_attempted_at', null);

  if (!toMatch?.length) return;

  for (const article of toMatch as ArticleRow[]) {
    const { matches, rawgFailed } = await matchArticleToGames(supabase, article);
    await saveArticleGameMatches(supabase, article.id, matches);
    if (!rawgFailed) {
      await supabase
        .from('news_articles')
        .update({ game_match_attempted_at: now.toISOString() })
        .eq('id', article.id);
    }
  }
}

async function ingest(): Promise<IngestResult> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  const now = new Date();

  // Atomically claim due sources by advancing next_fetch_at to a 30-min lease.
  // Postgres row-level locking ensures two concurrent workers claim disjoint rows.
  // The final updateSourceState call below overwrites next_fetch_at with the real schedule.
  const leaseUntil = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

  const { data: sources, error: sourcesErr } = await supabase
    .from('news_sources')
    .update({ next_fetch_at: leaseUntil })
    .eq('is_enabled', true)
    .lte('next_fetch_at', now.toISOString())
    .select('*');

  if (sourcesErr) throw new Error(`Failed to claim sources: ${sourcesErr.message}`);
  if (!sources?.length) return { processed: 0, totalInserted: 0, errors: [] };
  let totalInserted = 0;
  const errors: string[] = [];

  for (const source of sources as NewsSource[]) {
    // Jitter: up to 10 min so all sources don't fire simultaneously next cycle.
    const jitterMs = Math.floor(Math.random() * 10 * 60 * 1000);
    const nextFetch = new Date(
      now.getTime() + source.refresh_interval_minutes * 60 * 1000 + jitterMs
    );

    try {
      const result = await fetchFeed(source);

      if (result.status === 'not_modified') {
        await updateSourceState(supabase, source.id, {
          lastFetchedAt: now.toISOString(),
          nextFetchAt: nextFetch.toISOString(),
          etag: source.etag,
          lastModified: source.last_modified,
          consecutiveFailures: 0,
        });
        continue;
      }

      if (result.status === 'rate_limited') {
        // Back off for 6 hours on 429.
        const backoff = new Date(now.getTime() + 6 * 60 * 60 * 1000);
        const consecutiveFailures = source.consecutive_failures + 1;
        await updateSourceState(supabase, source.id, {
          lastFetchedAt: now.toISOString(),
          nextFetchAt: backoff.toISOString(),
          consecutiveFailures,
        });
        await sendFeedAlertEmail({
          source,
          reason: 'rate_limited',
          statusCode: result.statusCode,
          consecutiveFailures,
          occurredAt: now.toISOString(),
          nextFetchAt: backoff.toISOString(),
        });
        errors.push(`${source.id}: rate limited (429)`);
        console.error(`Source ${source.id} rate limited — backing off 6h`);
        continue;
      }

      if (result.status === 'server_error' || result.status === 'error') {
        const failures = source.consecutive_failures + 1;
        // 3 consecutive failures → 12h pause; otherwise 60 min.
        const backoffMs = failures >= 3 ? 12 * 60 * 60 * 1000 : 60 * 60 * 1000;
        const backoff = new Date(now.getTime() + backoffMs);
        await updateSourceState(supabase, source.id, {
          lastFetchedAt: now.toISOString(),
          nextFetchAt: backoff.toISOString(),
          consecutiveFailures: failures,
          isEnabled: failures < 3,
        });
        await sendErrorAlert(
          `ingest-news: feed error — ${source.name} (${source.id})`,
          result.error ?? `HTTP ${result.statusCode}`,
          {
            feedUrl: source.feed_url,
            statusCode: result.statusCode ?? 'none',
            consecutiveFailures: failures,
            nextFetchAt: backoff.toISOString(),
          }
        );
        if (failures === 3) {
          await sendFeedAlertEmail({
            source,
            reason: 'paused_after_failures',
            statusCode: result.statusCode,
            error: result.error,
            consecutiveFailures: failures,
            occurredAt: now.toISOString(),
            nextFetchAt: backoff.toISOString(),
          });
        }
        errors.push(`${source.id}: ${result.error ?? `HTTP ${result.statusCode}`}`);
        continue;
      }

      if (!result.xml) continue;

      const articles = await parseRSS(result.xml, source.id, source.homepage_url);
      const { inserted } = await upsertArticles(supabase, articles);
      totalInserted += inserted;

      // Match ALL recent unmatched articles for this source, not just newly inserted ones.
      // This retries articles that were stored during RAWG outages or missing API key.
      await matchUnmatchedArticles(supabase, source.id, now);

      await updateSourceState(supabase, source.id, {
        lastFetchedAt: now.toISOString(),
        nextFetchAt: nextFetch.toISOString(),
        etag: result.etag,
        lastModified: result.lastModified,
        consecutiveFailures: 0,
      });
    } catch (err) {
      errors.push(`${source.id}: ${String(err)}`);
      console.error(`Error processing source ${source.id}:`, err);
      await sendErrorAlert(`ingest-news: unexpected error — ${source.id}`, err);
    }
  }

  try {
    await clusterRecentArticles(supabase);
  } catch (err) {
    errors.push(`clustering: ${String(err)}`);
    console.error('Clustering error:', err);
    await sendErrorAlert('ingest-news: clustering error', err);
  }

  return { processed: sources.length, totalInserted, errors };
}

function verifyCronSecret(req: Request): boolean {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret) return false; // fail-closed: secret must be configured
  return req.headers.get('x-cron-secret') === secret;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!verifyCronSecret(req)) return json({ error: 'Unauthorized' }, 401);

  try {
    const result = await ingest();
    return json({ success: true, ...result });
  } catch (err) {
    console.error('Ingest fatal error:', err);
    await sendErrorAlert('ingest-news: fatal error', err);
    return json({ error: String(err) }, 500);
  }
});
