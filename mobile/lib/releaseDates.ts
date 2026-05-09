export function isUpcomingRelease(released: string | null): boolean {
  if (released == null) return true

  const [yearPart, monthPart, dayPart] = released.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart)
  const day = Number(dayPart)
  if (yearPart == null || monthPart == null || dayPart == null) return false
  if (isNaN(year) || isNaN(month) || isNaN(day)) return false
  if (month < 1 || month > 12 || day < 1 || day > 31) return false

  const today = new Date()
  const todayYear = today.getFullYear().toString().padStart(4, '0')
  const todayMonth = (today.getMonth() + 1).toString().padStart(2, '0')
  const todayDay = today.getDate().toString().padStart(2, '0')
  const todayKey = `${todayYear}-${todayMonth}-${todayDay}`
  const releaseKey = `${yearPart.padStart(4, '0')}-${monthPart.padStart(2, '0')}-${dayPart.padStart(2, '0')}`

  return releaseKey > todayKey
}
