import {
  followUpPriorityBadgeClass,
  followUpPriorityLabel,
  normalizeFollowUpPriority,
} from '../lib/followUpPriority'
import type { FollowUpPriority } from '../types/crm'

export function FollowUpPriorityBadge({
  priority,
  className = '',
}: {
  priority: FollowUpPriority | string | null | undefined
  className?: string
}) {
  const p = normalizeFollowUpPriority(priority)
  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${followUpPriorityBadgeClass(p)} ${className}`}
    >
      {followUpPriorityLabel(p)}
    </span>
  )
}
