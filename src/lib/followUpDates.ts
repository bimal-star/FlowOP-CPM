/** DD/MM/YYYY from an ISO timestamptz string. */
export function formatFollowUpDueDateUk(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export type DueDayBucket = 'overdue' | 'today' | 'upcoming'

/** Classify follow-up due time relative to local calendar days. */
export function dueDayBucket(dueAtIso: string): DueDayBucket {
  const due = new Date(dueAtIso)
  const now = new Date()
  const startToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  )
  const endToday = new Date(startToday)
  endToday.setDate(endToday.getDate() + 1)

  if (due < startToday) return 'overdue'
  if (due >= startToday && due < endToday) return 'today'
  return 'upcoming'
}

/** Start of local today as ISO string for Supabase filters. */
export function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/** Start of local tomorrow (exclusive end of “today” window) for Supabase filters. */
export function startOfTomorrowIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 1)
  return d.toISOString()
}

/** Local date input (YYYY-MM-DD) → ISO timestamptz (09:00 local). */
export function localDateInputToDueIso(dateStr: string): string {
  const [y, m, day] = dateStr.split('-').map(Number)
  if (!y || !m || !day) return new Date().toISOString()
  const dt = new Date(y, m - 1, day, 9, 0, 0, 0)
  return dt.toISOString()
}
