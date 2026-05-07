export type LibraryStatus =
  | 'want_to_play'
  | 'playing'
  | 'done'
  | 'did_not_finish'

export const STATUS_LABELS: Record<LibraryStatus, string> = {
  want_to_play:   'Want to Play',
  playing:        'Playing',
  done:           'Done',
  did_not_finish: 'Did Not Finish',
}

export const STATUS_COLORS: Record<LibraryStatus, string> = {
  want_to_play:   '#a8acb3',   // textSecondary, neutral/queued
  playing:        '#05b169',   // success / semantic up
  done:           '#f4b000',   // amber / gold
  did_not_finish: '#6b7178',   // textMuted, deprioritized
}

export type LibrarySortKey = 'recent' | 'title' | 'rating' | 'playtime' | 'custom'

export const LIBRARY_SORT_KEYS: LibrarySortKey[] = [
  'recent',
  'title',
  'rating',
  'playtime',
  'custom',
]
