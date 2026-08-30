import { useMemo } from 'react'
import type { PipelineStageRow, StageHistoryRow } from '../types/crm'

function formatStageDateUk(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

type Props = {
  stages: PipelineStageRow[]
  currentStage: string
  stageHistory: StageHistoryRow[]
  loading?: boolean
  error?: string | null
}

export function EnquiryStageHistoryTrack({
  stages,
  currentStage,
  stageHistory,
  loading = false,
  error = null,
}: Props) {
  const currentIndex = useMemo(() => {
    const i = stages.findIndex((s) => s.name === currentStage)
    return i >= 0 ? i : 0
  }, [stages, currentStage])

  const currentEnteredAt = useMemo(() => {
    const rows = stageHistory.filter((h) => h.to_stage === currentStage)
    const last = rows[rows.length - 1]
    return last?.changed_at ?? null
  }, [stageHistory, currentStage])

  if (loading) {
    return (
      <div className="w-full min-w-0">
        <p className="mb-2 text-xs font-medium text-slate-400">Stage history</p>
        <p className="text-xs text-slate-500" aria-live="polite">
          Loading stage history…
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full min-w-0">
        <p className="mb-2 text-xs font-medium text-slate-400">Stage history</p>
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      </div>
    )
  }

  if (stages.length === 0) {
    return (
      <div className="w-full min-w-0">
        <p className="mb-2 text-xs font-medium text-slate-400">Stage history</p>
        <p className="text-xs text-slate-500">No pipeline stages configured.</p>
      </div>
    )
  }

  return (
    <div
      className="w-full min-w-0"
      role="group"
      aria-label="Stage history pipeline track"
    >
      <p className="mb-2 text-xs font-medium text-slate-400">Stage history</p>
      <ol className="flex w-full list-none items-start p-0">
        {stages.map((stage, index) => {
          const visited = index <= currentIndex
          const isCurrent = index === currentIndex
          const isLast = index === stages.length - 1
          const leftLineActive = index > 0 && index <= currentIndex
          const rightLineActive = !isLast && index < currentIndex

          return (
            <li
              key={stage.id}
              className="flex min-w-0 flex-1 flex-col items-center"
              aria-current={isCurrent ? 'step' : undefined}
            >
              <div className="flex h-5 w-full items-center">
                <div
                  className="h-1 min-w-0 flex-1"
                  style={{
                    backgroundColor: leftLineActive
                      ? stages[index - 1]?.colour ?? 'rgb(255 255 255 / 0.1)'
                      : 'rgb(255 255 255 / 0.1)',
                    opacity: leftLineActive ? 0.85 : 0.4,
                  }}
                  aria-hidden
                />
                <div
                  className="mx-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
                  style={{
                    borderColor: visited ? stage.colour : 'rgb(255 255 255 / 0.15)',
                    backgroundColor: visited ? stage.colour : 'transparent',
                    opacity: visited ? 1 : 0.35,
                    boxShadow: isCurrent
                      ? `0 0 0 1.5px rgb(30 41 59), 0 0 0 3.5px ${stage.colour}`
                      : undefined,
                  }}
                  title={stage.label}
                />
                <div
                  className="h-1 min-w-0 flex-1"
                  style={{
                    backgroundColor: rightLineActive
                      ? stage.colour
                      : 'rgb(255 255 255 / 0.1)',
                    opacity: rightLineActive ? 0.85 : 0.4,
                  }}
                  aria-hidden
                />
              </div>
              <span
                className={`mt-2 w-full px-1 text-center text-sm leading-snug ${
                  isCurrent ? 'font-medium text-white' : 'text-slate-500'
                }`}
              >
                {stage.label}
              </span>
              {isCurrent && currentEnteredAt ? (
                <span className="mt-1.5 text-xs leading-snug tabular-nums text-slate-500">
                  {formatStageDateUk(currentEnteredAt)}
                </span>
              ) : (
                <span className="mt-1.5 h-3 leading-snug" aria-hidden />
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
