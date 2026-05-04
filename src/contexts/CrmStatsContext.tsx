/* eslint-disable react-refresh/only-export-components -- context + provider module */
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { startOfTodayIso, startOfTomorrowIso } from '../lib/followUpDates'
import { useAuth } from '../hooks/useAuth'

export type CrmStats = {
  totalEnquiries: number
  openFollowUps: number
  overdueFollowUps: number
  /** Open follow-ups due between start of today and start of tomorrow (local). */
  dueTodayFollowUps: number
}

export const CrmStatsContext = createContext<{
  stats: CrmStats
  refresh: () => Promise<void>
} | null>(null)

export function CrmStatsProvider({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const [stats, setStats] = useState<CrmStats>({
    totalEnquiries: 0,
    openFollowUps: 0,
    overdueFollowUps: 0,
    dueTodayFollowUps: 0,
  })

  const refresh = useCallback(async () => {
    if (!user) return

    const todayStart = startOfTodayIso()
    const tomorrowStart = startOfTomorrowIso()

    const [enqRes, openRes, overdueRes, dueTodayRes] = await Promise.all([
      supabase.from('enquiries').select('id', { count: 'exact', head: true }),
      supabase
        .from('follow_ups')
        .select('id', { count: 'exact', head: true })
        .eq('is_done', false),
      supabase
        .from('follow_ups')
        .select('id', { count: 'exact', head: true })
        .eq('is_done', false)
        .lt('due_at', todayStart),
      supabase
        .from('follow_ups')
        .select('id', { count: 'exact', head: true })
        .eq('is_done', false)
        .gte('due_at', todayStart)
        .lt('due_at', tomorrowStart),
    ])

    setStats({
      totalEnquiries: enqRes.count ?? 0,
      openFollowUps: openRes.count ?? 0,
      overdueFollowUps: overdueRes.count ?? 0,
      dueTodayFollowUps: dueTodayRes.count ?? 0,
    })
  }, [user])

  useEffect(() => {
    if (!user) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync counts on route and session
    void refresh()
  }, [user, pathname, refresh])

  const value = useMemo(() => ({ stats, refresh }), [stats, refresh])

  return (
    <CrmStatsContext.Provider value={value}>{children}</CrmStatsContext.Provider>
  )
}
