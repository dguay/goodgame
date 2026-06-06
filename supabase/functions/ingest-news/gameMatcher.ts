import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const RAWG_BASE = 'https://api.rawg.io/api';
const RAWG_AUTO_MATCH_THRESHOLD = 0.85;
const RAWG_REVIEW_THRESHOLD = 0.65;

// Keywords that typically follow a game name in a news headline.
const NEWS_KEYWORDS = [
  'review', 'preview', 'trailer', 'gameplay', 'release date',
  'announced', 'reveal', 'reveals', 'update', 'patch', 'dlc', 'demo',
  'expansion', 'sequel', 'remaster', 'remake', 'gets', 'launches',
  'coming', 'arrives', 'available', 'delayed', 'postponed', 'cancelled',
  'release',
];

export function normalizeGameName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = Array.from({ length: n + 1 }, (_, i) => i);
  const curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev.splice(0, n + 1, ...curr);
  }
  return prev[n];
}

export function stringSimilarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

export function extractBeforeKeyword(title: string): string[] {
  const lower = title.toLowerCase();
  for (const kw of NEWS_KEYWORDS) {
    const idx = lower.indexOf(` ${kw}`);
    if (idx > 2) {
      const candidate = title.slice(0, idx).trim().replace(/[,:–—\-]+$/, '').trim();
      if (candidate.length >= 3) return [candidate];
    }
  }
  return [];
}

export function extractCapitalizedPhrases(title: string): string[] {
  // Also captures "NNN TitleCase..." patterns like "007 First Light"
  const matches = title.match(/(?:\d+\s+)?[A-Z][a-zA-Z0-9]*(?:\s+[A-Z][a-zA-Z0-9]*){1,4}/g) ?? [];
  return matches.filter((m) => m.length >= 4 && m.split(' ').length >= 2);
}

export function extractCandidates(title: string, excerpt?: string | null): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];

  const add = (c: string) => {
    const t = c.trim();
    if (t.length >= 3 && t.length <= 80 && !seen.has(t)) {
      seen.add(t);
      candidates.push(t);
    }
  };

  extractBeforeKeyword(title).forEach(add);
  extractCapitalizedPhrases(title).forEach(add);
  if (excerpt) extractCapitalizedPhrases(excerpt).forEach(add);

  return candidates;
}

// ─── RAWG ─────────────────────────────────────────────────────────────────────

interface RawgSearchResult {
  id: number;
  name: string;
  slug: string;
  released: string | null;
  background_image: string | null;
  platforms: Array<{ platform: { name: string } }> | null;
  genres: Array<{ name: string }> | null;
}

interface RawgSearchResponse {
  results?: RawgSearchResult[];
}

// Returns null when RAWG is unavailable (missing key, HTTP error, network failure).
// Returns [] when RAWG responded but found no matching games.
// Callers must treat null as a transient failure and avoid marking the article as attempted.
async function searchRawg(query: string): Promise<RawgSearchResult[] | null> {
  const key = Deno.env.get('RAWG_API_KEY');
  if (!key) {
    console.warn('RAWG_API_KEY not set — skipping RAWG search for:', query);
    return null;
  }

  const url = new URL(`${RAWG_BASE}/games`);
  url.searchParams.set('key', key);
  url.searchParams.set('search', query);
  url.searchParams.set('page_size', '5');
  url.searchParams.set('search_precise', 'true');

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Goodgame/1.0 (+https://goodgame.app/contact)' },
    });
    if (!res.ok) {
      console.error(`RAWG search failed (${res.status}) for: ${query}`);
      return null;
    }
    const data = (await res.json()) as RawgSearchResponse;
    return data.results ?? [];
  } catch (err) {
    console.error('RAWG search error:', err);
    return null;
  }
}

function scoreRawgResults(
  candidate: string,
  results: RawgSearchResult[],
  articleTitle: string
): { result: RawgSearchResult; confidence: number } | null {
  if (!results.length) return null;

  const normalizedCandidate = normalizeGameName(candidate);

  const scored = results.map((r) => {
    const nameSim = stringSimilarity(normalizedCandidate, normalizeGameName(r.name));
    const slugSim = stringSimilarity(normalizedCandidate, normalizeGameName(r.slug.replace(/-/g, ' ')));
    const titleContains = articleTitle.toLowerCase().includes(r.name.toLowerCase());
    const platformBoost = r.platforms?.length ? 0.05 : 0;
    const imageBoost = r.background_image ? 0.03 : 0;
    const confidence = Math.max(nameSim, slugSim) + (titleContains ? 0.1 : 0) + platformBoost + imageBoost;
    return { result: r, confidence: Math.min(confidence, 1) };
  });

  scored.sort((a, b) => b.confidence - a.confidence);
  return scored[0];
}

async function upsertGameFromRawg(
  supabase: SupabaseClient,
  rawgGame: RawgSearchResult
): Promise<string | null> {
  const { data, error } = await supabase
    .from('news_games')
    .upsert(
      {
        rawg_id: String(rawgGame.id),
        name: rawgGame.name,
        slug: rawgGame.slug,
        released: rawgGame.released,
        image_url: rawgGame.background_image,
        platforms: rawgGame.platforms?.map((p) => p.platform.name) ?? [],
        genres: rawgGame.genres?.map((g) => g.name) ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'rawg_id' }
    )
    .select('id')
    .single();

  if (error) {
    console.error('Error upserting game from RAWG:', error.message);
    return null;
  }

  return (data as { id: string }).id;
}

async function saveAlias(
  supabase: SupabaseClient,
  gameId: string,
  alias: string
): Promise<void> {
  const { error } = await supabase
    .from('news_game_aliases')
    .upsert(
      { game_id: gameId, alias, normalized_alias: normalizeGameName(alias), source: 'rawg_match' },
      { onConflict: 'game_id,normalized_alias', ignoreDuplicates: true }
    );
  if (error) console.error('Error saving alias:', error.message);
}

async function queueGameMatchCandidate(
  supabase: SupabaseClient,
  articleId: string,
  candidate: string,
  rawgResults: RawgSearchResult[],
  best: { result: RawgSearchResult; confidence: number },
  reason: string
): Promise<void> {
  const { error } = await supabase
    .from('news_game_match_candidates')
    .upsert(
      {
        article_id: articleId,
        candidate,
        normalized_candidate: normalizeGameName(candidate),
        best_rawg_id: String(best.result.id),
        best_rawg_name: best.result.name,
        best_rawg_slug: best.result.slug,
        confidence: best.confidence,
        rawg_results: rawgResults,
        reason,
        status: 'pending',
      },
      { onConflict: 'article_id,normalized_candidate' }
    );

  if (error) console.error('Error queueing game match candidate:', error.message);
}

// ─── Main matcher ──────────────────────────────────────────────────────────────

interface GameMatch {
  game_id: string;
  confidence: number;
  match_method: string;
}

export interface MatchArticleResult {
  matches: GameMatch[];
  // true when a RAWG call was attempted but failed (outage, missing key, HTTP error).
  // Callers should not mark game_match_attempted_at so the article can be retried.
  rawgFailed: boolean;
}

export async function matchArticleToGames(
  supabase: SupabaseClient,
  article: { id: string; title: string; excerpt: string | null }
): Promise<MatchArticleResult> {
  const candidates = extractCandidates(article.title, article.excerpt);
  if (!candidates.length) return { matches: [], rawgFailed: false };

  // Only keyword-based candidates (high signal) are eligible for RAWG queries.
  // Capitalized-phrase candidates still go through the free local cache checks.
  const rawgEligible = new Set(extractBeforeKeyword(article.title));

  const matches: GameMatch[] = [];
  let rawgFailed = false;

  for (const candidate of candidates) {
    const normalized = normalizeGameName(candidate);

    // 1. Local alias match (exact, fastest path).
    const { data: aliasRow } = await supabase
      .from('news_game_aliases')
      .select('game_id')
      .eq('normalized_alias', normalized)
      .limit(1)
      .maybeSingle();

    if (aliasRow) {
      matches.push({ game_id: (aliasRow as { game_id: string }).game_id, confidence: 1.0, match_method: 'local_alias' });
      continue;
    }

    // 2. Local game name match (case-insensitive).
    const { data: gameRows } = await supabase
      .from('news_games')
      .select('id')
      .ilike('name', candidate)
      .limit(1);

    if ((gameRows as Array<{ id: string }> | null)?.length) {
      matches.push({ game_id: (gameRows as Array<{ id: string }>)[0].id, confidence: 0.95, match_method: 'local_name' });
      continue;
    }

    // 3. RAWG search — only keyword-based candidates to avoid noisy capitalized-phrase queries.
    if (!rawgEligible.has(candidate)) continue;

    const rawgResults = await searchRawg(candidate);
    if (rawgResults === null) {
      rawgFailed = true;
      continue;
    }
    const best = scoreRawgResults(candidate, rawgResults, article.title);

    if (!best) continue;

    if (best.confidence >= RAWG_AUTO_MATCH_THRESHOLD) {
      const gameId = await upsertGameFromRawg(supabase, best.result);
      if (gameId) {
        await saveAlias(supabase, gameId, candidate);
        matches.push({ game_id: gameId, confidence: best.confidence, match_method: 'rawg' });
      }
    } else if (best.confidence >= RAWG_REVIEW_THRESHOLD) {
      await queueGameMatchCandidate(
        supabase,
        article.id,
        candidate,
        rawgResults as RawgSearchResult[],
        best,
        'low_confidence'
      );
      console.warn(
        `Low-confidence RAWG match (${best.confidence.toFixed(2)}): ` +
        `"${candidate}" → "${best.result.name}" | article: "${article.title}"`
      );
    }
  }

  // Dedupe: keep highest confidence per game.
  const byGame = new Map<string, GameMatch>();
  for (const m of matches) {
    const prev = byGame.get(m.game_id);
    if (!prev || m.confidence > prev.confidence) byGame.set(m.game_id, m);
  }

  return { matches: [...byGame.values()], rawgFailed };
}

export async function saveArticleGameMatches(
  supabase: SupabaseClient,
  articleId: string,
  matches: GameMatch[]
): Promise<void> {
  if (!matches.length) return;

  const rows = matches.map((m) => ({
    article_id: articleId,
    game_id: m.game_id,
    confidence: m.confidence,
    match_method: m.match_method,
  }));

  const { error } = await supabase
    .from('news_article_games')
    .upsert(rows, { onConflict: 'article_id,game_id', ignoreDuplicates: true });

  if (error) console.error('Error saving article-game matches:', error.message);
}
