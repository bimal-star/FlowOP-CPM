import type { Enquiry, EnquiryStage } from '../types/crm'

export type EnquiryDetailDraft = {
  contact_name: string
  company: string
  email: string
  source: string
  query_summary: string
  stage: EnquiryStage
  next_action: string
  notes: string
  date_received: string
}

function todayIsoDate(): string {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function isoDateFromEnquiry(r: Enquiry): string {
  if (r.date_received) return r.date_received.slice(0, 10)
  return todayIsoDate()
}

export function enquiryToDraft(r: Enquiry): EnquiryDetailDraft {
  return {
    contact_name: r.contact_name,
    company: r.company ?? '',
    email: r.email ?? '',
    source: r.source ?? '',
    query_summary: r.query_summary ?? '',
    stage: r.stage,
    next_action: r.next_action ?? '',
    notes: r.notes ?? '',
    date_received: isoDateFromEnquiry(r),
  }
}
