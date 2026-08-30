/**
 * Column lists for Supabase `.select()` — align with:
 * - `email_templates`: id, user_id, parent_id, name, subject, body, category, sort_order, level, created_at, updated_at
 * - `pipeline_stages`: id, user_id, name, label, colour, sort_order, is_default, created_at
 */
export const EMAIL_TEMPLATE_COLUMNS =
  'id, user_id, parent_id, name, subject, body, category, sort_order, level, created_at, updated_at' as const

export const PIPELINE_STAGE_COLUMNS =
  'id, user_id, name, label, colour, sort_order, is_default, created_at' as const

export const FOLLOW_UP_ATTACHMENT_COLUMNS =
  'id, user_id, enquiry_id, follow_up_id, storage_path, file_name, mime_type, size_bytes, created_at' as const
