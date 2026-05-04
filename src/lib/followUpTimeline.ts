import { dueDayBucket } from './followUpDates'

export type TimelineGroupId =
  | 'overdue'
  | 'today'
  | 'this_week'
  | 'next_week'
  | 'later'

const GROUP_ORDER: TimelineGroupId[] = [
  'overdue',
  'today',
  'this_week',
  'next_week',
  'later',
]

const GROUP_LABEL: Record<TimelineGroupId, string> = {
  overdue: 'Overdue',
  today: 'Today',
  this_week: 'This week',
  next_week: 'Next week',
  later: 'Later',
}

export function timelineGroupLabel(id: TimelineGroupId): string {
  return GROUP_LABEL[id]
}

export function timelineGroupSortOrder(): TimelineGroupId[] {
  return [...GROUP_ORDER]
}

function startOfDayLocal(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Monday 00:00 local of the week containing `date`. */
function mondayOfWeekContaining(date: Date): Date {
  const d = startOfDayLocal(date)
  const day = d.getDay()
  const offsetFromMon = day === 0 ? -6 : 1 - day
  return addDays(d, offsetFromMon)
}

/**
 * Classify an open follow-up for timeline sections (after overdue/today checks).
 * Uses week boundaries: Mon–Sun, "this week" = rest of current week after today.
 */
export function timelineGroup(dueAtIso: string): TimelineGroupId {
  const due = new Date(dueAtIso)
  const bucket = dueDayBucket(dueAtIso)
  if (bucket === 'overdue') return 'overdue'
  if (bucket === 'today') return 'today'

  const now = new Date()
  const startToday = startOfDayLocal(now)
  const endToday = addDays(startToday, 1)
  const thisMonday = mondayOfWeekContaining(now)
  const nextMonday = addDays(thisMonday, 7)
  const mondayAfterNext = addDays(thisMonday, 14)

  if (due >= endToday && due < nextMonday) return 'this_week'
  if (due >= nextMonday && due < mondayAfterNext) return 'next_week'
  return 'later'
}

/** Left border accent for timeline cards (not the Overdue section heading). */
export function timelineItemBorderClass(group: TimelineGroupId): string {
  switch (group) {
    case 'overdue':
      return 'border-l-[3px] border-l-red-500'
    case 'today':
      return 'border-l-[3px] border-l-amber-500'
    default:
      return 'border-l-[3px] border-l-flowop-green'
  }
}
