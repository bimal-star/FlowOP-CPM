import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCrmStats } from '../hooks/useCrmStats'
import { usePipelineStages } from '../contexts/PipelineStagesContext'
import { enquiryToDraft, type EnquiryDetailDraft } from '../lib/enquiryDetail'
import { formatStageHistoryLine } from '../lib/stageHistory'
import type { Enquiry, EnquiryStage, StageHistoryRow } from '../types/crm'
import { EnquiryModalFollowUpsTab } from './EnquiryModalFollowUpsTab'
import { ExpandableFormTextarea } from './ExpandableFormTextarea'

const fieldLabel = 'text-xs font-medium text-slate-400'
const inputClassModal =
  'mt-1 w-full rounded-lg border border-white/10 bg-flowop-navy px-2.5 py-2 text-sm text-white outline-none transition-shadow focus:ring-2 focus:ring-flowop-green'

export function EnquiryDetailModal({
  enquiry,
  onClose,
  onSaved,
  onDeleted,
}: {
  enquiry: Enquiry
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}) {
  const [draft, setDraft] = useState<EnquiryDetailDraft>(() =>
    enquiryToDraft(enquiry)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stageHistory, setStageHistory] = useState<StageHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeletedMessage, setShowDeletedMessage] = useState(false)
  const deletedContinueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const { refresh: refreshStats } = useCrmStats()
  const { stages, labelFor } = usePipelineStages()
  const [activeTab, setActiveTab] = useState<'followups' | 'stage'>('followups')

  const stageOptions = useMemo(
    () => stages.map((s) => ({ name: s.name, label: s.label })),
    [stages]
  )

  /** Only `pipeline_stages` names are valid; map legacy/unknown values to the first column. */
  const stageForApi = useMemo(() => {
    if (stages.length === 0) return draft.stage
    const valid = new Set(stages.map((s) => s.name))
    if (valid.has(draft.stage)) return draft.stage
    return stages[0].name
  }, [stages, draft.stage])

  useEffect(() => {
    let cancelled = false
    void supabase
      .from('stage_history')
      .select('id, enquiry_id, user_id, from_stage, to_stage, changed_at')
      .eq('enquiry_id', enquiry.id)
      .order('changed_at', { ascending: true })
      .then(({ data, error: fetchErr }) => {
        if (cancelled) return
        setHistoryLoading(false)
        if (fetchErr) {
          setHistoryError(fetchErr.message)
          setStageHistory([])
          return
        }
        setHistoryError(null)
        setStageHistory((data as StageHistoryRow[]) ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [enquiry.id])

  useEffect(() => {
    return () => {
      if (deletedContinueTimerRef.current) {
        clearTimeout(deletedContinueTimerRef.current)
      }
    }
  }, [])

  const close = useCallback(() => {
    if (deleting || showDeletedMessage) return
    setError(null)
    onClose()
  }, [onClose, deleting, showDeletedMessage])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error: saveErr } = await supabase
      .from('enquiries')
      .update({
        contact_name: draft.contact_name.trim(),
        company: draft.company.trim() || null,
        email: draft.email.trim() || null,
        source: draft.source.trim() || null,
        query_summary: draft.query_summary.trim() || null,
        stage: stageForApi,
        next_action: draft.next_action.trim() || null,
        notes: draft.notes.trim() || null,
        date_received: draft.date_received.slice(0, 10),
      })
      .eq('id', enquiry.id)

    setSaving(false)
    if (saveErr) {
      setError(saveErr.message)
      return
    }
    onSaved()
    close()
  }

  async function handleDelete() {
    if (
      !window.confirm(
        'Are you sure you want to delete this enquiry? This cannot be undone.'
      )
    ) {
      return
    }
    setDeleting(true)
    setError(null)
    const { error: delErr } = await supabase
      .from('enquiries')
      .delete()
      .eq('id', enquiry.id)
    setDeleting(false)
    if (delErr) {
      setError(delErr.message)
      return
    }
    setShowDeletedMessage(true)
    deletedContinueTimerRef.current = window.setTimeout(() => {
      deletedContinueTimerRef.current = null
      onDeleted()
      onClose()
    }, 1500)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enquiry-detail-title"
    >
      <button
        type="button"
        className={`absolute inset-0 bg-black/60 ${
          deleting || showDeletedMessage ? 'pointer-events-none' : ''
        }`}
        aria-label="Close"
        onClick={close}
      />
      <div className="relative z-10 flex min-h-0 w-full max-w-3xl max-h-[min(88dvh,680px)] flex-col overflow-hidden rounded-lg border border-white/10 bg-flowop-navy-light shadow-xl">
        <div className="shrink-0 border-b border-white/10 px-4 py-2.5 sm:px-5">
          <h3
            id="enquiry-detail-title"
            className="text-sm font-semibold text-white"
          >
            Enquiry details
          </h3>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            Edit and save to update this record.
          </p>
        </div>
        {showDeletedMessage ? (
          <div
            className="shrink-0 border-b border-emerald-500/30 bg-emerald-950/50 px-4 py-3 text-center text-sm font-medium text-emerald-200"
            role="status"
            aria-live="polite"
          >
            Enquiry deleted
          </div>
        ) : null}
        {showDeletedMessage ? (
          <div
            className="min-h-[10rem] flex-1"
            aria-hidden
          />
        ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
            <form
              id="enquiry-detail-form"
              onSubmit={(e) => void save(e)}
              className="grid gap-3 sm:grid-cols-2"
            >
              <label className="block sm:col-span-2">
                <span className={fieldLabel}>Name</span>
                <input
                  required
                  value={draft.contact_name}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, contact_name: e.target.value } : d
                    )
                  }
                  className={inputClassModal}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Company</span>
                <input
                  value={draft.company}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, company: e.target.value } : d
                    )
                  }
                  className={inputClassModal}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Email</span>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, email: e.target.value } : d
                    )
                  }
                  className={inputClassModal}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Source</span>
                <input
                  value={draft.source}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, source: e.target.value } : d
                    )
                  }
                  className={inputClassModal}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Stage</span>
                <select
                  value={stageForApi}
                  onChange={(e) =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            stage: e.target.value as EnquiryStage,
                          }
                        : d
                    )
                  }
                  className={inputClassModal}
                >
                  {stageOptions.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={fieldLabel}>Date received</span>
                <input
                  type="date"
                  value={draft.date_received.slice(0, 10)}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, date_received: e.target.value } : d
                    )
                  }
                  className={inputClassModal}
                />
              </label>
              <ExpandableFormTextarea
                label="Query summary"
                value={draft.query_summary}
                onChange={(next) =>
                  setDraft((d) => (d ? { ...d, query_summary: next } : d))
                }
                collapsedHeightClass="h-[6.25rem] max-h-[6.25rem]"
                inputClassName={inputClassModal}
              />
              <label className="block sm:col-span-2">
                <span className={fieldLabel}>Next action</span>
                <input
                  value={draft.next_action}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, next_action: e.target.value } : d
                    )
                  }
                  className={inputClassModal}
                />
              </label>
              <ExpandableFormTextarea
                label="Notes"
                value={draft.notes}
                onChange={(next) =>
                  setDraft((d) => (d ? { ...d, notes: next } : d))
                }
                collapsedHeightClass="h-[5rem] max-h-[5rem]"
                inputClassName={inputClassModal}
              />
            </form>

            <div
              className="mt-6 flex gap-1 rounded-lg border border-white/10 p-0.5"
              role="tablist"
              aria-label="Enquiry detail sections"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'followups'}
                className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
                  activeTab === 'followups'
                    ? 'bg-flowop-green text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => setActiveTab('followups')}
              >
                Follow-ups
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'stage'}
                className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
                  activeTab === 'stage'
                    ? 'bg-flowop-green text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => setActiveTab('stage')}
              >
                Stage history
              </button>
            </div>

            <div className="mt-4" role="tabpanel">
              {activeTab === 'followups' ? (
                <EnquiryModalFollowUpsTab
                  key={enquiry.id}
                  enquiryId={enquiry.id}
                  onMutate={() => void refreshStats()}
                />
              ) : (
                <section aria-labelledby="stage-history-heading">
                  <h4
                    id="stage-history-heading"
                    className="sr-only"
                  >
                    Stage history
                  </h4>
                  {historyLoading ? (
                    <p className="text-sm text-slate-500">Loading history…</p>
                  ) : historyError ? (
                    <p className="text-sm text-red-400" role="alert">
                      {historyError}
                    </p>
                  ) : stageHistory.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No stage changes recorded yet.
                    </p>
                  ) : (
                    <ol className="list-decimal space-y-2.5 pl-4 text-sm text-slate-300">
                      {stageHistory.map((row) => (
                        <li key={row.id} className="pl-1 leading-snug">
                          {formatStageHistoryLine(
                            row.from_stage,
                            row.to_stage,
                            row.changed_at,
                            labelFor
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              )}
            </div>

            {error ? (
              <p className="mt-3 text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-white/10 px-4 py-2.5 sm:px-5">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-300 hover:border-white/25 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="enquiry-detail-form"
              disabled={saving || deleting}
              className="rounded-lg bg-flowop-green px-3 py-1.5 text-sm font-medium text-white hover:bg-flowop-green-hover disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
          <div className="shrink-0 border-t border-white/10 px-4 py-2.5 sm:px-5">
            <button
              type="button"
              disabled={deleting || saving}
              onClick={() => void handleDelete()}
              className="w-full rounded-lg border border-red-500/40 bg-red-950/35 px-3 py-2 text-sm font-medium text-red-200 transition-colors hover:border-red-400/60 hover:bg-red-950/55 disabled:opacity-50 sm:w-auto"
            >
              {deleting ? 'Deleting…' : 'Delete enquiry'}
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
