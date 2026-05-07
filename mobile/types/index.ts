export type LibraryStatus =
  | 'want_to_play'
  | 'playing'
  | 'done'
  | 'did_not_finish'

export const STATUS_LABELS: Record<LibraryStatus, string> = {
  want_to_play:   'Wanted',
  playing:        'Playing',
  done:           'Done',
  did_not_finish: 'Did Not Finish',
}

export const STATUS_COLORS: Record<LibraryStatus, string> = {
  want_to_play:   '#7ba7ff',   // soft steel blue, queued/wanted
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
