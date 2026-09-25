import { DAY_MS, HOUR_MS } from '@/lib/time'
import type { LibraryEntry } from '@/types/database'

export const DEFAULT_METADATA_STALE_MS = DAY_MS
export const NEAR_RELEASE_METADATA_STALE_MS = 12 * HOUR_MS
export const NEAR_RELEASE_WINDOW_MS = 14 * DAY_MS

function parseTodayAndRelease(
  releaseDate: string | null,
  now: Date,
): { todayMs: number; releaseMs: number } | null {
  if (releaseDate == null) return null
  const releaseMs = new Date(`${releaseDate}T00:00:00`).getTime()
  if (Number.isNaN(releaseMs)) return null

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return { todayMs: today.getTime(), releaseMs }
}

export function isFutureRelease(releaseDate: string | null, now: Date = new Date()): boolean {
  const parsed = parseTodayAndRelease(releaseDate, now)
  if (parsed == null) return false
  return parsed.releaseMs > parsed.todayMs
}

export function isNearRelease(releaseDate: string | null, now: Date = new Date()): boolean {
  const parsed = parseTodayAndRelease(releaseDate, now)
  if (parsed == null) return false
  const diff = parsed.releaseMs - parsed.todayMs
  return diff > 0 && diff <= NEAR_RELEASE_WINDOW_MS
}

export function isMetadataStale(entry: LibraryEntry, nowMs: number = Date.now()): boolean {
  if (entry.rawg_metadata_synced_at == null) return true

  const syncedAt = new Date(entry.rawg_metadata_synced_at).getTime()
  if (Number.isNaN(syncedAt)) return true

  const staleMs = isNearRelease(entry.release_date, new Date(nowMs))
    ? NEAR_RELEASE_METADATA_STALE_MS
    : DEFAULT_METADATA_STALE_MS

  return nowMs - syncedAt >= staleMs
}

export function shouldRefreshMutableRawgMetadata(
  entry: LibraryEntry,
  nowMs: number = Date.now(),
): boolean {
  if (entry.release_date != null && !isFutureRelease(entry.release_date, new Date(nowMs))) {
    return false
  }
  return isMetadataStale(entry, nowMs)
}

export function selectEntriesToRefresh(
  entries: LibraryEntry[],
  nowMs: number = Date.now(),
): LibraryEntry[] {
  return entries
    .filter(entry => shouldRefreshMutableRawgMetadata(entry, nowMs))
    .sort((a, b) => statusPriority(a) - statusPriority(b))
}

function statusPriority(entry: LibraryEntry): number {
  return entry.status === 'want_to_play' ? 0 : 1
}

export type MetadataPersistenceOutcome =
  | { outcome: 'updated' }
  | { outcome: 'missing' }
  | { outcome: 'error'; message: string }

export function classifyMetadataPersistence(result: {
  data: { id: string } | null
  error: { message: string } | null
}): MetadataPersistenceOutcome {
  if (result.error != null) return { outcome: 'error', message: result.error.message }
  if (result.data == null) return { outcome: 'missing' }
  return { outcome: 'updated' }
}
