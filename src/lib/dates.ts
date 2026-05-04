/** Formats a `YYYY-MM-DD` (or date prefix) value for display as DD/MM/YYYY. */
export function formatDateUk(iso: string): string {
  if (!iso || iso.length < 10) return '—'
  const y = iso.slice(0, 4)
  const m = iso.slice(5, 7)
  const day = iso.slice(8, 10)
  if (!y || !m || !day) return '—'
  return `${day}/${m}/${y}`
}
