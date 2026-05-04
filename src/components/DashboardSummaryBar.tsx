import { useCrmStats } from '../hooks/useCrmStats'

export function DashboardSummaryBar() {
  const { stats } = useCrmStats()

  const itemClass =
    'flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg border border-white/10 bg-flowop-navy-light/50 px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3 sm:px-4'

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:gap-3"
      aria-label="CPM summary"
    >
      <div className={itemClass}>
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Total enquiries
        </span>
        <span className="text-lg font-semibold tabular-nums text-white sm:text-xl">
          {stats.totalEnquiries}
        </span>
      </div>
      <div className={itemClass}>
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Open follow-ups
        </span>
        <span className="text-lg font-semibold tabular-nums text-white sm:text-xl">
          {stats.openFollowUps}
        </span>
      </div>
      <div className={itemClass}>
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Overdue follow-ups
        </span>
        <span
          className={`text-lg font-semibold tabular-nums sm:text-xl ${
            stats.overdueFollowUps > 0 ? 'text-red-300' : 'text-white'
          }`}
        >
          {stats.overdueFollowUps}
        </span>
      </div>
    </div>
  )
}
