/** Stored as text; must match a row in `pipeline_stages.name` for the current user. */
export type EnquiryStage = string

/** Audit row: each stage transition (or initial stage on create). */
export interface StageHistoryRow {
  id: string
  enquiry_id: string
  user_id: string
  from_stage: EnquiryStage | null
  to_stage: EnquiryStage
  changed_at: string
}

export interface Enquiry {
  id: string
  user_id: string
  contact_name: string
  company: string | null
  email: string | null
  source: string | null
  query_summary: string | null
  stage: EnquiryStage
  next_action: string | null
  notes: string | null
  /** ISO date string `YYYY-MM-DD` from Postgres `date` */
  date_received: string | null
  created_at: string
  updated_at: string
}

/** Enquiry row when loaded with nested stage history (enquiry log list). */
export type EnquiryWithHistory = Enquiry & {
  stage_history?: StageHistoryRow[] | null
}

export type FollowUpPriority = 'high' | 'medium' | 'low'

export interface FollowUp {
  id: string
  user_id: string
  enquiry_id: string
  contact_name: string | null
  due_at: string
  action_text: string
  notes: string | null
  /** Matches DB `priority`; omit or invalid → treat as medium */
  priority?: FollowUpPriority | string | null
  is_done: boolean
  created_at: string
  updated_at: string
}

export interface FollowUpWithEnquiry extends FollowUp {
  enquiry?: Pick<Enquiry, 'id' | 'contact_name' | 'company'> | null
}

/** Matches Supabase `pipeline_stages` (no `updated_at` column). */
export interface PipelineStageRow {
  id: string
  user_id: string
  name: string
  label: string
  colour: string
  sort_order: number
  is_default: boolean
  created_at: string
}

/** Matches Supabase `email_templates`. */
export interface EmailTemplate {
  id: string
  user_id: string
  parent_id: string | null
  name: string
  subject: string
  body: string
  category: string | null
  sort_order: number
  level: number
  created_at: string
  updated_at: string
}
