import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {
  formatFollowUpDueDateUk,
  localDateInputToDueIso,
} from '../lib/followUpDates'
import { compareFollowUpsDisplay } from '../lib/followUpPriority'
import type { FollowUp, FollowUpPriority } from '../types/crm'
import { FollowUpPriorityBadge } from './FollowUpPriorityBadge'

const fieldLabel = 'text-xs font-medium text-slate-400'
const inputClass =
  'mt-1 w-full rounded-lg border border-white/10 bg-flowop-navy px-2.5 py-2 text-sm text-white outline-none transition-shadow focus:ring-2 focus:ring-flowop-green'

function todayDateInputValue(): string {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

type Props = {
  enquiryId: string
  onMutate: () => void
}

export function EnquiryModalFollowUpsTab({ enquiryId, onMutate }: Props) {
  const { user } = useAuth()
  const [rows, setRows] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formAction, setFormAction] = useState('')
  const [formDue, setFormDue] = useState(todayDateInputValue)
  const [formPriority, setFormPriority] =
    useState<FollowUpPriority>('medium')
  const [formNotes, setFormNotes] = useState('')

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
    setLoading(false)
  }, [user, enquiryId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch follow-ups for this enquiry
    void load()
  }, [load])

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
    const { error: delErr } = await supabase.from('follow_ups').delete().eq('id', id)
    if (delErr) {
      setError(delErr.message)
      return
    }
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

  if (loading) {
    return <p className="text-sm text-slate-500">Loading follow-ups…</p>
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="space-y-2">
        {rows.length === 0 ? (
          <li className="rounded-lg border border-dashed border-white/15 py-6 text-center text-sm text-slate-500">
            No follow-ups yet.
          </li>
        ) : (
          rows.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-white/10 bg-flowop-navy/60 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`min-w-0 text-sm font-medium text-white ${
                        r.is_done ? 'line-through opacity-70' : ''
                      }`}
                    >
                      {r.action_text}
                    </p>
                    <FollowUpPriorityBadge priority={r.priority} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Due {formatFollowUpDueDateUk(r.due_at)}
                    <span className="mx-1.5 text-slate-600">·</span>
                    <span
                      className={
                        r.is_done ? 'text-emerald-400/90' : 'text-amber-200/90'
                      }
                    >
                      {r.is_done ? 'Done' : 'Open'}
                    </span>
                  </p>
                  {r.notes?.trim() ? (
                    <p className="mt-1.5 text-xs leading-snug text-slate-400">
                      {r.notes}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {!r.is_done ? (
                    <button
                      type="button"
                      onClick={() => void toggleDone(r.id, true)}
                      className="rounded-md border border-white/15 px-2 py-1 text-[11px] font-medium text-slate-200 hover:border-flowop-green/50 hover:text-white"
                    >
                      Mark done
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void toggleDone(r.id, false)}
                      className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200"
                    >
                      Reopen
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void removeFollowUp(r.id)}
                    className="rounded-md px-2 py-1 text-[11px] text-red-300 hover:text-red-200 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>

      <form
        onSubmit={(e) => void addFollowUp(e)}
        className="border-t border-white/10 pt-4 space-y-3"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Add follow-up
        </p>
        <label className="block">
          <span className={fieldLabel}>Action text</span>
          <input
            required
            value={formAction}
            onChange={(e) => setFormAction(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Due date</span>
          <input
            type="date"
            required
            value={formDue}
            onChange={(e) => setFormDue(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Priority</span>
          <select
            value={formPriority}
            onChange={(e) =>
              setFormPriority(e.target.value as FollowUpPriority)
            }
            className={inputClass}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="block">
          <span className={fieldLabel}>Notes</span>
          <textarea
            rows={2}
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            className={`${inputClass} resize-none`}
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-flowop-green px-3 py-2 text-sm font-medium text-white hover:bg-flowop-green-hover disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Add follow-up'}
        </button>
      </form>
    </div>
  )
}
