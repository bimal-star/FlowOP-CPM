import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {
  dueIsoToLocalDateInput,
  formatFollowUpDueDateUk,
  localDateInputToDueIso,
} from '../lib/followUpDates'
import {
  compareFollowUpsDisplay,
  normalizeFollowUpPriority,
} from '../lib/followUpPriority'
import type { FollowUp, FollowUpPriority } from '../types/crm'
import { FollowUpPriorityBadge } from './FollowUpPriorityBadge'
import { FollowUpAttachmentsPanel } from './FollowUpAttachmentsPanel'
import { HelpHint } from './HelpHint'
import {
  FollowUpActionIconButton,
  IconArrowPath,
  IconCheck,
  IconEye,
  IconPaperclip,
  IconPencil,
  IconTrash,
  IconX,
} from './FollowUpActionIconButton'
import {
  countAttachmentsByFollowUpIds,
  deleteAllFollowUpAttachments,
} from '../lib/followUpAttachments'

const thClass =
  'whitespace-nowrap px-2 pb-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500'
const fieldLabel = 'text-xs font-medium text-slate-400'
const panelClass =
  'rounded-lg border border-white/10 bg-flowop-navy/40 px-3 py-3'
const formInputClass =
  'w-full rounded-lg border border-white/10 bg-flowop-navy px-3 py-2.5 text-sm text-white outline-none transition-shadow focus:ring-2 focus:ring-flowop-green'
const formSelectClass = `${formInputClass} flowop-select`
const cellInputEditClass =
  'w-full min-w-0 rounded border border-white/10 bg-flowop-navy px-1.5 py-1 text-xs text-white outline-none transition-shadow focus:ring-1 focus:ring-flowop-green'
const cellSelectEditClass = `${cellInputEditClass} flowop-select-compact`
const tableClass = 'w-full border-collapse text-left text-sm'
const addFollowUpRowGrid =
  'grid grid-cols-[6.25rem_10.5rem_5.5rem_9.5rem] items-center gap-x-2.5'

type EditDraft = {
  action_text: string
  due: string
  priority: FollowUpPriority
  notes: string
}

function todayDateInputValue(): string {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function draftFromFollowUp(row: FollowUp): EditDraft {
  return {
    action_text: row.action_text,
    due: dueIsoToLocalDateInput(row.due_at),
    priority: normalizeFollowUpPriority(row.priority),
    notes: row.notes ?? '',
  }
}

function followUpRowTone(isDone: boolean) {
  if (!isDone) {
    return {
      tr: 'border-b border-white/5 last:border-0 hover:bg-white/[0.03]',
      action: 'block text-sm font-medium text-white',
      due: 'whitespace-nowrap px-2 py-2 align-top text-xs tabular-nums text-slate-400',
      status: 'text-xs text-amber-200/90',
      notes: 'max-w-0 px-2 py-2 align-top text-xs leading-snug text-slate-400',
      badge: '',
    }
  }
  return {
    tr: 'border-b border-white/[0.04] bg-black/30 last:border-0',
    action:
      'block text-sm font-normal text-slate-500 line-through decoration-slate-600',
    due: 'whitespace-nowrap px-2 py-2 align-top text-xs tabular-nums text-slate-600',
    status: 'text-xs text-slate-500',
    notes: 'max-w-0 px-2 py-2 align-top text-xs leading-snug text-slate-600',
    badge: 'opacity-40 grayscale',
  }
}

function formatDateTimeUk(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = {
  enquiryId: string
  onMutate: () => void
  initialEditFollowUpId?: string | null
}

export function EnquiryModalFollowUpsTab({
  enquiryId,
  onMutate,
  initialEditFollowUpId = null,
}: Props) {
  const { user } = useAuth()
  const [rows, setRows] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [formAction, setFormAction] = useState('')
  const [formDue, setFormDue] = useState(todayDateInputValue)
  const [formPriority, setFormPriority] =
    useState<FollowUpPriority>('medium')
  const [formNotes, setFormNotes] = useState('')
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>(
    {}
  )
  const [expandedAttachmentsId, setExpandedAttachmentsId] = useState<string | null>(
    null
  )
  const [expandedViewId, setExpandedViewId] = useState<string | null>(null)
  const appliedInitialEditKey = useRef<string | null>(null)
  const rowAnchorRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())

  const focusedRowId =
    editingId ?? expandedViewId ?? expandedAttachmentsId

  const load = useCallback(async () => {
    if (!user) return
    const { data, error: fetchError } = await supabase
      .from('follow_ups')
      .select(
        'id, user_id, enquiry_id, contact_name, due_at, action_text, notes, priority, is_done, created_at, updated_at'
      )
      .eq('enquiry_id', enquiryId)
      .order('due_at', { ascending: true })

    if (fetchError) {
      setLoading(false)
      setError(fetchError.message)
      return
    }
    setError(null)
    const list = ((data as FollowUp[]) ?? []).slice().sort(compareFollowUpsDisplay)
    setRows(list)
    try {
      const counts = await countAttachmentsByFollowUpIds(list.map((r) => r.id))
      setAttachmentCounts(counts)
    } catch {
      setAttachmentCounts({})
    }
    setLoading(false)
  }, [user, enquiryId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch follow-ups for this enquiry
    void load()
  }, [load])

  useEffect(() => {
    appliedInitialEditKey.current = null
    cancelEdit()
  }, [enquiryId, initialEditFollowUpId])

  useEffect(() => {
    if (!focusedRowId) return
    const row = rowAnchorRefs.current.get(focusedRowId)
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focusedRowId, expandedViewId, expandedAttachmentsId, editingId])

  useEffect(() => {
    if (!focusedRowId) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (editingId) {
        cancelEdit()
        return
      }
      setExpandedViewId(null)
      setExpandedAttachmentsId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focusedRowId, editingId])

  function setRowAnchor(id: string, el: HTMLTableRowElement | null) {
    if (el) rowAnchorRefs.current.set(id, el)
    else rowAnchorRefs.current.delete(id)
  }

  function rowFocusClass(rowId: string) {
    const isFocused = focusedRowId === rowId
    const isDimmed = focusedRowId !== null && !isFocused
    return {
      isFocused,
      isDimmed,
      main: [
        isFocused
          ? 'relative z-[1] bg-flowop-green/[0.07] ring-1 ring-inset ring-flowop-green/30'
          : '',
        isDimmed ? 'opacity-40 pointer-events-none' : '',
        'transition-opacity duration-200',
      ].join(' '),
      detail: [
        isFocused ? 'relative z-[1] bg-flowop-green/[0.04]' : '',
        isDimmed ? 'opacity-40 pointer-events-none' : '',
        'transition-opacity duration-200',
      ].join(' '),
    }
  }

  useEffect(() => {
    if (loading || !initialEditFollowUpId) return
    const key = `${enquiryId}:${initialEditFollowUpId}`
    if (appliedInitialEditKey.current === key) return
    const row = rows.find((r) => r.id === initialEditFollowUpId)
    if (!row) return
    startEdit(row)
    appliedInitialEditKey.current = key
  }, [loading, rows, enquiryId, initialEditFollowUpId])

  function cancelEdit() {
    setEditingId(null)
    setEditDraft(null)
    setExpandedAttachmentsId(null)
  }

  function startEdit(row: FollowUp) {
    setExpandedViewId(null)
    setExpandedAttachmentsId(null)
    setEditingId(row.id)
    setEditDraft(draftFromFollowUp(row))
    setError(null)
  }

  async function toggleDone(id: string, next: boolean) {
    setError(null)
    const { error: upErr } = await supabase
      .from('follow_ups')
      .update({ is_done: next })
      .eq('id', id)
    if (upErr) {
      setError(upErr.message)
      return
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, is_done: next } : r)))
    onMutate()
  }

  async function removeFollowUp(id: string) {
    if (
      !window.confirm(
        'Delete this follow-up? This cannot be undone.'
      )
    ) {
      return
    }
    setError(null)
    try {
      await deleteAllFollowUpAttachments(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete attachments.')
      return
    }
    const { error: delErr } = await supabase.from('follow_ups').delete().eq('id', id)
    if (delErr) {
      setError(delErr.message)
      return
    }
    if (editingId === id) cancelEdit()
    if (expandedAttachmentsId === id) setExpandedAttachmentsId(null)
    if (expandedViewId === id) setExpandedViewId(null)
    setRows((prev) => prev.filter((r) => r.id !== id))
    onMutate()
  }

  async function addFollowUp(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !formAction.trim()) return
    setSaving(true)
    setError(null)
    const { error: insErr } = await supabase.from('follow_ups').insert({
      user_id: user.id,
      enquiry_id: enquiryId,
      contact_name: null,
      due_at: localDateInputToDueIso(formDue),
      action_text: formAction.trim(),
      notes: formNotes.trim() || null,
      priority: formPriority,
    })
    setSaving(false)
    if (insErr) {
      setError(insErr.message)
      return
    }
    setFormAction('')
    setFormNotes('')
    setFormDue(todayDateInputValue())
    setFormPriority('medium')
    void load()
    onMutate()
  }

  async function saveEdit(id: string) {
    if (!editDraft || !editDraft.action_text.trim()) return
    setSavingEdit(true)
    setError(null)
    const { error: upErr } = await supabase
      .from('follow_ups')
      .update({
        action_text: editDraft.action_text.trim(),
        due_at: localDateInputToDueIso(editDraft.due),
        notes: editDraft.notes.trim() || null,
        priority: editDraft.priority,
      })
      .eq('id', id)

    setSavingEdit(false)
    if (upErr) {
      setError(upErr.message)
      return
    }
    cancelEdit()
    void load()
    onMutate()
  }

  function refreshAttachmentCounts() {
    void countAttachmentsByFollowUpIds(rows.map((r) => r.id))
      .then(setAttachmentCounts)
      .catch(() => setAttachmentCounts({}))
  }

  function toggleAttachmentsPanel(id: string) {
    setExpandedViewId(null)
    setExpandedAttachmentsId((prev) => (prev === id ? null : id))
  }

  function toggleViewPanel(id: string) {
    setExpandedAttachmentsId(null)
    setExpandedViewId((prev) => (prev === id ? null : id))
  }

  function closeAttachmentsPanel() {
    setExpandedAttachmentsId(null)
  }

  function renderViewDetailsRow(row: FollowUp) {
    const fileCount = attachmentCounts[row.id] ?? 0
    const focus = rowFocusClass(row.id)

    return (
      <tr
        key={`${row.id}-view`}
        className={`border-b border-white/5 last:border-0 ${focus.detail}`}
      >
        <td colSpan={6} className="px-2 py-1">
          <div
            className={`flex items-start gap-2 rounded border border-white/10 px-2 py-1.5 ${
              row.is_done ? 'bg-black/25' : 'bg-flowop-navy/40'
            }`}
          >
            <div className="min-w-0 flex-1 text-xs leading-snug">
              {row.notes?.trim() ? (
                <p
                  className={`whitespace-pre-wrap ${
                    row.is_done ? 'text-slate-500' : 'text-slate-300'
                  }`}
                >
                  <span className="font-medium text-slate-500">Notes: </span>
                  {row.notes.trim()}
                </p>
              ) : (
                <p className="text-slate-600">No notes</p>
              )}
              <p className="mt-1 text-[10px] text-slate-500">
                Created {formatDateTimeUk(row.created_at)}
                {' · '}
                Updated {formatDateTimeUk(row.updated_at)}
                {fileCount > 0
                  ? ` · ${fileCount} file${fileCount === 1 ? '' : 's'}`
                  : ''}
              </p>
            </div>
            <FollowUpActionIconButton
              label="Close details"
              onClick={() => setExpandedViewId(null)}
            >
              <IconX />
            </FollowUpActionIconButton>
          </div>
        </td>
      </tr>
    )
  }

  function renderAttachmentsRow(
    followUpId: string,
    editable: boolean,
    keySuffix: string
  ) {
    const focus = rowFocusClass(followUpId)

    return (
      <tr
        key={`${followUpId}-attachments-${keySuffix}`}
        className={`border-b border-white/5 last:border-0 ${focus.detail}`}
      >
        <td colSpan={6} className="overflow-hidden px-2 py-1">
          <FollowUpAttachmentsPanel
            enquiryId={enquiryId}
            followUpId={followUpId}
            editable={editable}
            onMutate={refreshAttachmentCounts}
            onError={(message) => setError(message)}
            onClose={closeAttachmentsPanel}
          />
        </td>
      </tr>
    )
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading follow-ups…</p>
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(e) => void addFollowUp(e)}
        className="shrink-0"
      >
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,35rem)_minmax(0,1fr)] lg:items-stretch">
          <div className={`${panelClass} flex h-full min-h-0 flex-row gap-2`}>
            <div className="flex w-9 shrink-0 items-center justify-center self-stretch border-r border-white/10 pr-2">
              <div className="-rotate-90 flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-flowop-green/90">
                  Add follow-up
                </span>
                <HelpHint
                  text="Use the paperclip icon on a follow-up row to attach PDF, Word, Excel, PowerPoint, or images."
                  label="Follow-up attachments help"
                  placement="top"
                />
              </div>
            </div>
            <div className="-ml-11 flex min-w-0 flex-1 flex-col gap-2.5">
            <div className={addFollowUpRowGrid}>
              <label
                htmlFor="follow-up-action"
                className={`${fieldLabel} text-right`}
              >
                Action
              </label>
              <input
                id="follow-up-action"
                required
                value={formAction}
                onChange={(e) => setFormAction(e.target.value)}
                placeholder="What to do next"
                className={`${formInputClass} col-span-3 min-w-0`}
              />
            </div>
            <div className={addFollowUpRowGrid}>
              <label
                htmlFor="follow-up-due"
                className={`${fieldLabel} text-right`}
              >
                Due
              </label>
              <input
                id="follow-up-due"
                type="date"
                required
                value={formDue}
                onChange={(e) => setFormDue(e.target.value)}
                className={`${formInputClass} flowop-date-input w-full`}
              />
              <label
                htmlFor="follow-up-priority"
                className={`${fieldLabel} text-right`}
              >
                Priority
              </label>
              <select
                id="follow-up-priority"
                value={formPriority}
                onChange={(e) =>
                  setFormPriority(e.target.value as FollowUpPriority)
                }
                className={formSelectClass}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="flex justify-center">
              <button
                type="submit"
                disabled={saving || savingEdit}
                className="min-w-[12rem] rounded-lg bg-flowop-green px-4 py-2 text-sm font-medium text-white hover:bg-flowop-green-hover disabled:opacity-50"
              >
                {saving ? 'Adding…' : 'Add follow-up'}
              </button>
            </div>
            </div>
          </div>

          <div className={`${panelClass} flex h-full min-h-0 w-full min-w-0 flex-col`}>
            <label htmlFor="follow-up-notes" className={fieldLabel}>
              Notes
            </label>
            <textarea
              id="follow-up-notes"
              rows={5}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Optional"
              style={{ resize: 'none' }}
              className={`mt-1.5 min-h-0 flex-1 resize-none overflow-y-auto ${formInputClass}`}
            />
          </div>
        </div>
      </form>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-lg border border-white/10">
        <table className={tableClass}>
          <thead className="sticky top-0 z-[1] bg-flowop-navy-light/95 backdrop-blur-sm">
            <tr className="border-b border-white/10">
              <th className={`${thClass} w-[26%]`}>Action</th>
              <th className={`${thClass} w-[10%]`}>Due</th>
              <th className={`${thClass} w-[9%]`}>Priority</th>
              <th className={`${thClass} w-[8%]`}>Status</th>
              <th className={`${thClass} w-[22%]`}>Notes</th>
              <th className={`${thClass} w-[14%] text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-sm text-slate-500"
                >
                  No follow-ups yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const isEditing = editingId === r.id && editDraft !== null

                if (isEditing) {
                  const focus = rowFocusClass(r.id)
                  return (
                    <Fragment key={r.id}>
                      <tr
                        ref={(el) => setRowAnchor(r.id, el)}
                        className={`border-b border-flowop-green/30 bg-flowop-green/5 last:border-0 ${focus.main}`}
                      >
                        <td className="px-2 py-1 align-top">
                          <input
                            required
                            value={editDraft.action_text}
                            onChange={(e) =>
                              setEditDraft((d) =>
                                d ? { ...d, action_text: e.target.value } : d
                              )
                            }
                            className={cellInputEditClass}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="date"
                            required
                            value={editDraft.due}
                            onChange={(e) =>
                              setEditDraft((d) =>
                                d ? { ...d, due: e.target.value } : d
                              )
                            }
                            className={`${cellInputEditClass} flowop-date-input-compact`}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <select
                            value={editDraft.priority}
                            onChange={(e) =>
                              setEditDraft((d) =>
                                d
                                  ? {
                                      ...d,
                                      priority: e.target.value as FollowUpPriority,
                                    }
                                  : d
                              )
                            }
                            className={cellSelectEditClass}
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <span
                            className={`text-[11px] ${
                              r.is_done ? 'text-emerald-400/90' : 'text-amber-200/90'
                            }`}
                          >
                            {r.is_done ? 'Done' : 'Open'}
                          </span>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <textarea
                            rows={5}
                            value={editDraft.notes}
                            onChange={(e) =>
                              setEditDraft((d) =>
                                d ? { ...d, notes: e.target.value } : d
                              )
                            }
                            placeholder="Optional"
                            className={`${cellInputEditClass} resize-none`}
                          />
                        </td>
                        <td className="px-2 py-1 align-top text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <button
                              type="button"
                              disabled={savingEdit}
                              onClick={() => void saveEdit(r.id)}
                              className="rounded border border-flowop-green/50 bg-flowop-green/20 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-flowop-green/35 disabled:opacity-50"
                            >
                              {savingEdit ? '…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              disabled={savingEdit}
                              onClick={cancelEdit}
                              className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-slate-300 hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  )
                }

                const fileCount = attachmentCounts[r.id] ?? 0
                const tone = followUpRowTone(r.is_done)
                const focus = rowFocusClass(r.id)

                return (
                  <Fragment key={r.id}>
                    <tr
                      ref={(el) => setRowAnchor(r.id, el)}
                      className={`${tone.tr} ${focus.main}`}
                    >
                    <td className="px-2 py-2 align-top">
                      <span className={tone.action}>
                        {r.action_text}
                      </span>
                    </td>
                    <td className={tone.due}>
                      {formatFollowUpDueDateUk(r.due_at)}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <FollowUpPriorityBadge
                        priority={r.priority}
                        className={tone.badge}
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <span className={tone.status}>
                        {r.is_done ? 'Done' : 'Open'}
                      </span>
                    </td>
                    <td className={tone.notes}>
                      {r.notes?.trim() ? (
                        <span className="line-clamp-2" title={r.notes.trim()}>
                          {r.notes.trim()}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 align-top text-right">
                      <div
                        className={`flex flex-wrap justify-end gap-0.5 ${
                          r.is_done ? 'opacity-80' : ''
                        }`}
                      >
                        <FollowUpActionIconButton
                          label={expandedViewId === r.id ? 'Hide details' : 'View details'}
                          disabled={editingId !== null}
                          active={expandedViewId === r.id}
                          onClick={() => toggleViewPanel(r.id)}
                        >
                          <IconEye />
                        </FollowUpActionIconButton>
                        <FollowUpActionIconButton
                          label={
                            expandedAttachmentsId === r.id
                              ? 'Hide files'
                              : 'View files'
                          }
                          disabled={editingId !== null}
                          active={expandedAttachmentsId === r.id}
                          onClick={() => toggleAttachmentsPanel(r.id)}
                        >
                          <IconPaperclip />
                          {fileCount > 0 ? (
                            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-flowop-green px-0.5 text-[9px] font-semibold leading-none text-white">
                              {fileCount > 9 ? '9+' : fileCount}
                            </span>
                          ) : null}
                        </FollowUpActionIconButton>
                        <FollowUpActionIconButton
                          label="Edit follow-up"
                          disabled={editingId !== null}
                          onClick={() => startEdit(r)}
                        >
                          <IconPencil />
                        </FollowUpActionIconButton>
                        {!r.is_done ? (
                          <FollowUpActionIconButton
                            label="Mark as done"
                            variant="success"
                            onClick={() => void toggleDone(r.id, true)}
                          >
                            <IconCheck />
                          </FollowUpActionIconButton>
                        ) : (
                          <FollowUpActionIconButton
                            label="Reopen follow-up"
                            onClick={() => void toggleDone(r.id, false)}
                          >
                            <IconArrowPath />
                          </FollowUpActionIconButton>
                        )}
                        <FollowUpActionIconButton
                          label="Delete follow-up"
                          variant="danger"
                          onClick={() => void removeFollowUp(r.id)}
                        >
                          <IconTrash />
                        </FollowUpActionIconButton>
                      </div>
                    </td>
                  </tr>
                    {expandedViewId === r.id ? renderViewDetailsRow(r) : null}
                    {expandedAttachmentsId === r.id
                      ? renderAttachmentsRow(r.id, !r.is_done, 'view')
                      : null}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
