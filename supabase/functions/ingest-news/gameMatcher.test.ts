import { assertEquals, assertArrayIncludes } from 'jsr:@std/assert';
import {
  normalizeGameName,
  levenshtein,
  stringSimilarity,
  extractBeforeKeyword,
  extractCapitalizedPhrases,
  extractCandidates,
} from './gameMatcher.ts';

// ─── normalizeGameName ──────────────────────────────────────────────────────

Deno.test('normalizeGameName: lowercases and strips punctuation', () => {
  assertEquals(normalizeGameName('Elden Ring'), 'elden ring');
  assertEquals(normalizeGameName('GTA: V'), 'gta  v'.replace(/\s+/, ' '));
  assertEquals(normalizeGameName('GTA: V'), 'gta v');
  assertEquals(normalizeGameName('Hades II!'), 'hades ii');
  assertEquals(normalizeGameName('  Spaces  '), 'spaces');
  assertEquals(normalizeGameName("Marvel's Spider-Man 2"), 'marvel s spider man 2');
});

// ─── levenshtein ────────────────────────────────────────────────────────────

Deno.test('levenshtein: identical strings → 0', () => {
  assertEquals(levenshtein('elden ring', 'elden ring'), 0);
});

Deno.test('levenshtein: empty string edge cases', () => {
  assertEquals(levenshtein('', 'abc'), 3);
  assertEquals(levenshtein('abc', ''), 3);
  assertEquals(levenshtein('', ''), 0);
});

Deno.test('levenshtein: single edit distance', () => {
  assertEquals(levenshtein('abc', 'abx'), 1);
  assertEquals(levenshtein('abc', 'ab'), 1);
  assertEquals(levenshtein('ab', 'abc'), 1);
});

// ─── stringSimilarity ───────────────────────────────────────────────────────

Deno.test('stringSimilarity: identical → 1', () => {
  assertEquals(stringSimilarity('elden ring', 'elden ring'), 1);
  assertEquals(stringSimilarity('', ''), 1);
});

Deno.test('stringSimilarity: completely different → low score', () => {
  const score = stringSimilarity('abc', 'xyz');
  assertEquals(score < 0.5, true);
});

Deno.test('stringSimilarity: close variants → high score', () => {
  // "elden ring" vs "elden rings" → levenshtein 1, max 11 → 1 - 1/11 ≈ 0.909
  const score = stringSimilarity('elden ring', 'elden rings');
  assertEquals(score > 0.85, true);
});

// ─── extractBeforeKeyword ───────────────────────────────────────────────────

Deno.test('extractBeforeKeyword: returns text before news keyword', () => {
  assertEquals(extractBeforeKeyword('Elden Ring Review'), ['Elden Ring']);
  assertEquals(extractBeforeKeyword('GTA 6 Trailer Revealed'), ['GTA 6']);
  // Keywords are matched in NEWS_KEYWORDS order, not title order.
  // 'sequel' precedes 'gets' in the list, so this matches on ' sequel'.
  assertEquals(extractBeforeKeyword('Dark Souls gets a sequel announcement'), ['Dark Souls gets a']);
  // 'gets' is the only matching keyword in this title
  assertEquals(extractBeforeKeyword('Dark Souls gets new modes'), ['Dark Souls']);
  assertEquals(extractBeforeKeyword('Hades 2 delayed to 2026'), ['Hades 2']);
  // 'patch' precedes 'gets' in the keyword list → matches on ' patch'
  assertEquals(extractBeforeKeyword('Star Wars Outlaws gets major patch'), ['Star Wars Outlaws gets major']);
  assertEquals(extractBeforeKeyword('Cyberpunk 2077 launches on mobile'), ['Cyberpunk 2077']);
});

Deno.test('extractBeforeKeyword: strips trailing punctuation from candidate', () => {
  assertEquals(extractBeforeKeyword('Hollow Knight: Silksong announced'), ['Hollow Knight: Silksong']);
  // Trailing dash/comma stripped
  assertEquals(extractBeforeKeyword('Cyberpunk 2077, delayed again'), ['Cyberpunk 2077']);
});

Deno.test('extractBeforeKeyword: returns [] when no keyword found', () => {
  assertEquals(extractBeforeKeyword('No gaming keywords in this headline'), []);
  assertEquals(extractBeforeKeyword(''), []);
  assertEquals(extractBeforeKeyword('Short'), []);
});

Deno.test('extractBeforeKeyword: ignores candidates shorter than 3 chars', () => {
  // "Go review" → idx of " review" = 2 which is NOT > 2, so rejected
  assertEquals(extractBeforeKeyword('Go review'), []);
});

Deno.test('extractBeforeKeyword: returns at most one candidate', () => {
  const result = extractBeforeKeyword('Zelda Tears of the Kingdom review and gameplay trailer');
  assertEquals(result.length <= 1, true);
});

// ─── extractCapitalizedPhrases ──────────────────────────────────────────────

Deno.test('extractCapitalizedPhrases: finds multi-word capitalized phrases', () => {
  assertArrayIncludes(extractCapitalizedPhrases('Elden Ring is amazing'), ['Elden Ring']);
  assertArrayIncludes(extractCapitalizedPhrases('Sony PlayStation reveals new titles'), ['Sony PlayStation']);
});

Deno.test('extractCapitalizedPhrases: captures numeric prefix patterns', () => {
  assertArrayIncludes(extractCapitalizedPhrases('007 First Light gameplay shown'), ['007 First Light']);
});

Deno.test('extractCapitalizedPhrases: skips single-word and short results', () => {
  const result = extractCapitalizedPhrases('Xbox announced new games today');
  // "Xbox" alone (1 word) should not appear; "Xbox" needs companion cap word
  assertEquals(result.includes('Xbox'), false);
});

Deno.test('extractCapitalizedPhrases: empty / all lowercase → []', () => {
  assertEquals(extractCapitalizedPhrases(''), []);
  assertEquals(extractCapitalizedPhrases('all lowercase text here'), []);
});

// ─── extractCandidates ──────────────────────────────────────────────────────

Deno.test('extractCandidates: keyword candidate comes first', () => {
  const result = extractCandidates('Elden Ring Review - Our Thoughts');
  assertEquals(result[0], 'Elden Ring');
});

Deno.test('extractCandidates: deduplicates across sources', () => {
  const result = extractCandidates('Elden Ring Review');
  const unique = new Set(result);
  assertEquals(unique.size, result.length);
});

Deno.test('extractCandidates: includes capitalized phrases from excerpt', () => {
  const result = extractCandidates('New games this week', 'Hollow Knight Silksong was also shown during the showcase');
  assertArrayIncludes(result, ['Hollow Knight Silksong']);
});

Deno.test('extractCandidates: no excerpt → only title candidates', () => {
  const withExcerpt = extractCandidates('Game Review', 'Shadow of the Colossus was shown');
  const withoutExcerpt = extractCandidates('Game Review', null);
  assertEquals(withExcerpt.length >= withoutExcerpt.length, true);
});

Deno.test('extractCandidates: empty title → []', () => {
  assertEquals(extractCandidates(''), []);
  assertEquals(extractCandidates('', null), []);
});

Deno.test('extractCandidates: filters candidates shorter than 3 chars', () => {
  const result = extractCandidates('Go is a board game review');
  // "Go" (2 chars) should not appear
  assertEquals(result.includes('Go'), false);
});

// ─── RAWG eligibility invariant ────────────────────────────────────────────
// The production code gates RAWG calls on extractBeforeKeyword results.
// These tests verify that the keyword extractor produces stable, precise output
// so only high-signal candidates reach the API.

Deno.test('RAWG gate: extractBeforeKeyword is a subset of extractCandidates', () => {
  const titles = [
    'Elden Ring Review',
    'GTA 6 Trailer Shown at Summer Game Fest',
    'Hades 2 gets massive update',
    'Nothing to match here',
    '007 First Light announced for PS5',
  ];

  for (const title of titles) {
    const allCandidates = new Set(extractCandidates(title));
    for (const rawg of extractBeforeKeyword(title)) {
      assertEquals(
        allCandidates.has(rawg),
        true,
        `"${rawg}" from extractBeforeKeyword not in extractCandidates for: "${title}"`,
      );
    }
  }
});

Deno.test('RAWG gate: at most one RAWG candidate per article title', () => {
  const titles = [
    'Elden Ring Review and Gameplay Trailer',
    'GTA 6 gets delayed again this year',
    'Cyberpunk 2077 patch released',
  ];
  for (const title of titles) {
    assertEquals(extractBeforeKeyword(title).length <= 1, true, `title: "${title}"`);
  }
});
