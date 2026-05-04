import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useCrmStats } from '../hooks/useCrmStats'
import { EnquiryDetailModal } from '../components/EnquiryDetailModal'
import {
  dueDayBucket,
  formatFollowUpDueDateUk,
} from '../lib/followUpDates'
import {
  timelineGroup,
  timelineGroupLabel,
  timelineGroupSortOrder,
  timelineItemBorderClass,
  type TimelineGroupId,
} from '../lib/followUpTimeline'
import { compareFollowUpsDisplay } from '../lib/followUpPriority'
import type { Enquiry, FollowUp } from '../types/crm'
import { FollowUpPriorityBadge } from '../components/FollowUpPriorityBadge'

type Row = FollowUp & {
  enquiries: Pick<Enquiry, 'id' | 'contact_name' | 'company'> | null
}

const VIEW_STORAGE_KEY = 'flowop_crm_followups_view'

type ViewMode = 'list' | 'timeline'

function readStoredView(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY)
    if (v === 'timeline' || v === 'list') return v
  } catch {
    /* ignore */
  }
  return 'list'
}

function rowTone(bucket: ReturnType<typeof dueDayBucket>): string {
  switch (bucket) {
    case 'overdue':
      return 'border-red-500/35 bg-red-950/25 text-red-100'
    case 'today':
      return 'border-amber-500/35 bg-amber-950/20 text-amber-50'
    default:
      return 'border-white/10 bg-flowop-navy-light/40 text-white'
  }
}

function enquiryDisplayName(r: Row): { nameLine: string; companyLine: string } {
  const en = r.enquiries
  const nameLine = en?.contact_name?.trim()
    ? en.contact_name
    : r.contact_name?.trim() || '—'
  const companyLine = en?.company?.trim() ?? ''
  return { nameLine, companyLine }
}

export function FollowUpsPage() {
  const { user } = useAuth()
  const { refresh: refreshStats } = useCrmStats()
  const location = useLocation()
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailEnquiry, setDetailEnquiry] = useState<Enquiry | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(() => readStoredView())

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    const { data, error: e } = await supabase
      .from('follow_ups')
      .select(
        'id, user_id, enquiry_id, contact_name, due_at, action_text, notes, priority, is_done, created_at, updated_at, enquiries ( id, contact_name, company )'
      )
      .eq('is_done', false)

    setLoading(false)
    if (e) {
      setError(e.message)
      return
    }
    const rawList = (data ?? []) as Record<string, unknown>[]
    const normalized: Row[] = rawList.map((raw) => {
      const en = raw.enquiries
      const enquiries = Array.isArray(en)
        ? ((en[0] as Row['enquiries']) ?? null)
        : ((en as Row['enquiries']) ?? null)
      return { ...raw, enquiries } as Row
    })
    normalized.sort(compareFollowUpsDisplay)
    setRows(normalized)
  }, [user])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Supabase fetch when user is known
    void load()
  }, [load])

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewMode)
    } catch {
      /* ignore */
    }
  }, [viewMode])

  /* eslint-disable react-hooks/set-state-in-effect -- apply one-shot deep link from alert banner */
  useEffect(() => {
    const st = location.state as { followUpsView?: string } | null
    if (st?.followUpsView === 'timeline') {
      setViewMode('timeline')
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, navigate])
  /* eslint-enable react-hooks/set-state-in-effect */

  const timelineSections = useMemo(() => {
    const map = new Map<TimelineGroupId, Row[]>()
    for (const r of rows) {
      const g = timelineGroup(r.due_at)
      const list = map.get(g) ?? []
      list.push(r)
      map.set(g, list)
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
      )
    }
    return map
  }, [rows])

  async function openEnquiryModal(enquiryId: string) {
    setDetailLoading(true)
    const { data, error: fetchError } = await supabase
      .from('enquiries')
      .select('*')
      .eq('id', enquiryId)
      .single()
    setDetailLoading(false)
    if (fetchError || !data) {
      setError(fetchError?.message ?? 'Could not load enquiry.')
      return
    }
    setDetailEnquiry(data as Enquiry)
  }

  function closeDetail() {
    setDetailEnquiry(null)
  }

  async function markDone(id: string) {
    setError(null)
    const { error: upErr } = await supabase
      .from('follow_ups')
      .update({ is_done: true })
      .eq('id', id)
    if (upErr) {
      setError(upErr.message)
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== id))
    void refreshStats()
  }

  const toggleClass = (active: boolean) =>
    [
      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
      active
        ? 'bg-flowop-green text-white'
        : 'text-slate-400 hover:text-white',
    ].join(' ')

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Follow-ups</h1>
          <p className="mt-1 text-sm text-slate-400">
            {viewMode === 'list'
              ? 'Open follow-ups: overdue first, then by priority (high to low), then by due date.'
              : 'Open follow-ups on a timeline by due date — click a row to open the enquiry.'}
          </p>
        </div>
        <div
          className="flex shrink-0 items-center gap-0.5 rounded-lg border border-white/10 bg-flowop-navy-light/50 p-0.5"
          role="group"
          aria-label="View mode"
        >
          <button
            type="button"
            className={toggleClass(viewMode === 'list')}
            onClick={() => setViewMode('list')}
          >
            List
          </button>
          <button
            type="button"
            className={toggleClass(viewMode === 'timeline')}
            onClick={() => setViewMode('timeline')}
          >
            Timeline
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 py-16 text-center text-sm text-slate-500">
          No open follow-ups.
        </div>
      ) : viewMode === 'list' ? (
        <div className="flex w-full min-w-0 flex-col gap-2">
          {rows.map((r) => {
            const bucket = dueDayBucket(r.due_at)
            const { nameLine, companyLine } = enquiryDisplayName(r)

            return (
              <div
                key={r.id}
                className={`flex w-full min-w-0 flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 ${rowTone(bucket)}`}
              >
                <div className="grid min-w-0 flex-1 grid-cols-1 items-start gap-2 lg:grid-cols-4 lg:gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className={`text-sm font-medium tabular-nums ${
                        bucket === 'overdue'
                          ? 'text-red-200'
                          : bucket === 'today'
                            ? 'text-amber-200'
                            : 'text-slate-200'
                      }`}
                    >
                      {formatFollowUpDueDateUk(r.due_at)}
                    </div>
                    <FollowUpPriorityBadge priority={r.priority} />
                  </div>
                  <p className="min-w-0 text-sm leading-snug">{r.action_text}</p>
                  <div className="min-w-0 text-sm">
                    <button
                      type="button"
                      disabled={detailLoading}
                      onClick={() => void openEnquiryModal(r.enquiry_id)}
                      className="text-left font-medium text-flowop-green hover:text-flowop-green-hover hover:underline disabled:opacity-50"
                    >
                      {nameLine}
                      {companyLine ? (
                        <span className="font-normal text-slate-400">
                          {' '}
                          ({companyLine})
                        </span>
                      ) : null}
                    </button>
                  </div>
                  <p className="min-w-0 text-sm leading-snug text-slate-400">
                    {r.notes?.trim() ? r.notes : '—'}
                  </p>
                </div>
                <div className="flex shrink-0 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => void markDone(r.id)}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-flowop-green/50 hover:text-white"
                  >
                    Mark as done
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="relative pl-2">
          <div
            className="absolute bottom-0 left-[11px] top-0 w-px bg-white/10"
            aria-hidden
          />
          <div className="space-y-6">
            {timelineGroupSortOrder().map((groupId) => {
              const groupRows = timelineSections.get(groupId)
              if (!groupRows?.length) return null
              return (
                <div key={groupId}>
                  <h2 className="mb-2.5 pl-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {timelineGroupLabel(groupId)}
                  </h2>
                  <ul className="space-y-2">
                    {groupRows.map((r) => {
                      const { nameLine, companyLine } = enquiryDisplayName(r)
                      const border = timelineItemBorderClass(groupId)
                      return (
                        <li
                          key={r.id}
                          className="relative pl-5"
                        >
                          <div
                            className={`flex min-w-0 flex-col gap-2 rounded-lg border border-white/10 bg-flowop-navy-light/40 py-2.5 pl-3 pr-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${border}`}
                          >
                            <button
                              type="button"
                              disabled={detailLoading}
                              onClick={() => void openEnquiryModal(r.enquiry_id)}
                              className="min-w-0 flex-1 text-left disabled:opacity-50"
                            >
                              <p className="text-sm font-semibold text-white">
                                {nameLine}
                                {companyLine ? (
                                  <span className="font-normal text-slate-400">
                                    {' '}
                                    ({companyLine})
                                  </span>
                                ) : null}
                              </p>
                              <p className="mt-0.5 text-sm leading-snug text-slate-300">
                                {r.action_text}
                              </p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <FollowUpPriorityBadge priority={r.priority} />
                                <span className="text-xs tabular-nums text-slate-500">
                                  Due {formatFollowUpDueDateUk(r.due_at)}
                                </span>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                void markDone(r.id)
                              }}
                              className="shrink-0 self-start rounded border border-white/15 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-flowop-green/50 sm:self-center"
                            >
                              Mark as done
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {detailEnquiry ? (
        <EnquiryDetailModal
          key={detailEnquiry.id}
          enquiry={detailEnquiry}
          onClose={closeDetail}
          onSaved={() => {
            void load()
            void refreshStats()
          }}
          onDeleted={() => {
            void load()
            void refreshStats()
          }}
        />
      ) : null}
    </div>
  )
}
