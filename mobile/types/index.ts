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
  want_to_play:   '#7C6AF7',
  playing:        '#4ADE80',
  done:           '#FACC15',
  did_not_finish: '#9896A8',
}
