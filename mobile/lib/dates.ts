export function formatLocalDate(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function addLocalDays(date: Date, days: number): Date {
  const nextDate = new Date(date)
  nextDate.setDate(date.getDate() + days)
  return nextDate
}

export function formatDate(
  date: string,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  },
): string {
  if (date.length < 10) return date

  const parsedDate = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsedDate.getTime())) return date

  return new Intl.DateTimeFormat('en', options).format(parsedDate)
}

function getReleaseDateKey(released: string | null): string | null {
  if (released == null) return null

  const [yearPart, monthPart, dayPart] = released.split('-')
  if (yearPart == null || monthPart == null || dayPart == null) return null

  const year = Number(yearPart)
  const month = Number(monthPart)
  const day = Number(dayPart)
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  return `${yearPart.padStart(4, '0')}-${monthPart.padStart(2, '0')}-${dayPart.padStart(2, '0')}`
}

export function isUpcomingRelease(released: string | null): boolean {
  if (released == null) return true

  const releaseKey = getReleaseDateKey(released)
  if (releaseKey == null) return false
  const todayKey = formatLocalDate(new Date())

  return releaseKey > todayKey
}

export function isKnownUpcomingRelease(released: string | null): released is string {
  return released != null && isUpcomingRelease(released)
}

export function isKnownReleased(released: string | null): released is string {
  const releaseKey = getReleaseDateKey(released)
  if (releaseKey == null) return false

  return releaseKey <= formatLocalDate(new Date())
}

export function formatPubDate(
  pubDate: string | null,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
): string {
  if (!pubDate) return ''
  const date = new Date(pubDate)
  if (isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en', options).format(date)
}
