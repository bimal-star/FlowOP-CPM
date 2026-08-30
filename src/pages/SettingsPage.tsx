import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePipelineStages } from '../contexts/PipelineStagesContext'
import { HelpHint } from '../components/HelpHint'
import type { PipelineStageRow } from '../types/crm'

const inlineInputClass =
  'min-w-0 rounded border border-white/10 bg-flowop-navy px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-flowop-green'

function slugifyName(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
  return s || 'stage'
}

function DragHandleIcon() {
  return (
    <span
      className="inline-flex text-slate-500"
      aria-hidden
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="opacity-80"
      >
        <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm12-12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
      </svg>
    </span>
  )
}

export function SettingsPage() {
  const { user } = useAuth()
  const { stages, loading, error: ctxError, refresh } = usePipelineStages()
  const [ordered, setOrdered] = useState<PipelineStageRow[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newColour, setNewColour] = useState('#64748b')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  /* eslint-disable react-hooks/set-state-in-effect -- local order resets after server refresh / reorder */
  useEffect(() => {
    setOrdered(stages)
  }, [stages])
  /* eslint-enable react-hooks/set-state-in-effect */

  const persistSortOrder = useCallback(
    async (rows: PipelineStageRow[]) => {
      setError(null)
      for (let i = 0; i < rows.length; i++) {
        const { error: upErr } = await supabase
          .from('pipeline_stages')
          .update({ sort_order: i })
          .eq('id', rows[i].id)
        if (upErr) {
          setError(upErr.message)
          await refresh()
          return
        }
      }
      await refresh()
    },
    [refresh]
  )

  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null)
      return
    }
    const next = [...ordered]
    const [removed] = next.splice(dragIndex, 1)
    next.splice(targetIndex, 0, removed)
    setOrdered(next)
    setDragIndex(null)
    void persistSortOrder(next)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!user) {
      setError('You must be signed in.')
      return
    }
    const label = newLabel.trim()
    if (!label) {
      setError('Label is required.')
      return
    }
    const name = slugifyName(newName || label)
    setAdding(true)
    setError(null)
    const maxOrder =
      ordered.reduce((m, r) => Math.max(m, r.sort_order), -1) + 1
    const { error: insErr } = await supabase.from('pipeline_stages').insert({
      user_id: user.id,
      name,
      label,
      colour: newColour,
      sort_order: maxOrder,
      is_default: false,
    })
    setAdding(false)
    if (insErr) {
      setError(insErr.message)
      return
    }
    setNewName('')
    setNewLabel('')
    setNewColour('#64748b')
    await refresh()
  }

  async function handleDelete(row: PipelineStageRow) {
    setError(null)
    const { count, error: countErr } = await supabase
      .from('enquiries')
      .select('id', { count: 'exact', head: true })
      .eq('stage', row.name)

    if (countErr) {
      setError(countErr.message)
      return
    }
    const n = count ?? 0
    if (n > 0) {
      window.alert(
        `${n} enquiries are in this stage. Reassign them before deleting.`
      )
      return
    }
    if (
      !window.confirm(`Delete stage "${row.label}"? This cannot be undone.`)
    ) {
      return
    }
    setDeletingId(row.id)
    const { error: delErr } = await supabase
      .from('pipeline_stages')
      .delete()
      .eq('id', row.id)
    setDeletingId(null)
    if (delErr) {
      setError(delErr.message)
      return
    }
    await refresh()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <header className="shrink-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-white">
            Settings
          </h1>
          <HelpHint
            text="Customise pipeline stages. Order applies to the kanban board and stage dropdowns."
            label="Settings help"
          />
        </div>
      </header>

      {ctxError || error ? (
        <p className="text-sm text-red-400" role="alert">
          {error ?? ctxError}
        </p>
      ) : null}

      <section
        className="rounded-xl border border-white/10 bg-flowop-navy-light/50"
        aria-labelledby="stages-heading"
      >
        <div className="border-b border-white/10 px-4 py-2.5 sm:px-5">
          <h2
            id="stages-heading"
            className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-slate-100"
          >
            Pipeline stages
            <HelpHint
              text="Drag rows to reorder. Delete is blocked while enquiries use a stage."
              label="Pipeline stages help"
            />
          </h2>
        </div>

        <div className="min-h-0 px-4 py-3 sm:px-5">
          {loading ? (
            <p className="text-sm text-slate-500">Loading stages…</p>
          ) : ordered.length === 0 ? (
            <p className="text-sm text-slate-500">No stages configured.</p>
          ) : (
            <div className="mx-auto w-full max-w-[700px] overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <tbody>
                  {ordered.map((row, index) => (
                    <tr
                      key={row.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(index)}
                      className="cursor-grab border-b border-white/[0.07] active:cursor-grabbing last:border-b-0"
                    >
                      <td className="w-8 py-1.5 pr-1 align-middle">
                        <DragHandleIcon />
                      </td>
                      <td className="w-10 py-1.5 pr-2 align-middle">
                        <div
                          className="h-4 w-4 shrink-0 rounded-sm ring-1 ring-white/10"
                          style={{ backgroundColor: row.colour }}
                          title={row.colour}
                        />
                      </td>
                      <td className="min-w-0 py-1.5 pr-2 align-middle">
                        <span className="block truncate text-sm font-bold text-white">
                          {row.name}
                        </span>
                      </td>
                      <td className="min-w-0 py-1.5 pr-2 align-middle">
                        <span className="block truncate text-xs text-slate-500">
                          {row.label}
                        </span>
                      </td>
                      <td className="w-px whitespace-nowrap py-1.5 pl-1 text-right align-middle">
                        <button
                          type="button"
                          disabled={deletingId === row.id}
                          onClick={() => void handleDelete(row)}
                          className="rounded px-2 py-0.5 text-[11px] font-medium text-red-400 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-50"
                        >
                          {deletingId === row.id ? '…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form
            onSubmit={(e) => void handleAdd(e)}
            className="mx-auto mt-4 flex w-full max-w-[700px] flex-wrap items-center gap-2 border-t border-white/10 pt-3"
          >
            <input
              type="color"
              value={newColour}
              onChange={(e) => setNewColour(e.target.value)}
              className="h-8 w-8 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent p-0"
              aria-label="Stage colour"
              title={newColour}
            />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name (slug)"
              className={`${inlineInputClass} w-[8.5rem] sm:w-36`}
            />
            <input
              required
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label"
              className={`${inlineInputClass} min-w-[6rem] flex-1`}
            />
            <button
              type="submit"
              disabled={adding}
              className="shrink-0 rounded-lg bg-flowop-green px-3 py-1.5 text-sm font-medium text-white hover:bg-flowop-green-hover disabled:opacity-50"
            >
              {adding ? 'Adding…' : 'Add'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
