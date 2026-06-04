export interface NewsSource {
  id: string;
  name: string;
  category: string;
  feed_url: string;
  homepage_url: string | null;
  source_weight: number;
  refresh_interval_minutes: number;
  etag: string | null;
  last_modified: string | null;
  last_fetched_at: string | null;
  next_fetch_at: string | null;
  consecutive_failures: number;
  is_enabled: boolean;
}

export interface NormalizedArticle {
  source_id: string;
  title: string;
  normalized_title: string;
  url: string;
  canonical_url: string | null;
  excerpt: string | null;
  image_url: string | null;
  author: string | null;
  published_at: string | null;
  content_hash: string;
  raw: unknown;
}

export type FetchStatus = 'ok' | 'not_modified' | 'rate_limited' | 'server_error' | 'error';

export interface FetchResult {
  status: FetchStatus;
  xml?: string;
  etag?: string | null;
  lastModified?: string | null;
  statusCode?: number;
  error?: string;
}
