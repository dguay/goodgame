import type { LibrarySortKey } from '@/types'
import type { LibraryEntry } from '@/types/database'

export type SortDirection = 'asc' | 'desc'

export function sortLibraryEntries(
  entries: LibraryEntry[],
  sort: LibrarySortKey,
  direction: SortDirection,
): LibraryEntry[] {
  const dir = direction === 'asc' ? 1 : -1
  return [...entries].sort((a, b) => {
    switch (sort) {
      case 'recent':
        return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      case 'title':
        return dir * a.game_title.localeCompare(b.game_title)
      case 'rating': {
        const rA = a.personal_rating ?? -1
        const rB = b.personal_rating ?? -1
        return dir * (rA - rB)
      }
      case 'release_date':
        return dir * (getReleaseDateSortValue(a.release_date) - getReleaseDateSortValue(b.release_date))
      case 'finished_at': {
        const dA = a.finished_at != null ? new Date(a.finished_at).getTime() : -1
        const dB = b.finished_at != null ? new Date(b.finished_at).getTime() : -1
        return dir * (dA - dB)
      }
      case 'custom':
        return 0
    }
  })
}

function getReleaseDateSortValue(releaseDate: string | null): number {
  return releaseDate != null ? new Date(releaseDate).getTime() : Number.MAX_SAFE_INTEGER
}
