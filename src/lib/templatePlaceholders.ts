import { formatDateUk } from './dates'
import type { Enquiry } from '../types/crm'

export function todayUkDate(): string {
  const d = new Date()
  return formatDateUk(
    [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-')
  )
}

/** Replace {{name}}, {{company}}, {{email}}, {{date}}, {{next_action}} in subject and body. */
export function applyEnquiryPlaceholders(
  subject: string,
  body: string,
  enquiry: Enquiry
): { subject: string; body: string } {
  const dateStr = todayUkDate()
  const map: Record<string, string> = {
    '{{name}}': enquiry.contact_name ?? '',
    '{{company}}': enquiry.company?.trim() ?? '',
    '{{email}}': enquiry.email?.trim() ?? '',
    '{{date}}': dateStr,
    '{{next_action}}': enquiry.next_action?.trim() ?? '',
  }
  let outSub = subject
  let outBody = body
  for (const [key, val] of Object.entries(map)) {
    outSub = outSub.split(key).join(val)
    outBody = outBody.split(key).join(val)
  }
  return { subject: outSub, body: outBody }
}
