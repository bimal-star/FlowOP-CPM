import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../hooks/useAuth'
import {
  ALLOWED_FOLLOW_UP_EXTENSIONS,
  deleteFollowUpAttachment,
  FOLLOW_UP_ATTACHMENT_HELP_TEXT,
  formatFileSize,
  getFollowUpAttachmentDownloadUrl,
  isImageMime,
  listFollowUpAttachments,
  uploadFollowUpAttachment,
} from '../lib/followUpAttachments'
import type { FollowUpAttachment } from '../types/crm'
import {
  FollowUpActionIconButton,
  IconDownload,
  IconEye,
  IconPlus,
  IconTrash,
  IconX,
} from './FollowUpActionIconButton'
import { HelpHint } from './HelpHint'

const acceptList = ALLOWED_FOLLOW_UP_EXTENSIONS.map((ext) => `.${ext}`).join(',')
const fileBadgeWidthClass = 'w-[6.75rem]'

type Props = {
  enquiryId: string
  followUpId: string
  editable?: boolean
  onMutate?: () => void
  onError?: (message: string | null) => void
  onClose?: () => void
}

function fileExtLabel(name: string): string {
  if (!name.includes('.')) return 'file'
  return name.split('.').pop()?.slice(0, 4) ?? 'file'
}

function FileActionButton({
  label,
  onClick,
  disabled = false,
  danger = false,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-6 w-6 items-center justify-center rounded transition-colors disabled:opacity-50 ${
        danger
          ? 'text-red-300 hover:bg-red-950/60'
          : 'text-white hover:bg-white/15'
      }`}
    >
      {children}
    </button>
  )
}

export function FollowUpAttachmentsPanel({
  enquiryId,
  followUpId,
  editable = true,
  onMutate,
  onError,
  onClose,
}: Props) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const [attachments, setAttachments] = useState<FollowUpAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [viewingImage, setViewingImage] = useState<{
    url: string
    name: string
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listFollowUpAttachments(followUpId)
      setAttachments(list)
      onErrorRef.current?.(null)

      const urls: Record<string, string> = {}
      await Promise.all(
        list
          .filter((a) => isImageMime(a.mime_type))
          .map(async (a) => {
            try {
              urls[a.id] = await getFollowUpAttachmentDownloadUrl(a.storage_path)
            } catch {
              /* preview optional */
            }
          })
      )
      setPreviewUrls(urls)
    } catch (e) {
      onErrorRef.current?.(
        e instanceof Error ? e.message : 'Could not load attachments.'
      )
    } finally {
      setLoading(false)
    }
  }, [followUpId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!viewingImage) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setViewingImage(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [viewingImage])

  async function handleFilesSelected(files: FileList | null) {
    if (!files?.length || !user) return
    setUploading(true)
    onErrorRef.current?.(null)
    try {
      for (const file of Array.from(files)) {
        await uploadFollowUpAttachment({
          userId: user.id,
          enquiryId,
          followUpId,
          file,
        })
      }
      await load()
      onMutate?.()
    } catch (e) {
      onErrorRef.current?.(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDownload(attachment: FollowUpAttachment) {
    onErrorRef.current?.(null)
    try {
      const url = await getFollowUpAttachmentDownloadUrl(attachment.storage_path)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.file_name
      a.rel = 'noopener noreferrer'
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) {
      onErrorRef.current?.(e instanceof Error ? e.message : 'Download failed.')
    }
  }

  async function handleViewImage(attachment: FollowUpAttachment) {
    onErrorRef.current?.(null)
    try {
      const url =
        previewUrls[attachment.id] ??
        (await getFollowUpAttachmentDownloadUrl(attachment.storage_path))
      setViewingImage({ url, name: attachment.file_name })
    } catch (e) {
      onErrorRef.current?.(e instanceof Error ? e.message : 'Could not open image.')
    }
  }

  async function handleDelete(attachment: FollowUpAttachment) {
    if (
      !window.confirm(`Remove "${attachment.file_name}"? This cannot be undone.`)
    ) {
      return
    }
    setDeletingId(attachment.id)
    onErrorRef.current?.(null)
    try {
      await deleteFollowUpAttachment(attachment)
      await load()
      onMutate?.()
    } catch (e) {
      onErrorRef.current?.(e instanceof Error ? e.message : 'Could not delete file.')
    } finally {
      setDeletingId(null)
    }
  }

  function renderFileActions(a: FollowUpAttachment, isImage: boolean) {
    return (
      <div className="flex items-center justify-center gap-0.5">
        {isImage ? (
          <FileActionButton
            label={`View ${a.file_name}`}
            onClick={() => void handleViewImage(a)}
          >
            <IconEye className="h-3.5 w-3.5" />
          </FileActionButton>
        ) : null}
        <FileActionButton
          label={`Download ${a.file_name}`}
          onClick={() => void handleDownload(a)}
        >
          <IconDownload className="h-3.5 w-3.5" />
        </FileActionButton>
        {editable ? (
          <FileActionButton
            label={`Remove ${a.file_name}`}
            danger
            disabled={deletingId === a.id}
            onClick={() => void handleDelete(a)}
          >
            <IconTrash className="h-3.5 w-3.5" />
          </FileActionButton>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded border border-white/10 bg-flowop-navy/50 p-1.5">
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex shrink-0 flex-col items-start gap-1">
            <div className="flex items-center gap-1">
              <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Files
                {!loading && attachments.length > 0 ? (
                  <span className="ml-1 font-normal normal-case text-slate-400">
                    ({attachments.length})
                  </span>
                ) : null}
              </p>
              {editable ? (
                <HelpHint
                  text={FOLLOW_UP_ATTACHMENT_HELP_TEXT}
                  label="Attachment upload help"
                  placement="top"
                />
              ) : null}
            </div>
            {editable ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={acceptList}
                  className="sr-only"
                  onChange={(e) => void handleFilesSelected(e.target.files)}
                />
                <FollowUpActionIconButton
                  label={uploading ? 'Uploading…' : 'Add file'}
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <IconPlus />
                </FollowUpActionIconButton>
              </>
            ) : null}
          </div>

          <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
            {loading ? (
              <p className="text-[10px] text-slate-500">Loading…</p>
            ) : attachments.length === 0 ? (
              <p className="text-[10px] text-slate-600">No files.</p>
            ) : (
              <table className="w-max border-collapse text-left">
                <tbody>
                  <tr>
                    {attachments.map((a) => {
                      const isImage = isImageMime(a.mime_type)
                      const imageUrl = previewUrls[a.id]

                      return (
                        <td
                          key={a.id}
                          className={`group relative px-0.5 align-bottom first:pl-0 last:pr-0 ${fileBadgeWidthClass}`}
                        >
                          <div
                            className={`relative flex flex-col items-center ${fileBadgeWidthClass}`}
                            title={a.file_name}
                          >
                            {isImage && imageUrl ? (
                              <>
                                <span
                                  className={`flex h-9 ${fileBadgeWidthClass} items-center justify-center rounded bg-white/5 text-[9px] font-semibold uppercase text-slate-400 ring-1 ring-white/10 transition-opacity group-hover:invisible`}
                                  aria-hidden
                                >
                                  img
                                </span>
                                <span className="mt-0.5 text-[8px] leading-none tabular-nums text-slate-500 transition-opacity group-hover:invisible">
                                  {formatFileSize(a.size_bytes)}
                                </span>
                                <div className="pointer-events-none absolute bottom-0 left-1/2 z-30 -translate-x-1/2 opacity-0 transition-all duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                                  <div className="relative -translate-y-1">
                                    <img
                                      src={imageUrl}
                                      alt={a.file_name}
                                      className="h-28 w-28 rounded-lg object-cover shadow-xl ring-1 ring-white/20"
                                    />
                                    <div className="absolute inset-x-0 bottom-0 flex justify-center rounded-b-lg bg-gradient-to-t from-black/85 via-black/50 to-transparent px-1 pb-1 pt-6">
                                      {renderFileActions(a, true)}
                                    </div>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className={`relative ${fileBadgeWidthClass}`}>
                                <span
                                  className={`flex h-9 ${fileBadgeWidthClass} items-center justify-center rounded bg-white/5 text-[9px] font-semibold uppercase text-slate-400 ring-1 ring-white/10`}
                                >
                                  {fileExtLabel(a.file_name)}
                                </span>
                                <span className="mt-0.5 block text-center text-[8px] leading-none tabular-nums text-slate-500">
                                  {formatFileSize(a.size_bytes)}
                                </span>
                                <div className="absolute inset-0 top-0 flex h-9 items-center justify-center rounded bg-black/75 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                  {renderFileActions(a, false)}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {onClose ? (
            <FollowUpActionIconButton
              label="Close attachments"
              onClick={onClose}
            >
              <IconX />
            </FollowUpActionIconButton>
          ) : null}
        </div>
      </div>

      {viewingImage
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
              role="dialog"
              aria-modal="true"
              aria-label={`Viewing ${viewingImage.name}`}
              onClick={() => setViewingImage(null)}
            >
              <div
                className="relative max-h-[min(90vh,720px)] max-w-[min(92vw,960px)]"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setViewingImage(null)}
                  className="absolute -right-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-flowop-navy text-slate-200 hover:text-white"
                  aria-label="Close image preview"
                >
                  <IconX className="h-3.5 w-3.5" />
                </button>
                <img
                  src={viewingImage.url}
                  alt={viewingImage.name}
                  className="max-h-[min(90vh,720px)] max-w-[min(92vw,960px)] rounded-lg object-contain ring-1 ring-white/15"
                />
                <p className="mt-2 truncate text-center text-xs text-slate-300">
                  {viewingImage.name}
                </p>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
