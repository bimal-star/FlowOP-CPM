import { useContext } from 'react'
import { CrmStatsContext } from '../contexts/CrmStatsContext'

export function useCrmStats() {
  const ctx = useContext(CrmStatsContext)
  if (!ctx) {
    throw new Error('useCrmStats must be used within CrmStatsProvider')
  }
  return ctx
}
