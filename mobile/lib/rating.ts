export function formatRatingCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return count.toString()
}
