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

export function isUpcomingRelease(released: string | null): boolean {
  if (released == null) return true

  const [yearPart, monthPart, dayPart] = released.split('-')
  if (yearPart == null || monthPart == null || dayPart == null) return false

  const year = Number(yearPart)
  const month = Number(monthPart)
  const day = Number(dayPart)
  if (isNaN(year) || isNaN(month) || isNaN(day)) return false
  if (month < 1 || month > 12 || day < 1 || day > 31) return false

  const todayKey = formatLocalDate(new Date())
  const releaseKey = `${yearPart.padStart(4, '0')}-${monthPart.padStart(2, '0')}-${dayPart.padStart(2, '0')}`

  return releaseKey > todayKey
}

export function isKnownUpcomingRelease(released: string | null): released is string {
  return released != null && isUpcomingRelease(released)
}
