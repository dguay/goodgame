import { XMLParser } from 'npm:fast-xml-parser@4.3.6';
import type { NormalizedArticle } from './types.ts';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'item' || name === 'entry',
});

const RE_QUOTES = /['']/g;
const RE_NON_ALPHANUM = /[^a-z0-9 ]/g;
const RE_STOP_WORDS = /\b(the|a|an|new|official|trailer|revealed|announced|first|full)\b/g;
const RE_MULTI_SPACE = /\s+/g;
const RE_HTML_TAGS = /<[^>]*>/g;
const RE_HTML_ENTITIES = /&(?:[a-z]+|#\d+);/gi;

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(RE_QUOTES, '')
    .replace(RE_NON_ALPHANUM, ' ')
    .replace(RE_STOP_WORDS, '')
    .replace(RE_MULTI_SPACE, ' ')
    .trim();
}

export async function contentHash(url: string, title: string): Promise<string> {
  const data = new TextEncoder().encode(`${url}:${title}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

function stripHtml(raw: string): string {
  return raw
    .replace(RE_HTML_TAGS, '')
    .replace(RE_HTML_ENTITIES, ' ')
    .replace(RE_MULTI_SPACE, ' ')
    .trim();
}

function extractImageUrl(item: Record<string, unknown>): string | null {
  const enclosure = item['enclosure'];
  if (enclosure && typeof enclosure === 'object') {
    const enc = enclosure as Record<string, unknown>;
    const type = String(enc['@_type'] ?? '');
    if (type.startsWith('image') && typeof enc['@_url'] === 'string') return enc['@_url'];
  }

  for (const key of ['media:content', 'media:thumbnail']) {
    const mc = item[key];
    if (mc && typeof mc === 'object' && typeof (mc as Record<string, unknown>)['@_url'] === 'string') {
      return (mc as Record<string, unknown>)['@_url'] as string;
    }
  }

  return null;
}

function resolveUrl(raw: unknown): string | null {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();

  if (Array.isArray(raw)) {
    const link = (raw as Array<Record<string, unknown>>).find(
      (l) => !l['@_rel'] || l['@_rel'] === 'alternate'
    );
    if (link && typeof link['@_href'] === 'string') return link['@_href'];
  }

  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj['@_href'] === 'string') return obj['@_href'];
    if (typeof obj['#text'] === 'string') return obj['#text'].trim();
  }

  return null;
}

function resolveText(raw: unknown): string | null {
  if (typeof raw === 'string') return raw.trim() || null;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return typeof obj['#text'] === 'string' ? obj['#text'].trim() || null : null;
  }
  return null;
}

function rootDomain(url: string): string {
  try {
    const parts = new URL(url).hostname.split('.');
    return parts.length >= 2 ? parts.slice(-2).join('.') : parts[0];
  } catch {
    return '';
  }
}

function isUrlTrusted(url: string, sourceHomepageUrl: string | null): boolean {
  if (!url.startsWith('https://')) return false;
  if (!sourceHomepageUrl) return true;
  return rootDomain(url) === rootDomain(sourceHomepageUrl);
}

export async function parseRSS(
  xml: string,
  sourceId: string,
  sourceHomepageUrl: string | null = null
): Promise<NormalizedArticle[]> {
  let parsed: Record<string, unknown>;
  try {
    parsed = xmlParser.parse(xml) as Record<string, unknown>;
  } catch {
    return [];
  }

  const rss = parsed['rss'] as Record<string, unknown> | undefined;
  const channel = (rss?.['channel'] ?? parsed['feed']) as Record<string, unknown> | undefined;
  if (!channel) return [];

  const items: Record<string, unknown>[] = [
    ...((channel['item'] as Record<string, unknown>[]) ?? []),
    ...((channel['entry'] as Record<string, unknown>[]) ?? []),
  ];

  const articles: NormalizedArticle[] = [];

  for (const item of items) {
    const title = resolveText(item['title']);
    if (!title) continue;

    const url = resolveUrl(item['link'] ?? item['id']);
    if (!url || !isUrlTrusted(url, sourceHomepageUrl)) continue;

    const rawExcerpt =
      resolveText(item['description']) ??
      resolveText(item['summary']) ??
      resolveText(item['content']);
    const excerpt = rawExcerpt ? stripHtml(rawExcerpt).slice(0, 500) || null : null;

    const pubDateRaw =
      resolveText(item['pubDate']) ??
      resolveText(item['published']) ??
      resolveText(item['updated']);
    let publishedAt: string | null = null;
    if (pubDateRaw) {
      const d = new Date(pubDateRaw);
      if (!isNaN(d.getTime())) publishedAt = d.toISOString();
    }

    const authorRaw = item['author'];
    let author: string | null = null;
    if (typeof authorRaw === 'string') {
      author = authorRaw.trim() || null;
    } else if (authorRaw && typeof authorRaw === 'object') {
      author = resolveText((authorRaw as Record<string, unknown>)['name']);
    }

    const hash = await contentHash(url, title);

    articles.push({
      source_id: sourceId,
      title,
      normalized_title: normalizeTitle(title),
      url,
      canonical_url: null,
      excerpt,
      image_url: extractImageUrl(item),
      author,
      published_at: publishedAt,
      content_hash: hash,
      raw: item,
    });
  }

  return articles;
}
