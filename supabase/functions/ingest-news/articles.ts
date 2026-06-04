import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { NormalizedArticle } from './types.ts';

const BATCH_SIZE = 50;

export async function upsertArticles(
  supabase: SupabaseClient,
  articles: NormalizedArticle[]
): Promise<{ inserted: number }> {
  if (articles.length === 0) return { inserted: 0 };

  let inserted = 0;

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('news_articles')
      .upsert(batch, { onConflict: 'url', ignoreDuplicates: true })
      .select('id');

    if (error) {
      console.error('Error upserting articles batch:', error.message);
      continue;
    }

    inserted += data?.length ?? 0;
  }

  return { inserted };
}

export async function updateSourceState(
  supabase: SupabaseClient,
  sourceId: string,
  updates: {
    lastFetchedAt: string;
    nextFetchAt: string;
    etag?: string | null;
    lastModified?: string | null;
    consecutiveFailures?: number;
    isEnabled?: boolean;
  }
): Promise<void> {
  const patch: Record<string, unknown> = {
    last_fetched_at: updates.lastFetchedAt,
    next_fetch_at: updates.nextFetchAt,
    consecutive_failures: updates.consecutiveFailures ?? 0,
    updated_at: new Date().toISOString(),
  };

  if (updates.isEnabled !== undefined) patch['is_enabled'] = updates.isEnabled;
  if (updates.etag !== undefined) patch['etag'] = updates.etag;
  if (updates.lastModified !== undefined) patch['last_modified'] = updates.lastModified;

  const { error } = await supabase
    .from('news_sources')
    .update(patch)
    .eq('id', sourceId);

  if (error) console.error(`Error updating source ${sourceId}:`, error.message);
}
