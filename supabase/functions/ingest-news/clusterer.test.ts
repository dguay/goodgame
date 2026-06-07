import { assertEquals } from 'jsr:@std/assert';
import {
  chunkArray,
  tokenize,
  wordJaccard,
  canJoinCluster,
  CLUSTER_STOP_WORDS,
} from './clusterer.ts';

// ─── chunkArray ─────────────────────────────────────────────────────────────
// Regression tests for the URL-length bug: .in() with 611 UUIDs exceeded
// PostgREST's URL limit (~16 KB), causing updateRecentClusterScores to
// return early with no score updates. Chunking keeps each request under 4 KB.

Deno.test('chunkArray: empty array → no chunks', () => {
  assertEquals(chunkArray([], 100), []);
});

Deno.test('chunkArray: array smaller than chunk size → single chunk', () => {
  assertEquals(chunkArray([1, 2, 3], 100), [[1, 2, 3]]);
});

Deno.test('chunkArray: array exactly chunk size → single chunk', () => {
  assertEquals(chunkArray([1, 2, 3], 3), [[1, 2, 3]]);
});

Deno.test('chunkArray: evenly divisible → equal-sized chunks', () => {
  assertEquals(chunkArray([1, 2, 3, 4, 5, 6], 2), [[1, 2], [3, 4], [5, 6]]);
});

Deno.test('chunkArray: remainder → last chunk is partial', () => {
  assertEquals(chunkArray([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

Deno.test('chunkArray: no elements lost at 611 IDs (URL bug regression)', () => {
  const ids = Array.from({ length: 611 }, (_, i) => `id-${i}`);
  const chunks = chunkArray(ids, 100);
  // 7 chunks: six of 100, one of 11
  assertEquals(chunks.length, 7);
  assertEquals(chunks[0].length, 100);
  assertEquals(chunks[6].length, 11);
  assertEquals(chunks.flat(), ids);
});

Deno.test('chunkArray: order preserved across chunks', () => {
  const input = ['a', 'b', 'c', 'd', 'e'];
  const flat = chunkArray(input, 2).flat();
  assertEquals(flat, input);
});

// ─── tokenize ───────────────────────────────────────────────────────────────

Deno.test('tokenize: returns meaningful words', () => {
  const result = tokenize('gothic remake review');
  assertEquals(result.has('gothic'), true);
  assertEquals(result.has('remake'), true);
  assertEquals(result.has('review'), true);
});

Deno.test('tokenize: strips function-word stop words', () => {
  const result = tokenize('how to get armour in gothic remake');
  assertEquals(result.has('how'), false);
  assertEquals(result.has('to'), false);
  assertEquals(result.has('get'), false);
  assertEquals(result.has('in'), false);
  assertEquals(result.has('gothic'), true);
  assertEquals(result.has('remake'), true);
});

Deno.test('tokenize: strips platform-name stop words', () => {
  const result = tokenize('alien isolation 2 for ps5 xbox series switch 2 and pc');
  assertEquals(result.has('ps5'), false);
  assertEquals(result.has('xbox'), false);
  assertEquals(result.has('series'), false);
  assertEquals(result.has('switch'), false);
  assertEquals(result.has('pc'), false);
  assertEquals(result.has('and'), false);
  assertEquals(result.has('for'), false);
  assertEquals(result.has('alien'), true);
  assertEquals(result.has('isolation'), true);
});

Deno.test('tokenize: filters single-character tokens', () => {
  const result = tokenize('gothic 1 remake');
  assertEquals(result.has('1'), false);
  assertEquals(result.has('gothic'), true);
  assertEquals(result.has('remake'), true);
});

Deno.test('tokenize: empty string → empty set', () => {
  assertEquals(tokenize('').size, 0);
});

Deno.test('tokenize: deduplicates repeated words', () => {
  const result = tokenize('gothic gothic remake');
  assertEquals(result.size, 2);
  assertEquals(result.has('gothic'), true);
});

Deno.test('tokenize: all stop words → empty set', () => {
  assertEquals(tokenize('for and of in on to at by').size, 0);
});

Deno.test('tokenize: CLUSTER_STOP_WORDS contains expected entries', () => {
  assertEquals(CLUSTER_STOP_WORDS.has('ps5'), true);
  assertEquals(CLUSTER_STOP_WORDS.has('xbox'), true);
  assertEquals(CLUSTER_STOP_WORDS.has('switch'), true);
  assertEquals(CLUSTER_STOP_WORDS.has('for'), true);
  assertEquals(CLUSTER_STOP_WORDS.has('elden'), false);
});

// ─── wordJaccard ────────────────────────────────────────────────────────────

Deno.test('wordJaccard: identical titles → 1.0', () => {
  assertEquals(wordJaccard('gothic 1 remake review', 'gothic 1 remake review'), 1.0);
});

Deno.test('wordJaccard: identical platform-heavy titles → 1.0 (exact-match shortcut)', () => {
  // "Nintendo Switch 2 announced" normalizes to "nintendo switch 2" — tokenize strips
  // "nintendo", "switch", and filters "2" (single char), leaving an empty set.
  // Without the exact-match shortcut, wordJaccard would return 0.
  assertEquals(wordJaccard('nintendo switch 2', 'nintendo switch 2'), 1.0);
});

Deno.test('wordJaccard: empty strings → 0 (minimum 2 shared words required)', () => {
  // Two articles with no tokens can't satisfy the minimum-intersection guard.
  assertEquals(wordJaccard('', ''), 0);
});

Deno.test('wordJaccard: completely different titles → 0', () => {
  assertEquals(wordJaccard('elden ring dlc expansion', 'minecraft update patch notes'), 0);
});

Deno.test('wordJaccard: only 1 shared word → 0 (minimum 2 required)', () => {
  // "review" is the only common word — not enough signal
  const sim = wordJaccard('elden ring review', 'diablo review');
  assertEquals(sim, 0);
});

Deno.test('wordJaccard: TRUE POSITIVE — Gothic review, same story different phrasing', () => {
  // "Gothic 1 Remake review" vs "Gothic 1 Remake Review So Far" (two real sources)
  const sim = wordJaccard('gothic 1 remake review', 'gothic 1 remake review so far');
  assertEquals(sim >= 0.5, true, `expected >= 0.5, got ${sim}`);
});

Deno.test('wordJaccard: TRUE POSITIVE — Monster Hunter Wilds, identical headline', () => {
  // Real case: two sources ran the same headline verbatim
  const sim = wordJaccard(
    'monster hunter wilds confirmed for nintendo switch 2',
    'monster hunter wilds confirmed for nintendo switch 2',
  );
  assertEquals(sim, 1.0);
});

Deno.test('wordJaccard: FALSE POSITIVE prevented — guide articles from same source', () => {
  // "How to earn ore in Gothic Remake" and "How to fast travel in Gothic Remake"
  // are different articles wrongly clustered by old Levenshtein due to shared suffix
  const sim = wordJaccard(
    'how to earn ore in gothic remake',
    'how to fast travel in gothic remake',
  );
  assertEquals(sim < 0.5, true, `expected < 0.5, got ${sim}`);
});

Deno.test('wordJaccard: FALSE POSITIVE prevented — announcement template boilerplate', () => {
  // "Alien: Isolation 2 announced for PS5, Xbox Series, Switch 2, and PC"
  // vs "Attack on Titan 3 announced for PS5, Xbox Series, Switch 2, and PC"
  // Old Levenshtein scored these as similar because of the shared platform list
  const sim = wordJaccard(
    'alien isolation 2 for ps5 xbox series switch 2 and pc',
    'attack on titan 3 for ps5 xbox series switch 2 and pc',
  );
  assertEquals(sim < 0.5, true, `expected < 0.5, got ${sim}`);
});

Deno.test('wordJaccard: FALSE POSITIVE prevented — different games same launch date', () => {
  // "Go-Go Town! launches July 16 for Switch 2, Switch, and PC"
  // vs "The Mermaid Mask launches July 16 for PS5, Switch 2, Switch, and PC"
  const sim = wordJaccard(
    'go go town launches july 16 for switch 2 switch and pc',
    'mermaid mask launches july 16 for ps5 switch 2 switch and pc',
  );
  assertEquals(sim < 0.5, true, `expected < 0.5, got ${sim}`);
});

Deno.test('wordJaccard: same story, slightly different headline → matches', () => {
  // Two sources covering the same announcement with different wording
  const sim = wordJaccard(
    'elden ring shadow erdtree dlc release date confirmed',
    'elden ring shadow erdtree dlc release date june',
  );
  assertEquals(sim >= 0.5, true, `expected >= 0.5, got ${sim}`);
});

Deno.test('wordJaccard: symmetry — order of arguments does not matter', () => {
  const a = 'monster hunter wilds confirmed for nintendo switch 2';
  const b = 'monster hunter wilds releasing on switch 2';
  assertEquals(wordJaccard(a, b), wordJaccard(b, a));
});

// ─── canJoinCluster ──────────────────────────────────────────────────────────

Deno.test('canJoinCluster: same source → false (core same-source guard)', () => {
  assertEquals(
    canJoinCluster(new Set(), new Set(), 'source-ign', new Set(['source-ign'])),
    false,
  );
});

Deno.test('canJoinCluster: same source blocked even with matching games', () => {
  // Game overlap is irrelevant when source already in cluster
  assertEquals(
    canJoinCluster(
      new Set(['game-1']),
      new Set(['game-1']),
      'source-ign',
      new Set(['source-ign']),
    ),
    false,
  );
});

Deno.test('canJoinCluster: different source, no game data on either side → true', () => {
  assertEquals(
    canJoinCluster(new Set(), new Set(), 'source-ign', new Set(['source-polygon'])),
    true,
  );
});

Deno.test('canJoinCluster: different source, article has games, cluster has none → true', () => {
  assertEquals(
    canJoinCluster(new Set(['game-1']), new Set(), 'source-ign', new Set(['source-polygon'])),
    true,
  );
});

Deno.test('canJoinCluster: different source, cluster has games, article has none → true', () => {
  assertEquals(
    canJoinCluster(new Set(), new Set(['game-1']), 'source-ign', new Set(['source-polygon'])),
    true,
  );
});

Deno.test('canJoinCluster: different source, overlapping games → true', () => {
  assertEquals(
    canJoinCluster(
      new Set(['game-1', 'game-2']),
      new Set(['game-1', 'game-3']),
      'source-ign',
      new Set(['source-polygon']),
    ),
    true,
  );
});

Deno.test('canJoinCluster: different source, non-overlapping games → false', () => {
  assertEquals(
    canJoinCluster(
      new Set(['game-1']),
      new Set(['game-2']),
      'source-ign',
      new Set(['source-polygon']),
    ),
    false,
  );
});

Deno.test('canJoinCluster: empty cluster sources (brand new cluster) → allowed', () => {
  // A new cluster has no sources yet; any article may join
  assertEquals(
    canJoinCluster(new Set(), new Set(), 'source-ign', new Set()),
    true,
  );
});

Deno.test('canJoinCluster: cluster has multiple sources, article is a new one → true', () => {
  assertEquals(
    canJoinCluster(
      new Set(['game-1']),
      new Set(['game-1']),
      'source-eurogamer',
      new Set(['source-ign', 'source-polygon']),
    ),
    true,
  );
});

Deno.test('canJoinCluster: cluster has multiple sources, article source already present → false', () => {
  assertEquals(
    canJoinCluster(
      new Set(['game-1']),
      new Set(['game-1']),
      'source-ign',
      new Set(['source-ign', 'source-polygon']),
    ),
    false,
  );
});
