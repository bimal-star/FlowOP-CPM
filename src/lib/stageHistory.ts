import type { EnquiryStage } from '../types/crm'

/** e.g. 04/05/2026 at 10:23 */
export function formatStageChangedAt(iso: string): string {
  try {
    const d = new Date(iso)
    const datePart = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    const timePart = d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    return `${datePart} at ${timePart}`
  } catch {
    return iso
  }
}

/** "Enquiry → Call Booked — 04/05/2026 at 10:23" or initial row when from_stage is null. */
export function formatStageHistoryLine(
  fromStage: EnquiryStage | null,
  toStage: EnquiryStage,
  changedAt: string,
  labelOf: (stageName: string) => string
): string {
  const when = formatStageChangedAt(changedAt)
  if (fromStage === null) {
    return `${labelOf(toStage)} — ${when}`
  }
  return `${labelOf(fromStage)} → ${labelOf(toStage)} — ${when}`
}
