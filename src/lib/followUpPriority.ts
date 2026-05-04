import type { DueDayBucket } from './followUpDates'
import { dueDayBucket } from './followUpDates'
import type { FollowUp, FollowUpPriority } from '../types/crm'

export function normalizeFollowUpPriority(
  p: string | null | undefined
): FollowUpPriority {
  if (p === 'high' || p === 'medium' || p === 'low') return p
  return 'medium'
}

/** Lower sort index = higher urgency (high first). */
export function followUpPriorityRank(p: FollowUpPriority): number {
  switch (p) {
    case 'high':
      return 0
    case 'medium':
      return 1
    case 'low':
      return 2
    default:
      return 1
  }
}

export function dueBucketSortOrder(b: DueDayBucket): number {
  if (b === 'overdue') return 0
  if (b === 'today') return 1
  return 2
}

/** Global list: overdue first, then priority (high→low), then due_at ascending. */
export function compareFollowUpsDisplay(a: FollowUp, b: FollowUp): number {
  const ba = dueDayBucket(a.due_at)
  const bb = dueDayBucket(b.due_at)
  const bucketCmp = dueBucketSortOrder(ba) - dueBucketSortOrder(bb)
  if (bucketCmp !== 0) return bucketCmp
  const pa = normalizeFollowUpPriority(a.priority)
  const pb = normalizeFollowUpPriority(b.priority)
  const priCmp =
    followUpPriorityRank(pa) - followUpPriorityRank(pb)
  if (priCmp !== 0) return priCmp
  return new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
}

export function followUpPriorityLabel(p: FollowUpPriority): string {
  switch (p) {
    case 'high':
      return 'High'
    case 'medium':
      return 'Medium'
    case 'low':
      return 'Low'
    default:
      return 'Medium'
  }
}

export function followUpPriorityBadgeClass(p: FollowUpPriority): string {
  switch (p) {
    case 'high':
      return 'border-red-500/45 bg-red-950/45 text-red-200'
    case 'medium':
      return 'border-amber-500/40 bg-amber-950/35 text-amber-200'
    case 'low':
      return 'border-slate-500/45 bg-slate-800/70 text-slate-300'
    default:
      return 'border-amber-500/40 bg-amber-950/35 text-amber-200'
  }
}
