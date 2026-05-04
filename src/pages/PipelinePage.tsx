import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePipelineStages } from '../contexts/PipelineStagesContext'
import { formatDateUk } from '../lib/dates'
import { useCrmStats } from '../hooks/useCrmStats'
import { EnquiryDetailModal } from '../components/EnquiryDetailModal'
import type { Enquiry, EnquiryStage } from '../types/crm'

export function PipelinePage() {
  const { user } = useAuth()
  const { stages } = usePipelineStages()
  const { refresh: refreshStats } = useCrmStats()
  const [rows, setRows] = useState<Enquiry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<EnquiryStage | null>(
    null
  )
  const suppressCardClick = useRef(false)

  const load = useCallback(async () => {
    if (!user) return
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('enquiries')
      .select('*')
      .order('updated_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      return
    }
    setRows((data as Enquiry[]) ?? [])
  }, [user])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Supabase fetch when user is known
    void load()
  }, [load])

  useEffect(() => {
    const clearOver = () => setDragOverStage(null)
    window.addEventListener('dragend', clearOver)
    return () => window.removeEventListener('dragend', clearOver)
  }, [])

  const knownStageNames = useMemo(
    () => new Set(stages.map((s) => s.name)),
    [stages]
  )

  /** Enquiries whose `stage` string is not in `pipeline_stages` fall into this column. */
  const fallbackStageName = useMemo(() => {
    const def = stages.find((s) => s.is_default)
    return def?.name ?? stages[0]?.name ?? null
  }, [stages])

  const byStage = useMemo(() => {
    const map = new Map<EnquiryStage, Enquiry[]>()
    for (const s of stages) {
      map.set(s.name, [])
    }
    for (const r of rows) {
      const key = knownStageNames.has(r.stage)
        ? r.stage
        : fallbackStageName
      if (!key) continue
      const list = map.get(key)
      if (list) list.push(r)
    }
    return map
  }, [rows, stages, knownStageNames, fallbackStageName])

  const detailEnquiry =
    detailId !== null ? (rows.find((r) => r.id === detailId) ?? null) : null

  const moveToStage = useCallback(
    async (id: string, stage: EnquiryStage) => {
      const row = rows.find((r) => r.id === id)
      if (!row || row.stage === stage) return

      setError(null)
      const previous = rows
      setRows((cur) => cur.map((r) => (r.id === id ? { ...r, stage } : r)))

      const { error: upErr } = await supabase
        .from('enquiries')
        .update({ stage })
        .eq('id', id)

      if (upErr) {
        setRows(previous)
        setError(upErr.message)
        return
      }
      void load()
    },
    [rows, load]
  )

  function closeDetail() {
    setDetailId(null)
  }

  function handleCardDragEnd() {
    suppressCardClick.current = true
    window.setTimeout(() => {
      suppressCardClick.current = false
    }, 120)
  }

  function handleCardClick(r: Enquiry) {
    if (suppressCardClick.current) return
    setDetailId(r.id)
  }

  function renderColumn(
    col: { name: string; label: string; colour: string },
    items: Enquiry[]
  ) {
    const isOver = dragOverStage === col.name
    return (
      <div
        key={col.name}
        className={`flex min-h-0 min-w-[min(100%,200px)] flex-1 shrink-0 flex-col rounded-xl border border-white/10 bg-flowop-navy-light/30 ${
          isOver
            ? 'ring-2 ring-flowop-green/40 ring-offset-2 ring-offset-flowop-navy'
            : ''
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDragOverStage(col.name)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverStage(null)
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragOverStage(null)
          const id = e.dataTransfer.getData('text/plain')
          if (!id) return
          void moveToStage(id, col.name)
        }}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 border-t-[3px] px-3 py-2"
          style={{ borderTopColor: col.colour }}
        >
          <p className="text-sm font-medium text-white">{col.label}</p>
          <span
            className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-400"
            aria-label={`${items.length} in ${col.label}`}
          >
            {items.length}
          </span>
        </div>
        <ul className="flex max-h-[min(70vh,560px)] flex-col gap-1.5 overflow-y-auto p-2">
          {items.length === 0 ? (
            <li className="rounded-lg py-6 text-center text-xs text-slate-500">
              Empty
            </li>
          ) : (
            items.map((r) => (
              <li
                key={r.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', r.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={handleCardDragEnd}
                role="button"
                tabIndex={0}
                onClick={() => handleCardClick(r)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleCardClick(r)
                  }
                }}
                className="box-border flex h-10 cursor-grab items-center rounded-lg border border-white/10 bg-flowop-navy/80 px-2.5 text-left transition-colors active:cursor-grabbing hover:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-flowop-green"
              >
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span
                    className="min-w-0 shrink truncate font-bold text-[13px] text-white"
                    title={
                      r.company?.trim()
                        ? `${r.contact_name} — ${r.company.trim()}`
                        : r.contact_name
                    }
                  >
                    {r.contact_name}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-center text-[11px] ${
                      r.company?.trim()
                        ? 'text-flowop-green'
                        : 'text-transparent'
                    }`}
                    aria-hidden={!r.company?.trim()}
                  >
                    {r.company?.trim() || '\u00a0'}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                    {formatDateUk(r.date_received ?? '')}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Pipeline</h1>
        <p className="mt-1 text-sm text-slate-400">
          Enquiries grouped by stage. Update stages from the enquiry log or here.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex w-full min-w-0 gap-4 overflow-x-auto pb-2">
        {stages.map((col) =>
          renderColumn(col, byStage.get(col.name) ?? [])
        )}
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
