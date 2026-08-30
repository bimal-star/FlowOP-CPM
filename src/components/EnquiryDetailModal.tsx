import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCrmStats } from '../hooks/useCrmStats'
import { usePipelineStages } from '../contexts/PipelineStagesContext'
import { enquiryToDraft, type EnquiryDetailDraft } from '../lib/enquiryDetail'
import type { Enquiry, EnquiryStage, StageHistoryRow } from '../types/crm'
import { EnquiryModalFollowUpsTab } from './EnquiryModalFollowUpsTab'
import { EnquiryStageHistoryTrack } from './EnquiryStageHistoryTrack'
import { ExpandableFormTextarea } from './ExpandableFormTextarea'
import { HelpHint } from './HelpHint'
import { IconCheck, IconTrash, IconX } from './FollowUpActionIconButton'

const fieldLabel = 'text-xs font-medium text-slate-400'
const panelClass =
  'rounded-lg border border-white/10 bg-flowop-navy/40 px-3 py-3'
const inputClass =
  'w-full rounded-lg border border-white/10 bg-flowop-navy px-3 py-2.5 text-sm text-white outline-none transition-shadow focus:ring-2 focus:ring-flowop-green'
const selectClass = `${inputClass} flowop-select`
const inputTextarea = inputClass
const alignedCompactInputWidth = 'min-w-0 w-[10.5rem]'
const modalActionButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50'
const modalActionIconClass = 'h-4 w-4 shrink-0'

function DetailField({
  label,
  htmlFor,
  inputWidthClass,
  children,
}: {
  label: string
  htmlFor: string
  inputWidthClass?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[6.25rem_minmax(0,1fr)] items-center gap-x-2.5 gap-y-0">
      <label htmlFor={htmlFor} className={`${fieldLabel} text-right`}>
        {label}
      </label>
      <div className={inputWidthClass ?? 'min-w-0 max-w-[13rem]'}>{children}</div>
    </div>
  )
}

export function EnquiryDetailModal({
  enquiry,
  onClose,
  onSaved,
  onDeleted,
  editFollowUpId = null,
}: {
  enquiry: Enquiry
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
  /** When set, Follow-ups tab opens with this row in edit mode (e.g. from Follow-ups page). */
  editFollowUpId?: string | null
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
  const { stages } = usePipelineStages()

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
      className="fixed inset-0 z-50"
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
      <div className="absolute inset-x-4 bottom-3 top-[6.5rem] flex min-h-0 sm:inset-x-6 sm:bottom-4 sm:top-28 lg:inset-x-8">
        <div className="relative z-10 flex min-h-0 w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-flowop-navy-light shadow-xl">
        <div className="shrink-0 border-b border-white/10 px-4 py-2.5 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h3
              id="enquiry-detail-title"
              className="text-lg font-semibold tracking-tight text-white"
            >
              Enquiry details
            </h3>
            {!showDeletedMessage ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={deleting || saving}
                  onClick={() => void handleDelete()}
                  className={`${modalActionButtonClass} border border-red-500/40 bg-red-950/35 text-red-200 hover:border-red-400/60 hover:bg-red-950/55`}
                >
                  <IconTrash className={modalActionIconClass} />
                  <span>{deleting ? 'Deleting…' : 'Delete enquiry'}</span>
                </button>
                <button
                  type="button"
                  onClick={close}
                  className={`${modalActionButtonClass} border border-white/15 text-slate-300 hover:border-white/25 hover:text-white`}
                >
                  <IconX className={modalActionIconClass} />
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  form="enquiry-detail-form"
                  disabled={saving || deleting}
                  className={`${modalActionButtonClass} bg-flowop-green text-white hover:bg-flowop-green-hover`}
                >
                  <IconCheck className={modalActionIconClass} />
                  <span>{saving ? 'Saving…' : 'Save changes'}</span>
                </button>
                <HelpHint
                  text="Delete permanently removes this enquiry and all linked follow-ups. Cancel closes without saving. Save changes updates the enquiry in Supabase."
                  label="Enquiry actions help"
                  placement="bottom"
                />
              </div>
            ) : null}
          </div>
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
          <div className="shrink-0 border-b border-white/10 px-4 py-3 sm:px-5">
            <form
              id="enquiry-detail-form"
              onSubmit={(e) => void save(e)}
            >
              <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,24.75rem)_minmax(0,1fr)] lg:items-stretch">
                <div className={`${panelClass} space-y-2.5`}>
                  <DetailField label="Name" htmlFor="enquiry-name" inputWidthClass="min-w-0 max-w-[17.25rem]">
                    <input
                      id="enquiry-name"
                      required
                      value={draft.contact_name}
                      onChange={(e) =>
                        setDraft((d) =>
                          d ? { ...d, contact_name: e.target.value } : d
                        )
                      }
                      className={inputClass}
                    />
                  </DetailField>
                  <DetailField label="Company" htmlFor="enquiry-company" inputWidthClass="min-w-0 max-w-[18rem]">
                    <input
                      id="enquiry-company"
                      value={draft.company}
                      onChange={(e) =>
                        setDraft((d) =>
                          d ? { ...d, company: e.target.value } : d
                        )
                      }
                      className={inputClass}
                    />
                  </DetailField>
                  <DetailField label="Email" htmlFor="enquiry-email" inputWidthClass="min-w-0 max-w-[20.25rem]">
                    <input
                      id="enquiry-email"
                      type="email"
                      value={draft.email}
                      onChange={(e) =>
                        setDraft((d) =>
                          d ? { ...d, email: e.target.value } : d
                        )
                      }
                      className={inputClass}
                    />
                  </DetailField>
                  <DetailField label="Source" htmlFor="enquiry-source" inputWidthClass={alignedCompactInputWidth}>
                    <input
                      id="enquiry-source"
                      value={draft.source}
                      onChange={(e) =>
                        setDraft((d) =>
                          d ? { ...d, source: e.target.value } : d
                        )
                      }
                      className={inputClass}
                    />
                  </DetailField>
                  <DetailField label="Stage" htmlFor="enquiry-stage" inputWidthClass={alignedCompactInputWidth}>
                    <select
                      id="enquiry-stage"
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
                      className={selectClass}
                    >
                      {stageOptions.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </DetailField>
                  <DetailField label="Date received" htmlFor="enquiry-date" inputWidthClass={alignedCompactInputWidth}>
                    <input
                      id="enquiry-date"
                      type="date"
                      value={draft.date_received.slice(0, 10)}
                      onChange={(e) =>
                        setDraft((d) =>
                          d ? { ...d, date_received: e.target.value } : d
                        )
                      }
                      className={`${inputClass} flowop-date-input`}
                    />
                  </DetailField>
                </div>

                <div className={`${panelClass} min-w-0`}>
                  <div className="flex min-h-0 flex-col gap-2.5">
                    <div className="grid min-h-0 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                      <ExpandableFormTextarea
                        label="Query summary"
                        value={draft.query_summary}
                        onChange={(next) =>
                          setDraft((d) => (d ? { ...d, query_summary: next } : d))
                        }
                        collapsedHeightClass="min-h-[10rem] max-h-[10rem] lg:min-h-[11rem] lg:max-h-[11rem]"
                        colSpanClass="flex min-h-0 flex-col"
                        wrapperClassName="flex min-h-0 flex-col"
                        labelClassName={fieldLabel}
                        inputClassName={inputTextarea}
                      />
                      <ExpandableFormTextarea
                        label="Notes"
                        value={draft.notes}
                        onChange={(next) =>
                          setDraft((d) => (d ? { ...d, notes: next } : d))
                        }
                        collapsedHeightClass="min-h-[10rem] max-h-[10rem] lg:min-h-[11rem] lg:max-h-[11rem]"
                        colSpanClass="flex min-h-0 flex-col"
                        wrapperClassName="flex min-h-0 flex-col"
                        labelClassName={fieldLabel}
                        inputClassName={inputTextarea}
                      />
                    </div>
                    <EnquiryStageHistoryTrack
                      stages={stages}
                      currentStage={stageForApi}
                      stageHistory={stageHistory}
                      loading={historyLoading}
                      error={historyError}
                    />
                  </div>
                </div>
              </div>
            </form>

            {error ? (
              <p className="mt-2 text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-2 pt-2 sm:px-5">
            <EnquiryModalFollowUpsTab
              key={`${enquiry.id}-${editFollowUpId ?? ''}`}
              enquiryId={enquiry.id}
              initialEditFollowUpId={editFollowUpId}
              onMutate={() => void refreshStats()}
            />
          </div>
        </div>
        )}
        </div>
      </div>
    </div>
  )
}
