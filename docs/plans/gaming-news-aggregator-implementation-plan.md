# Gaming News Aggregator Implementation Plan

## Goal

Build a gaming news aggregator that ingests RSS feeds, normalizes articles, groups duplicate stories, extracts related games, generates trending games, and ranks news for a useful homepage feed.

This plan is designed to be implemented with Codex or Claude Code in small, reviewable steps.

---

## Scope

### Included sources

Start with these sources:

```ts
export const RSS_SOURCES = [
  {
    id: "ign",
    name: "IGN",
    category: "general",
    feedUrl: "https://feeds.feedburner.com/ign/games-all",
    homepageUrl: "https://www.ign.com",
    sourceWeight: 1.05
  },
  {
    id: "gamespot",
    name: "GameSpot",
    category: "general",
    feedUrl: "https://www.gamespot.com/feeds/news/",
    homepageUrl: "https://www.gamespot.com",
    sourceWeight: 1.05
  },
  {
    id: "eurogamer",
    name: "Eurogamer",
    category: "general",
    feedUrl: "https://www.eurogamer.net/feed/news",
    homepageUrl: "https://www.eurogamer.net",
    sourceWeight: 1.15
  },
  {
    id: "pc-gamer",
    name: "PC Gamer",
    category: "pc",
    feedUrl: "https://www.pcgamer.com/rss/",
    homepageUrl: "https://www.pcgamer.com",
    sourceWeight: 1.10
  },
  {
    id: "gematsu",
    name: "Gematsu",
    category: "japanese-games",
    feedUrl: "https://www.gematsu.com/feed",
    homepageUrl: "https://www.gematsu.com",
    sourceWeight: 1.00
  },
  {
    id: "playstation-blog",
    name: "PlayStation Blog",
    category: "official",
    feedUrl: "https://blog.playstation.com/feed/",
    homepageUrl: "https://blog.playstation.com",
    sourceWeight: 0.95
  },
  {
    id: "xbox-wire",
    name: "Xbox Wire",
    category: "official",
    feedUrl: "https://news.xbox.com/en-us/feed/",
    homepageUrl: "https://news.xbox.com",
    sourceWeight: 0.95
  }
];
```

Important: before committing feed URLs permanently, validate each feed in code. Some publishers occasionally change RSS paths. Treat this list as configuration, not hardcoded business logic.

### Excluded sources

Do not include these in the MVP:

- Esports.gg
- AFK Gaming

They can be added later if the product expands into esports.

---

## Recommended refresh rate

### Default policy

Poll each source every **30 minutes**.

This is conservative enough for RSS etiquette and still frequent enough for a gaming news app.

```ts
const DEFAULT_REFRESH_INTERVAL_MINUTES = 30;
```

### Why 30 minutes?

- Gaming news rarely needs second-by-second updates.
- Most RSS reader/generator products commonly refresh around 15 minutes, so 30 minutes is safer and less aggressive.
- With 7 sources, a 30-minute interval means about 336 feed requests/day total.
- That is low traffic and unlikely to create operational or publisher-side problems.

### Request volume

```txt
7 sources × 2 requests/hour × 24 hours = 336 feed requests/day
```

### Busy-event mode

During events like Summer Game Fest, Nintendo Direct, State of Play, Xbox Showcase, or The Game Awards, optionally lower the interval to **15 minutes** for 6-12 hours.

```ts
const EVENT_REFRESH_INTERVAL_MINUTES = 15;
```

Only enable this manually or from an admin flag.

### Adaptive backoff

Respect failures and publisher behavior.

Rules:

1. If a feed returns `429`, wait at least 6 hours before retrying that feed. Send an alert by email if that happens with details.
2. If a feed returns `5xx`, retry after 60 minutes.
3. If a feed fails 3 times in a row, pause it for 12 hours. Send an alert by email if that happens with details.
4. If a feed supports `ETag` or `Last-Modified`, send conditional requests.
5. Add jitter so all feeds are not fetched at the exact same minute.

Example:

```ts
const jitterMinutes = Math.floor(Math.random() * 10);
nextFetchAt = addMinutes(now, refreshIntervalMinutes + jitterMinutes);
```

### Conditional request headers

Store these per source:

```ts
etag?: string;
lastModified?: string;
```

Use them on the next request:

```ts
headers: {
  "If-None-Match": source.etag,
  "If-Modified-Since": source.lastModified,
  "User-Agent": "YourAppName/1.0 (+https://yourdomain.com/contact)"
}
```

If the server returns `304 Not Modified`, update `lastFetchedAt` but do not parse or insert articles.

---

## High-level architecture

```txt
RSS source config
   ↓
Scheduled feed fetcher
   ↓
Feed parser
   ↓
Article normalization
   ↓
Duplicate detection / story clustering
   ↓
Game entity extraction
   ↓
Trending game scoring
   ↓
News ranking
   ↓
API routes / frontend pages
```

---

## Database schema

Use Supabase/Postgres.

### sources

```sql
create table sources (
  id text primary key,
  name text not null,
  category text not null,
  feed_url text not null,
  homepage_url text,
  source_weight numeric not null default 1.0,
  refresh_interval_minutes integer not null default 30,
  etag text,
  last_modified text,
  last_fetched_at timestamptz,
  next_fetch_at timestamptz,
  consecutive_failures integer not null default 0,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### articles

```sql
create table articles (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references sources(id),
  title text not null,
  normalized_title text not null,
  url text not null unique,
  canonical_url text,
  excerpt text,
  image_url text,
  author text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  content_hash text,
  cluster_id uuid,
  raw jsonb,
  created_at timestamptz not null default now()
);

create index articles_published_at_idx on articles (published_at desc);
create index articles_source_id_idx on articles (source_id);
create index articles_cluster_id_idx on articles (cluster_id);
```

### story_clusters

```sql
create table story_clusters (
  id uuid primary key default gen_random_uuid(),
  representative_title text not null,
  normalized_title text not null,
  primary_article_id uuid,
  story_score numeric not null default 0,
  article_count integer not null default 1,
  unique_source_count integer not null default 1,
  first_published_at timestamptz,
  latest_published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### games

```sql
create table games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  aliases text[] not null default '{}',
  igdb_id text,
  rawg_id text,
  steam_app_id text,
  created_at timestamptz not null default now()
);

create index games_name_idx on games using gin (to_tsvector('english', name));
```

### article_games

```sql
create table article_games (
  article_id uuid not null references articles(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  confidence numeric not null default 1.0,
  match_method text not null,
  primary key (article_id, game_id)
);
```

### game_trends

```sql
create table game_trends (
  game_id uuid primary key references games(id) on delete cascade,
  mentions_24h integer not null default 0,
  mentions_72h integer not null default 0,
  mentions_7d integer not null default 0,
  unique_sources_72h integer not null default 0,
  official_mentions_72h integer not null default 0,
  trending_score numeric not null default 0,
  calculated_at timestamptz not null default now()
);
```

---

## Article ingestion

### Step 1: fetch due sources

Pseudo-code:

```ts
async function fetchDueSources() {
  const sources = await db.sources.findMany({
    where: {
      isEnabled: true,
      nextFetchAt: { lte: new Date() }
    }
  });

  for (const source of sources) {
    await fetchAndProcessSource(source);
  }
}
```

### Step 2: fetch feed safely

```ts
async function fetchFeed(source: Source) {
  const response = await fetch(source.feedUrl, {
    headers: {
      "User-Agent": "YourAppName/1.0 (+https://yourdomain.com/contact)",
      ...(source.etag ? { "If-None-Match": source.etag } : {}),
      ...(source.lastModified ? { "If-Modified-Since": source.lastModified } : {})
    }
  });

  if (response.status === 304) {
    return { status: "not_modified" };
  }

  if (response.status === 429) {
    throw new RateLimitedError();
  }

  if (!response.ok) {
    throw new FeedFetchError(response.status);
  }

  return {
    status: "ok",
    xml: await response.text(),
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified")
  };
}
```

### Step 3: parse and normalize articles

Use a feed parser package.

For Node:

```bash
npm install rss-parser
```

Normalize each item into:

```ts
type NormalizedArticle = {
  sourceId: string;
  title: string;
  normalizedTitle: string;
  url: string;
  canonicalUrl?: string;
  excerpt?: string;
  imageUrl?: string;
  author?: string;
  publishedAt?: Date;
  contentHash: string;
  raw: unknown;
};
```

Title normalization:

```ts
function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(the|a|an|new|official|trailer|revealed|announced)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
```

---

## Duplicate detection and story clustering

### MVP approach

Cluster articles if:

1. They are published within 72 hours of each other.
2. Their normalized titles are similar.
3. They mention the same primary game, if a game was detected.

Use string similarity first. Add embeddings later only if needed.

Install:

```bash
npm install fast-levenshtein
```

Basic similarity idea:

```ts
function titleSimilarity(a: string, b: string) {
  const distance = levenshtein.get(a, b);
  const maxLength = Math.max(a.length, b.length);
  return 1 - distance / maxLength;
}
```

Cluster threshold:

```ts
const SAME_STORY_THRESHOLD = 0.72;
```

Example:

```txt
IGN: Silksong release date announced
GameSpot: Hollow Knight Silksong finally gets release date
Eurogamer: Silksong launches this September

→ one story cluster
```

### Cluster display rule

On the homepage, show the cluster once.

Display:

```txt
Silksong release date announced
Sources: IGN, GameSpot, Eurogamer
Related articles: 3
```

---

## Game entity extraction and RAWG matching

### MVP approach

RAWG is already used by the application, so RAWG should be part of the MVP game-matching pipeline.

Use RAWG as the external game identity resolver, but do not call RAWG blindly for every article.

Matching priority:

1. Local aliases
2. Local games table
3. RAWG search
4. Confidence scoring
5. Manual review queue for uncertain matches

The goal is to convert article text into stable game records.

Example:

```txt
"Silksong finally gets a release date"

→ Hollow Knight: Silksong
→ rawg_id = <RAWG game id>
→ game_id = <local database id>
```

### Updated games schema

Use RAWG fields directly in the local `games` table.

```sql
create table games (
  id uuid primary key default gen_random_uuid(),
  rawg_id text unique,
  name text not null,
  slug text not null unique,
  released date,
  image_url text,
  platforms text[] not null default '{}',
  genres text[] not null default '{}',
  steam_app_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Add game aliases table

Do not keep aliases only as a `text[]` on `games`.

Use a separate table so aliases can be indexed, reviewed, and added over time.

```sql
create table game_aliases (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (game_id, normalized_alias)
);

create index game_aliases_normalized_alias_idx on game_aliases (normalized_alias);
```

Alias examples:

```json
{
  "name": "Hollow Knight: Silksong",
  "aliases": [
    "Silksong",
    "Hollow Knight Silksong",
    "HK Silksong"
  ]
}
```

### Candidate extraction

Extract possible game names from:

- Article title
- Article excerpt
- Feed categories/tags, if available

Start simple.

Candidate extraction can use:

1. Known local game names and aliases
2. Capitalized title phrases
3. Text before common news words like `update`, `patch`, `trailer`, `release date`, `review`, `DLC`

Example:

```ts
function extractCandidates(title: string, excerpt?: string) {
  const text = `${title} ${excerpt ?? ""}`;

  return [
    ...extractKnownAliasCandidates(text),
    ...extractCapitalizedPhrases(title),
    ...extractBeforeNewsKeywords(title)
  ];
}
```

### matchArticleToGames pseudo-code

```ts
async function matchArticleToGames(article: NormalizedArticle) {
  const candidates = extractCandidates(article.title, article.excerpt);

  const matches = [];

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeGameName(candidate);

    // 1. Try local alias match first.
    const aliasMatch = await findGameByAlias(normalizedCandidate);

    if (aliasMatch) {
      matches.push({
        gameId: aliasMatch.gameId,
        confidence: 1.0,
        matchMethod: "local_alias"
      });

      continue;
    }

    // 2. Try local canonical game name.
    const localGameMatch = await findGameByName(normalizedCandidate);

    if (localGameMatch) {
      matches.push({
        gameId: localGameMatch.id,
        confidence: 0.95,
        matchMethod: "local_name"
      });

      continue;
    }

    // 3. Query RAWG only if no local match exists.
    const rawgResults = await searchRawgGames(candidate);

    const bestMatch = scoreRawgResults(candidate, rawgResults, article);

    if (bestMatch && bestMatch.confidence >= 0.85) {
      const game = await upsertGameFromRawg(bestMatch.rawgGame);

      await saveGameAlias({
        gameId: game.id,
        alias: candidate,
        source: "rawg_match"
      });

      matches.push({
        gameId: game.id,
        confidence: bestMatch.confidence,
        matchMethod: "rawg"
      });

      continue;
    }

    // 4. Queue uncertain matches for later review.
    await queueUnmatchedGameCandidate({
      articleId: article.id,
      candidate,
      rawgResults,
      reason: "low_confidence"
    });
  }

  return dedupeMatches(matches);
}
```

### RAWG result scoring

Do not blindly use RAWG’s first result.

Score the results.

```ts
function scoreRawgResults(
  candidate: string,
  rawgResults: RawgGame[],
  article: NormalizedArticle
) {
  return rawgResults
    .map(rawgGame => {
      const nameSimilarity = compareNormalizedNames(candidate, rawgGame.name);

      const slugSimilarity = compareNormalizedNames(
        candidate,
        rawgGame.slug.replaceAll("-", " ")
      );

      const titleContainsName = article.title
        .toLowerCase()
        .includes(rawgGame.name.toLowerCase());

      const platformBoost = rawgGame.platforms?.length ? 0.05 : 0;
      const imageBoost = rawgGame.background_image ? 0.03 : 0;

      const confidence =
        Math.max(nameSimilarity, slugSimilarity) +
        (titleContainsName ? 0.1 : 0) +
        platformBoost +
        imageBoost;

      return {
        rawgGame,
        confidence: Math.min(confidence, 1)
      };
    })
    .sort((a, b) => b.confidence - a.confidence)[0];
}
```

Suggested thresholds:

```ts
const RAWG_AUTO_MATCH_THRESHOLD = 0.85;
const RAWG_REVIEW_THRESHOLD = 0.65;
```

Rules:

```txt
>= 0.85  auto-match
0.65-0.84 queue for review
< 0.65   ignore
```

### RAWG API usage strategy

Avoid unnecessary API calls.

Process:

1. Check local alias table.
2. Check local games table.
3. Search RAWG only if no local match exists.
4. Save successful matches locally.
5. Save the candidate as an alias.
6. Reuse that alias for future articles.

Benefits:

- Lower RAWG API usage
- Faster ingestion
- More consistent game matching
- Better trending calculations

### Article game relation

Store the match confidence and method.

```sql
create table article_games (
  article_id uuid not null references articles(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  confidence numeric not null default 1.0,
  match_method text not null,
  created_at timestamptz not null default now(),
  primary key (article_id, game_id)
);
```

Example values:

```txt
local_alias
local_name
rawg
manual
```

### Important rule

Trending must be calculated from normalized `game_id`, not raw article text.

Example:

```txt
"Silksong gets release date"
"Hollow Knight: Silksong launches this year"
"HK Silksong release confirmed"

All should resolve to the same local game record.
```

### MVP approach

Use a local `games` table with aliases.

Start with:

1. Top 500-1000 currently relevant games.
2. Manual aliases for common abbreviations.
3. Game names from article titles.
4. Optional enrichment from IGDB, RAWG, or Steam later.

Example game record:

```json
{
  "name": "Hollow Knight: Silksong",
  "slug": "hollow-knight-silksong",
  "aliases": ["Silksong", "Hollow Knight Silksong", "HK Silksong"]
}
```

### Matching logic

Check title first, then excerpt.

```ts
function matchGames(article: NormalizedArticle, games: Game[]) {
  const text = `${article.title} ${article.excerpt ?? ""}`.toLowerCase();

  return games.filter(game => {
    const names = [game.name, ...game.aliases];

    return names.some(name =>
      text.includes(name.toLowerCase())
    );
  });
}
```

### Confidence scoring

```ts
const confidence = {
  exactTitleMatch: 1.0,
  aliasTitleMatch: 0.9,
  excerptOnlyMatch: 0.65
};
```

Avoid low-confidence matches. Bad game matching makes trending useless.

---

## Trending games

### Goal

Trending should answer:

> Which games are being covered right now across multiple reliable sources?

Do not use raw article count only.

### Scoring formula

```ts
trendingScore =
  mentions24h * 4 +
  mentions72h * 2 +
  uniqueSources72h * 8 +
  officialMentions72h * 10 +
  spikeBonus
```

Where:

```ts
officialMentions72h = mentions from PlayStation Blog or Xbox Wire
```

### Spike bonus

Reward sudden bursts.

```ts
spikeBonus =
  mentions24h >= 3 && mentions7dPreviousAverage <= 1
    ? 15
    : 0;
```

### Example

```txt
Game A:
- 5 mentions in 24h
- 10 mentions in 72h
- 5 unique sources
- 1 official source mention

Score = 5*4 + 10*2 + 5*8 + 1*10 = 90
```

### Job schedule

Recalculate trends every 30 minutes after article ingestion.

```ts
async function recalculateGameTrends() {
  // Calculate rolling windows from articles + article_games.
}
```

---

## News ordering

### Pages

Build three feed types:

1. `Homepage`: ranked story clusters.
2. `Latest`: individual articles in strict reverse chronological order.
3. `Trending Games`: games ranked by trend score.

---

## Homepage ranking

Use story clusters, not raw articles.

```ts
homepageScore =
  recencyScore +
  sourceScore +
  trendingGameBoost +
  clusterSourceBoost -
  duplicatePenalty
```

### Recency score

```ts
function recencyScore(publishedAt: Date) {
  const hoursOld = differenceInHours(new Date(), publishedAt);

  if (hoursOld <= 2) return 50;
  if (hoursOld <= 6) return 40;
  if (hoursOld <= 12) return 30;
  if (hoursOld <= 24) return 20;
  if (hoursOld <= 48) return 10;

  return 0;
}
```

### Source score

Use the best source weight in the cluster.

```ts
sourceScore = max(sourceWeightsInCluster) * 10;
```

### Trending game boost

```ts
trendingGameBoost = Math.min(maxGameTrendingScoreInCluster / 10, 25);
```

### Cluster source boost

```ts
clusterSourceBoost = uniqueSourceCount * 5;
```

### Duplicate penalty

If a cluster has too many same-source articles, keep the best one and hide the rest from homepage.

```ts
duplicatePenalty = sameSourceDuplicateCount * 5;
```

---

## Feed display limits

### Homepage

Show:

```txt
25 story clusters
```

### Latest page

Show:

```txt
100 individual articles
```

Use pagination or infinite scroll.

### Trending games page

Show:

```txt
25 games
```

### Game detail page

Show all articles for that game, paginated.

---

## API routes

Example API shape:

```txt
GET /api/news/homepage
GET /api/news/latest?limit=100&cursor=...
GET /api/games/trending
GET /api/games/:slug/articles
GET /api/sources
POST /api/admin/ingest/run
```

### Homepage response

```ts
type HomepageStory = {
  clusterId: string;
  title: string;
  score: number;
  latestPublishedAt: string;
  sources: {
    id: string;
    name: string;
    articleUrl: string;
  }[];
  games: {
    id: string;
    name: string;
    slug: string;
  }[];
  imageUrl?: string;
};
```

---

## Frontend pages

### Homepage

Sections:

1. Top Stories
2. Trending Games
3. Latest News Preview

### Latest News

- Strict chronological feed.
- Source filters.
- Platform filters later.

### Trending Games

- Top 25 games.
- Show mention count, source count, and last update.

### Game Page

- Game title.
- Related article list.
- Sources.
- Trend sparkline later.

---

## Codex / Claude Code implementation tasks

### Task 1: Add source config

Create:

```txt
src/news/sources.ts
```

Add the source list and refresh config.

Acceptance criteria:

- Sources are exported as typed objects.
- Each source has id, name, category, feedUrl, homepageUrl, and sourceWeight.
- No esports sources are included.

---

### Task 2: Add database migrations

Create tables:

- sources
- articles
- story_clusters
- games
- article_games
- game_trends

Acceptance criteria:

- Migrations run successfully.
- Article URL is unique.
- Foreign keys are set correctly.
- Useful indexes exist for `published_at`, `source_id`, and `cluster_id`.

---

### Task 3: Seed sources

Create a seed script to insert/update configured RSS sources. Document details about each RSS feed in their file under /docs/external/news

Acceptance criteria:

- Running the seed twice does not create duplicates.
- Existing source metadata updates if config changes.
- Documentation is done

---

### Task 4: Implement RSS fetcher

Create:

```txt
src/news/rssFetcher.ts
```

Acceptance criteria:

- Fetches a feed by source.
- Sends `User-Agent`.
- Sends `If-None-Match` and `If-Modified-Since` when available.
- Handles `304`, `429`, `5xx`, and normal `200`.
- Stores updated `etag` and `lastModified`.

---

### Task 5: Implement parser and normalizer

Create:

```txt
src/news/feedParser.ts
src/news/normalizeArticle.ts
```

Acceptance criteria:

- Parses RSS items.
- Extracts title, URL, excerpt, image, author, published date.
- Generates normalized title.
- Generates content hash.
- Skips items with no title or URL.

---

### Task 6: Save articles idempotently

Create:

```txt
src/news/articleRepository.ts
```

Acceptance criteria:

- Inserts new articles.
- Does not duplicate existing URLs.
- Updates missing metadata if needed.
- Stores raw feed item JSON.

---

### Task 7: Implement RAWG-powered game matching

Create:

```txt
src/news/gameMatcher.ts
src/news/rawgGameResolver.ts
src/news/gameAliasRepository.ts
```

Acceptance criteria:

- Loads local games and aliases first.
- Matches article title and excerpt.
- Calls RAWG only when no local match exists.
- Scores RAWG results before accepting a match.
- Auto-matches only when confidence is high enough.
- Saves matched RAWG games into the local games table.
- Saves successful candidate names into game_aliases.
- Stores matches in article_games.
- Queues uncertain matches for manual review or logs them for later.
- Does not blindly attach the first RAWG result.

---

### Task 8: Implement story clustering

Create:

```txt
src/news/storyClusterer.ts
```

Acceptance criteria:

- Finds candidate clusters within 72 hours.
- Compares normalized titles.
- Uses same detected game when available.
- Creates new cluster when no match exists.
- Updates cluster article count, unique source count, and latest published date.

---

### Task 9: Implement trending calculation

Create:

```txt
src/news/trendingCalculator.ts
```

Acceptance criteria:

- Calculates mentions for 24h, 72h, and 7d.
- Calculates unique source count.
- Calculates official source mentions.
- Saves score to `game_trends`.
- Can be safely run repeatedly.

---

### Task 10: Implement ranking

Create:

```txt
src/news/newsRanker.ts
```

Acceptance criteria:

- Ranks story clusters for homepage.
- Latest page remains chronological.
- Trending games page uses `game_trends.trending_score`.
- Ranking constants are easy to tune.

---

### Task 11: Add scheduled ingestion

Depending on stack:

- Vercel Cron
- Supabase scheduled function
- GitHub Actions
- Server cron job

Recommended for Vercel:

```txt
Run ingestion every 10 minutes, but only fetch sources whose `next_fetch_at <= now()`.
```

This lets the scheduler be frequent while each RSS source still respects its 30-minute refresh interval.

Acceptance criteria:

- Scheduler does not fetch all feeds every run.
- Each source controls its own `next_fetch_at`.
- Backoff rules are respected.

---

### Task 12: Build API routes

Create routes:

```txt
GET /api/news/homepage
GET /api/news/latest
GET /api/games/trending
GET /api/games/:slug/articles
```

Acceptance criteria:

- Homepage returns 25 clusters.
- Latest returns individual articles.
- Trending returns top 25 games.
- Game page returns paginated articles.

---

### Task 13: Build minimal UI

Build pages:

```txt
/
 /latest
 /games/trending
 /games/[slug]
```

Acceptance criteria:

- Homepage shows story clusters.
- Latest shows chronological articles.
- Trending games shows ranked games.
- Clicking a game opens related articles.

---

## MVP order

Build in this order:

1. Source config
2. Database migrations
3. Seed sources
4. RSS fetcher
5. Parser/normalizer
6. Article insert
7. Basic latest feed
8. RAWG-powered game matching
9. Story clustering
10. Trending scores
11. Homepage ranking
12. UI polish

This avoids building ranking logic before you have real ingested data.

---

## Important implementation notes

### Do not scrape full article content in the MVP

Store only:

- title
- URL
- excerpt/description from feed
- image URL
- author
- published date
- source

This is safer and sufficient for discovery.

### Always link to the original article

Your app should be a discovery layer, not a republisher.

### Keep ranking explainable

Store intermediate values or add debug logs:

```ts
{
  recencyScore,
  sourceScore,
  trendingGameBoost,
  clusterSourceBoost,
  finalScore
}
```

This makes it easier to tune.

### Add an admin debug page later

Useful admin views:

```txt
/admin/sources
/admin/articles
/admin/clusters
/admin/trending
```

Show:

- last fetch time
- next fetch time
- failures
- latest parsed article
- duplicate clusters
- game matches

---

## Future improvements

### Better game matching

RAWG is already part of the MVP.

Later improvements:

- IGDB enrichment
- Steam app search
- Manual alias management UI
- Admin review screen for low-confidence matches
- Embeddings for ambiguous article titles
- LLM-assisted extraction for difficult cases

### Better duplicate detection

Add embeddings if title similarity is not enough.

Possible future fields:

```sql
embedding vector(1536)
```

### Personalization

Later, add:

- followed games
- hidden sources
- preferred platforms
- preferred genres

Then boost homepage ranking based on user preferences.

---

## Final MVP behavior

The MVP should produce:

```txt
Homepage:
- 25 ranked story clusters

Latest:
- 100 chronological articles

Trending Games:
- Top 25 games

Game Detail:
- Paginated articles for a game
```

Refresh behavior:

```txt
Scheduler runs every 10 minutes.
Each source is fetched every 30 minutes by default.
Event mode can temporarily fetch every 15 minutes.
429 responses back off for at least 6 hours.
5xx responses retry after 60 minutes.
3 consecutive failures pause a source for 12 hours.
```
