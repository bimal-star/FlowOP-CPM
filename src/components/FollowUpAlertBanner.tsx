import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCrmStats } from '../hooks/useCrmStats'

const DISMISS_KEY = 'flowop_followup_alert_dismissed'

export function FollowUpAlertBanner() {
  const { stats } = useCrmStats()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  const { show, variant, message } = useMemo(() => {
    const overdue = stats.overdueFollowUps
    const dueToday = stats.dueTodayFollowUps
    if (overdue > 0) {
      return {
        show: true,
        variant: 'overdue' as const,
        message: `You have ${overdue} overdue follow-up${overdue === 1 ? '' : 's'}.`,
      }
    }
    if (dueToday > 0) {
      return {
        show: true,
        variant: 'dueToday' as const,
        message: `${dueToday} follow-up${dueToday === 1 ? '' : 's'} due today.`,
      }
    }
    return { show: false, variant: 'overdue' as const, message: '' }
  }, [stats.overdueFollowUps, stats.dueTodayFollowUps])

  const active = show && !dismissed

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }, [])

  const review = useCallback(() => {
    navigate('/follow-ups', {
      state: { followUpsView: 'timeline' },
    })
  }, [navigate])

  if (!active) {
    return null
  }

  const barClass =
    variant === 'overdue'
      ? 'border-b border-red-500/35 bg-red-950/45 text-red-100'
      : 'border-b border-amber-500/35 bg-amber-950/35 text-amber-50'

  return (
    <div
      className={`flex shrink-0 items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8 ${barClass}`}
      role="status"
    >
      <p className="min-w-0 flex-1 text-sm leading-snug">
        <span className="font-medium">{message}</span>{' '}
        <button
          type="button"
          onClick={review}
          className="inline font-semibold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"
        >
          Review now →
        </button>
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded p-1 text-current opacity-70 hover:bg-black/20 hover:opacity-100"
        aria-label="Dismiss alert"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5"
          aria-hidden
        >
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </div>
  )
}
