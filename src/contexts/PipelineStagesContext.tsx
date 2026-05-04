/* eslint-disable react-refresh/only-export-components -- context module */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { PIPELINE_STAGE_COLUMNS } from '../constants/supabaseColumns'
import type { PipelineStageRow } from '../types/crm'

/** If the DB has duplicate (user_id, name) rows, keep the first by sort order. */
function dedupeStagesByName(rows: PipelineStageRow[]): PipelineStageRow[] {
  const seen = new Set<string>()
  const out: PipelineStageRow[] = []
  for (const r of [...rows].sort((a, b) => a.sort_order - b.sort_order)) {
    if (seen.has(r.name)) continue
    seen.add(r.name)
    out.push(r)
  }
  return out
}

/** Coalesce concurrent refresh() for the same user (e.g. React Strict Mode). */
const pipelineStagesInFlight = new Map<string, Promise<void>>()

const DEFAULT_STAGES: Omit<PipelineStageRow, 'id' | 'user_id' | 'created_at'>[] =
  [
    {
      name: 'enquiry',
      label: 'Enquiry',
      colour: '#64748b',
      sort_order: 0,
      is_default: true,
    },
    {
      name: 'call_booked',
      label: 'Call Booked',
      colour: '#2563eb',
      sort_order: 1,
      is_default: false,
    },
    {
      name: 'proposal_sent',
      label: 'Proposal Sent',
      colour: '#d97706',
      sort_order: 2,
      is_default: false,
    },
    {
      name: 'won',
      label: 'Won',
      colour: '#16a34a',
      sort_order: 3,
      is_default: false,
    },
    {
      name: 'lost',
      label: 'Lost',
      colour: '#dc2626',
      sort_order: 4,
      is_default: false,
    },
  ]

type Ctx = {
  stages: PipelineStageRow[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  labelFor: (stageName: string) => string
  metaFor: (stageName: string) => PipelineStageRow | undefined
}

const PipelineStagesContext = createContext<Ctx | null>(null)

export function PipelineStagesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const [stages, setStages] = useState<PipelineStageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setStages([])
      setLoading(false)
      return
    }

    const uid = user.id
    const pending = pipelineStagesInFlight.get(uid)
    if (pending) {
      await pending
      return
    }

    const load = (async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: fetchErr } = await supabase
          .from('pipeline_stages')
          .select(PIPELINE_STAGE_COLUMNS)
          .eq('user_id', uid)
          .order('sort_order', { ascending: true })

        if (fetchErr) {
          setError(fetchErr.message)
          return
        }

        let rows = dedupeStagesByName((data as PipelineStageRow[]) ?? [])

        if (rows.length === 0) {
          const { error: seedErr } = await supabase.from('pipeline_stages').insert(
            DEFAULT_STAGES.map((s) => ({
              ...s,
              user_id: uid,
            }))
          )
          if (seedErr) {
            setError(seedErr.message)
            return
          }
          const { data: seeded, error: againErr } = await supabase
            .from('pipeline_stages')
            .select(PIPELINE_STAGE_COLUMNS)
            .eq('user_id', uid)
            .order('sort_order', { ascending: true })
          if (againErr) {
            setError(againErr.message)
            return
          }
          rows = dedupeStagesByName((seeded as PipelineStageRow[]) ?? [])
        }

        setStages(rows)
      } finally {
        setLoading(false)
      }
    })()

    pipelineStagesInFlight.set(uid, load)
    try {
      await load
    } finally {
      pipelineStagesInFlight.delete(uid)
    }
  }, [user])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- load pipeline_stages on mount / when user changes */
    void refresh()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [refresh])

  const labelFor = useCallback(
    (stageName: string) =>
      stages.find((s) => s.name === stageName)?.label ?? stageName,
    [stages]
  )

  const metaFor = useCallback(
    (stageName: string) => stages.find((s) => s.name === stageName),
    [stages]
  )

  const value = useMemo(
    () => ({
      stages,
      loading,
      error,
      refresh,
      labelFor,
      metaFor,
    }),
    [stages, loading, error, refresh, labelFor, metaFor]
  )

  return (
    <PipelineStagesContext.Provider value={value}>
      {children}
    </PipelineStagesContext.Provider>
  )
}

export function usePipelineStages() {
  const ctx = useContext(PipelineStagesContext)
  if (!ctx) {
    throw new Error('usePipelineStages must be used within PipelineStagesProvider')
  }
  return ctx
}
