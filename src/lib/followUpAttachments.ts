import { FOLLOW_UP_ATTACHMENT_COLUMNS } from '../constants/supabaseColumns'
import { supabase } from './supabase'
import type { FollowUpAttachment } from '../types/crm'

export const FOLLOW_UP_FILES_BUCKET = 'follow-up-files'

export const MAX_FOLLOW_UP_FILE_BYTES = 25 * 1024 * 1024

const EXTENSION_MIME: Record<string, string[]> = {
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  xls: ['application/vnd.ms-excel'],
  xlsx: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  gif: ['image/gif'],
  webp: ['image/webp'],
}

export const ALLOWED_FOLLOW_UP_EXTENSIONS = Object.keys(EXTENSION_MIME)

export type FollowUpFileValidation =
  | { ok: true }
  | { ok: false; message: string }

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const FOLLOW_UP_ATTACHMENT_HELP_TEXT = `Upload PDF, Word, Excel, PowerPoint, or common images. Maximum ${formatFileSize(MAX_FOLLOW_UP_FILE_BYTES)} per file.`

export function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, '_').trim()
  return base.length > 0 ? base.slice(0, 180) : 'file'
}

export function fileExtension(name: string): string {
  const i = name.lastIndexOf('.')
  if (i < 1 || i === name.length - 1) return ''
  return name.slice(i + 1).toLowerCase()
}

export function validateFollowUpFile(file: File): FollowUpFileValidation {
  if (file.size <= 0) {
    return { ok: false, message: 'File is empty.' }
  }
  if (file.size > MAX_FOLLOW_UP_FILE_BYTES) {
    return {
      ok: false,
      message: `File is too large (max ${formatFileSize(MAX_FOLLOW_UP_FILE_BYTES)}).`,
    }
  }
  const ext = fileExtension(file.name)
  if (!ext || !ALLOWED_FOLLOW_UP_EXTENSIONS.includes(ext)) {
    return {
      ok: false,
      message:
        'File type not allowed. Use PDF, Word, Excel, PowerPoint, or common images.',
    }
  }
  const mime = file.type || ''
  const allowedMimes = EXTENSION_MIME[ext]
  if (mime && !allowedMimes.includes(mime)) {
    return { ok: false, message: 'File type does not match its extension.' }
  }
  return { ok: true }
}

export function buildFollowUpStoragePath(
  userId: string,
  enquiryId: string,
  followUpId: string,
  attachmentId: string,
  fileName: string
): string {
  return `${userId}/${enquiryId}/${followUpId}/${attachmentId}-${sanitizeFileName(fileName)}`
}

export async function listFollowUpAttachments(
  followUpId: string
): Promise<FollowUpAttachment[]> {
  const { data, error } = await supabase
    .from('follow_up_attachments')
    .select(FOLLOW_UP_ATTACHMENT_COLUMNS)
    .eq('follow_up_id', followUpId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as FollowUpAttachment[]
}

export async function countAttachmentsByFollowUpIds(
  followUpIds: string[]
): Promise<Record<string, number>> {
  if (followUpIds.length === 0) return {}
  const { data, error } = await supabase
    .from('follow_up_attachments')
    .select('follow_up_id')
    .in('follow_up_id', followUpIds)

  if (error) throw new Error(error.message)
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const id = row.follow_up_id as string
    counts[id] = (counts[id] ?? 0) + 1
  }
  return counts
}

export async function uploadFollowUpAttachment(
  params: {
    userId: string
    enquiryId: string
    followUpId: string
    file: File
  }
): Promise<FollowUpAttachment> {
  const validation = validateFollowUpFile(params.file)
  if (!validation.ok) throw new Error(validation.message)

  const attachmentId = crypto.randomUUID()
  const storagePath = buildFollowUpStoragePath(
    params.userId,
    params.enquiryId,
    params.followUpId,
    attachmentId,
    params.file.name
  )

  const { error: uploadError } = await supabase.storage
    .from(FOLLOW_UP_FILES_BUCKET)
    .upload(storagePath, params.file, {
      cacheControl: '3600',
      upsert: false,
      contentType: params.file.type || undefined,
    })

  if (uploadError) throw new Error(uploadError.message)

  const { data, error: insertError } = await supabase
    .from('follow_up_attachments')
    .insert({
      id: attachmentId,
      user_id: params.userId,
      enquiry_id: params.enquiryId,
      follow_up_id: params.followUpId,
      storage_path: storagePath,
      file_name: sanitizeFileName(params.file.name),
      mime_type: params.file.type || EXTENSION_MIME[fileExtension(params.file.name)]?.[0] || 'application/octet-stream',
      size_bytes: params.file.size,
    })
    .select(FOLLOW_UP_ATTACHMENT_COLUMNS)
    .single()

  if (insertError) {
    await supabase.storage.from(FOLLOW_UP_FILES_BUCKET).remove([storagePath])
    throw new Error(insertError.message)
  }

  return data as FollowUpAttachment
}

export async function deleteFollowUpAttachment(
  attachment: Pick<FollowUpAttachment, 'id' | 'storage_path'>
): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(FOLLOW_UP_FILES_BUCKET)
    .remove([attachment.storage_path])

  if (storageError) throw new Error(storageError.message)

  const { error: dbError } = await supabase
    .from('follow_up_attachments')
    .delete()
    .eq('id', attachment.id)

  if (dbError) throw new Error(dbError.message)
}

export async function deleteAllFollowUpAttachments(
  followUpId: string
): Promise<void> {
  const attachments = await listFollowUpAttachments(followUpId)
  if (attachments.length === 0) return

  const paths = attachments.map((a) => a.storage_path)
  const { error: storageError } = await supabase.storage
    .from(FOLLOW_UP_FILES_BUCKET)
    .remove(paths)

  if (storageError) throw new Error(storageError.message)

  const { error: dbError } = await supabase
    .from('follow_up_attachments')
    .delete()
    .eq('follow_up_id', followUpId)

  if (dbError) throw new Error(dbError.message)
}

export async function getFollowUpAttachmentDownloadUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(FOLLOW_UP_FILES_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'Could not create download link.')
  }
  return data.signedUrl
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith('image/')
}
