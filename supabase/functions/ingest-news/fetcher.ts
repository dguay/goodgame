import type { NewsSource, FetchResult } from './types.ts';

const USER_AGENT = 'Goodgame/1.0 (+https://goodgame.app/contact)';

export async function fetchFeed(source: NewsSource): Promise<FetchResult> {
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT };

  if (source.etag) headers['If-None-Match'] = source.etag;
  if (source.last_modified) headers['If-Modified-Since'] = source.last_modified;

  let response: Response;
  try {
    response = await fetch(source.feed_url, { headers });
  } catch (err) {
    return { status: 'error', error: String(err) };
  }

  if (response.status === 304) return { status: 'not_modified' };
  if (response.status === 429) return { status: 'rate_limited', statusCode: 429 };
  if (response.status >= 500) return { status: 'server_error', statusCode: response.status };

  if (!response.ok) {
    return { status: 'error', statusCode: response.status, error: `HTTP ${response.status}` };
  }

  const xml = await response.text();
  return {
    status: 'ok',
    xml,
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
  };
}
