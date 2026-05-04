import type { PipelineStageRow } from '../types/crm'

/** Resolve display label from loaded pipeline stages (fallback: raw name). */
export function labelForStageName(
  stageName: string,
  stages: Pick<PipelineStageRow, 'name' | 'label'>[]
): string {
  return stages.find((s) => s.name === stageName)?.label ?? stageName
}
