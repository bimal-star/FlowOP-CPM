import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { formatDateUk } from '../lib/dates'
import { formatStageHistoryLine } from '../lib/stageHistory'
import { useCrmStats } from '../hooks/useCrmStats'
import { useAuth } from '../hooks/useAuth'
import { DashboardSummaryBar } from '../components/DashboardSummaryBar'
import { usePipelineStages } from '../contexts/PipelineStagesContext'
import { stageBadgeInlineStyle } from '../lib/hexColor'
import { EnquiryDetailModal } from '../components/EnquiryDetailModal'
import { ExpandableFormTextarea } from '../components/ExpandableFormTextarea'
import type {
  Enquiry,
  EnquiryStage,
  EnquiryWithHistory,
  StageHistoryRow,
} from '../types/crm'

function todayIsoDate(): string {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function getInitialForm(defaultStage: string) {
  return {
    contact_name: '',
    company: '',
    email: '',
    source: '',
    query_summary: '',
    stage: defaultStage as EnquiryStage,
    next_action: '',
    notes: '',
    date_received: todayIsoDate(),
  }
}

const fieldLabel = 'text-xs font-medium text-slate-400'
const inputClass =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-flowop-navy px-3 py-2.5 text-sm text-white outline-none transition-shadow focus:ring-2 focus:ring-flowop-green'

function historyList(h: EnquiryWithHistory): StageHistoryRow[] {
  const raw = h.stage_history
  if (!raw) return []
  return Array.isArray(raw) ? raw : []
}

function latestStageDateLine(
  r: Enquiry,
  history: StageHistoryRow[]
): string {
  if (history.length === 0) {
    return formatDateUk(r.date_received ?? '')
  }
  const sorted = [...history].sort(
    (a, b) =>
      new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
  )
  const last = sorted[sorted.length - 1]
  return formatDateUk(last.changed_at.slice(0, 10))
}

function EnquiryCardStageColumn({
  r,
  history,
}: {
  r: Enquiry
  history: StageHistoryRow[]
}) {
  const { labelFor, metaFor } = usePipelineStages()
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 240 })
  const closeT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const sorted = [...history].sort(
    (a, b) =>
      new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
  )
  const hasHistory = sorted.length > 0
  const dateLine = latestStageDateLine(r, sorted)

  const movePanel = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const w = 240
    setCoords({
      top: rect.bottom + 6,
      left: Math.min(window.innerWidth - w - 8, Math.max(8, rect.right - w)),
      width: w,
    })
  }, [])

  const cancelClose = useCallback(() => {
    if (closeT.current) {
      clearTimeout(closeT.current)
      closeT.current = null
    }
  }, [])

  const scheduleClose = useCallback(() => {
    closeT.current = setTimeout(() => setOpen(false), 200)
  }, [])

  const openPanel = useCallback(() => {
    cancelClose()
    if (!hasHistory) return
    movePanel()
    setOpen(true)
  }, [cancelClose, hasHistory, movePanel])

  useEffect(() => {
    return () => {
      if (closeT.current) clearTimeout(closeT.current)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onScroll = () => movePanel()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, movePanel])

  return (
    <div
      ref={wrapRef}
      className="relative shrink-0 text-right"
      onMouseEnter={openPanel}
      onMouseLeave={scheduleClose}
    >
      <div className="flex flex-col items-end gap-1">
        <span
          className="inline-flex max-w-[min(100%,10rem)] truncate rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none"
          style={stageBadgeInlineStyle(metaFor(r.stage)?.colour)}
        >
          {labelFor(r.stage)}
        </span>
        <p className="text-[11px] tabular-nums text-slate-500">{dateLine}</p>
      </div>
      {open && hasHistory
        ? createPortal(
            <div
              className="z-[100] rounded-lg border border-white/15 bg-flowop-navy p-2.5 text-left shadow-xl"
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                width: coords.width,
                maxHeight: 'min(50vh, 320px)',
                overflowY: 'auto',
              }}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            >
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Stage history
              </p>
              <ul className="space-y-1.5">
                {sorted.map((h) => (
                  <li
                    key={h.id}
                    className="border-b border-white/5 pb-1.5 text-xs leading-snug text-slate-300 last:border-0 last:pb-0"
                  >
                    {formatStageHistoryLine(
                      h.from_stage,
                      h.to_stage,
                      h.changed_at,
                      labelFor
                    )}
                  </li>
                ))}
              </ul>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}

export function EnquiryLogPage() {
  const { user } = useAuth()
  const { stages, loading: pipelineStagesLoading } = usePipelineStages()
  const { refresh: refreshStats } = useCrmStats()
  const [rows, setRows] = useState<EnquiryWithHistory[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form, setForm] = useState(() => getInitialForm(''))
  const [saving, setSaving] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const stageSelectOptions = useMemo(
    () => stages.map((s) => ({ name: s.name, label: s.label })),
    [stages]
  )

  /* eslint-disable react-hooks/set-state-in-effect -- align default stage when pipeline config loads */
  useEffect(() => {
    if (stages.length === 0) return
    const valid = new Set(stages.map((s) => s.name))
    setForm((f) => (valid.has(f.stage) ? f : { ...f, stage: stages[0].name }))
  }, [stages])
  /* eslint-enable react-hooks/set-state-in-effect */

  const load = useCallback(async () => {
    if (!user) return
    setLoadError(null)

    const { data: enquiries, error: enquiriesError } = await supabase
      .from('enquiries')
      .select('*')
      .order('created_at', { ascending: false })

    if (enquiriesError) {
      setLoadError(enquiriesError.message)
      return
    }

    if (!enquiries?.length) {
      setRows([])
      return
    }

    const ids = enquiries.map((e) => e.id)

    const { data: historyRows, error: historyError } = await supabase
      .from('stage_history')
      .select('id, enquiry_id, user_id, from_stage, to_stage, changed_at')
      .in('enquiry_id', ids)

    if (historyError) {
      setLoadError(
        `Enquiries loaded, but stage history could not be loaded: ${historyError.message}`
      )
    }

    const byEnquiry = new Map<string, StageHistoryRow[]>()
    for (const h of historyRows ?? []) {
      const rid = h.enquiry_id as string
      const row: StageHistoryRow = {
        id: h.id as string,
        enquiry_id: rid,
        user_id: h.user_id as string,
        from_stage: h.from_stage as EnquiryStage | null,
        to_stage: h.to_stage as EnquiryStage,
        changed_at: h.changed_at as string,
      }
      const list = byEnquiry.get(rid) ?? []
      list.push(row)
      byEnquiry.set(rid, list)
    }

    const merged: EnquiryWithHistory[] = enquiries.map((en) => ({
      ...(en as Enquiry),
      stage_history: byEnquiry.get(en.id) ?? [],
    }))

    setRows(merged)
  }, [user])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Supabase fetch when user is known
    void load()
  }, [load])

  async function addEnquiry(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (stages.length === 0) {
      setLoadError('Pipeline stages are still loading. Please wait a moment.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('enquiries').insert({
      user_id: user.id,
      contact_name: form.contact_name.trim(),
      company: form.company.trim() || null,
      email: form.email.trim() || null,
      source: form.source.trim() || null,
      query_summary: form.query_summary.trim() || null,
      stage: form.stage,
      next_action: form.next_action.trim() || null,
      notes: form.notes.trim() || null,
      date_received: form.date_received.slice(0, 10),
    })
    setSaving(false)
    if (error) {
      setLoadError(error.message)
      return
    }
    setForm(getInitialForm(stages[0]?.name ?? ''))
    void load()
    void refreshStats()
  }

  function openDetail(r: EnquiryWithHistory) {
    setDetailId(r.id)
  }

  function closeDetail() {
    setDetailId(null)
  }

  const detailEnquiry =
    detailId !== null
      ? (rows.find((r) => r.id === detailId) ?? null)
      : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:gap-5">
      <header className="shrink-0 space-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-white">
          Enquiry log
        </h1>
        <p className="text-sm leading-snug text-slate-400">
          Capture leads, update pipeline stage, and keep next actions visible.
        </p>
      </header>

      <DashboardSummaryBar />

      {loadError ? (
        <p className="shrink-0 text-sm text-red-400" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-x-8 lg:gap-y-4 lg:max-h-[calc(100dvh-11.5rem)]">
        {/* All enquiries — 40% (2/5); mobile: second (below form) */}
        <section
          className="order-2 flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-flowop-navy-light/50 lg:order-1 lg:col-span-2 lg:h-full lg:max-h-full"
          aria-labelledby="all-enquiries-heading"
        >
          <div className="shrink-0 border-b border-white/10 px-5 py-3 sm:px-6 sm:py-4">
            <h2
              id="all-enquiries-heading"
              className="text-sm font-semibold tracking-wide text-slate-100"
            >
              All enquiries
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {rows.length === 1
                ? '1 record'
                : `${rows.length} records`}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3 sm:px-6 sm:py-4">
            <ul className="space-y-2 pb-1">
              {rows.length === 0 ? (
                <li className="rounded-lg border border-dashed border-white/15 px-4 py-12 text-center text-sm leading-relaxed text-slate-500">
                  No enquiries yet. Use the new enquiry form to add one.
                </li>
              ) : (
                rows.map((r) => (
                  <li key={r.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openDetail(r)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openDetail(r)
                        }
                      }}
                      className="flex w-full cursor-pointer items-start justify-between gap-3 rounded-lg border border-white/10 bg-flowop-navy-light/40 px-3 py-2.5 text-left transition-colors hover:border-flowop-green/35 hover:bg-flowop-navy-light/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-flowop-green"
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-sm font-semibold text-white"
                          title={
                            r.company?.trim()
                              ? `${r.contact_name} (${r.company.trim()})`
                              : r.contact_name
                          }
                        >
                          {r.contact_name}
                          {r.company?.trim()
                            ? ` (${r.company.trim()})`
                            : ''}
                        </p>
                        <p
                          className="mt-1.5 truncate text-xs italic leading-snug text-slate-400"
                          title={r.next_action ?? undefined}
                        >
                          {r.next_action?.trim() ? r.next_action : '—'}
                        </p>
                      </div>
                      <EnquiryCardStageColumn
                        r={r}
                        history={historyList(r)}
                      />
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>

        {/* New enquiry — 60% (3/5); mobile: first (on top) */}
        <section
          className="order-1 flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-flowop-navy-light/50 lg:order-2 lg:col-span-3 lg:h-full lg:max-h-full"
          aria-labelledby="new-enquiry-heading"
        >
          <div className="shrink-0 border-b border-white/10 px-5 py-3 sm:px-6 sm:py-4">
            <h2
              id="new-enquiry-heading"
              className="text-sm font-semibold tracking-wide text-slate-100"
            >
              New enquiry
            </h2>
            <button
              type="submit"
              form="new-enquiry-form"
              disabled={saving || pipelineStagesLoading || stages.length === 0}
              className="mt-3 rounded-lg bg-flowop-green px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-flowop-green-hover disabled:opacity-50"
            >
              {pipelineStagesLoading ? 'Loading stages…' : saving ? 'Saving…' : 'Save enquiry'}
            </button>
            <p className="mt-3 text-xs text-slate-500">
              Add a lead; it appears in the list and pipeline.
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3 sm:px-6 sm:py-4">
            <form
              id="new-enquiry-form"
              onSubmit={(e) => void addEnquiry(e)}
              className="grid max-w-full grid-cols-1 gap-2.5 pb-1 sm:grid-cols-3 sm:pb-2"
            >
              <label className="block min-w-0">
                <span className={fieldLabel}>Name</span>
                <input
                  required
                  value={form.contact_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contact_name: e.target.value }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="block min-w-0">
                <span className={fieldLabel}>Company</span>
                <input
                  value={form.company}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, company: e.target.value }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="block min-w-0">
                <span className={fieldLabel}>Source</span>
                <input
                  value={form.source}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, source: e.target.value }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="block min-w-0">
                <span className={fieldLabel}>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="block min-w-0">
                <span className={fieldLabel}>Stage</span>
                <select
                  value={form.stage}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      stage: e.target.value as EnquiryStage,
                    }))
                  }
                  className={inputClass}
                >
                  {stageSelectOptions.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block min-w-0">
                <span className={fieldLabel}>Date received</span>
                <input
                  type="date"
                  value={form.date_received.slice(0, 10)}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      date_received: e.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <ExpandableFormTextarea
                label="Query summary"
                value={form.query_summary}
                onChange={(next) =>
                  setForm((f) => ({ ...f, query_summary: next }))
                }
                collapsedHeightClass="h-[7.5rem] max-h-[7.5rem]"
                colSpanClass="sm:col-span-3"
                inputClassName={inputClass}
              />
              <ExpandableFormTextarea
                label="Notes"
                value={form.notes}
                onChange={(next) => setForm((f) => ({ ...f, notes: next }))}
                collapsedHeightClass="h-[6.5rem] max-h-[6.5rem]"
                colSpanClass="sm:col-span-3"
                inputClassName={inputClass}
              />
              <label className="block min-w-0 sm:col-span-3">
                <span className={fieldLabel}>Next action</span>
                <input
                  value={form.next_action}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, next_action: e.target.value }))
                  }
                  className={inputClass}
                />
              </label>
            </form>
          </div>
        </section>
      </div>

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
