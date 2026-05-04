import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { applyEnquiryPlaceholders } from '../lib/templatePlaceholders'
import {
  flattenVisibleRows,
  getSiblings,
  hasChildren,
  maxSortOrderRoots,
  maxSortOrderUnderParent,
  reorderSiblingGroup,
} from '../lib/emailTemplateTree'
import { EMAIL_TEMPLATE_COLUMNS } from '../constants/supabaseColumns'
import { DEFAULT_EMAIL_TEMPLATE_SEEDS } from '../data/defaultEmailTemplates'
import type { EmailTemplate, Enquiry } from '../types/crm'

const fieldLabel = 'text-xs font-medium text-slate-400'
const inputClass =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-flowop-navy px-3 py-2.5 text-sm text-white outline-none transition-shadow focus:ring-2 focus:ring-flowop-green'
const textareaClass =
  'mt-1.5 min-h-[220px] w-full resize-y rounded-lg border border-white/10 bg-flowop-navy px-3 py-2.5 text-sm text-white outline-none transition-shadow focus:ring-2 focus:ring-flowop-green'

type Draft = {
  name: string
  category: string
  subject: string
  body: string
}

function emptyDraft(): Draft {
  return {
    name: '',
    category: '',
    subject: '',
    body: '',
  }
}

function sameParent(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return (a ?? null) === (b ?? null)
}

export function TemplatesPage() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [createContext, setCreateContext] = useState<{
    parentId: string | null
    level: number
  }>({ parentId: null, level: 0 })
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [populateEnquiryId, setPopulateEnquiryId] = useState<string | null>(
    null
  )
  const [populateOpen, setPopulateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set())
  const [templateDragVisibleIndex, setTemplateDragVisibleIndex] = useState<
    number | null
  >(null)
  const suppressTemplateRowClick = useRef(false)

  const loadTemplates = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: fetchErr } = await supabase
      .from('email_templates')
      .select(EMAIL_TEMPLATE_COLUMNS)

    if (fetchErr) {
      setError(fetchErr.message)
      setLoading(false)
      return
    }

    const existingTemplates = (data as EmailTemplate[]) ?? []

    if (existingTemplates.length === 0) {
      const { count, error: countErr } = await supabase
        .from('email_templates')
        .select('id', { count: 'exact', head: true })

      if (countErr) {
        setError(countErr.message)
        setLoading(false)
        return
      }

      if ((count ?? 0) > 0) {
        const { data: fresh, error: freshErr } = await supabase
          .from('email_templates')
          .select(EMAIL_TEMPLATE_COLUMNS)
        if (freshErr) {
          setError(freshErr.message)
          setLoading(false)
          return
        }
        setTemplates((fresh as EmailTemplate[]) ?? [])
        setLoading(false)
        return
      }

      const { error: seedErr } = await supabase.from('email_templates').insert(
        DEFAULT_EMAIL_TEMPLATE_SEEDS.map((row) => ({
          ...row,
          user_id: user.id,
        }))
      )
      if (seedErr) {
        setError(seedErr.message)
        setLoading(false)
        return
      }
      const { data: seeded } = await supabase
        .from('email_templates')
        .select(EMAIL_TEMPLATE_COLUMNS)
      setTemplates((seeded as EmailTemplate[]) ?? [])
      setLoading(false)
      return
    }

    setTemplates(existingTemplates)
    setLoading(false)
  }, [user])

  const loadEnquiries = useCallback(async () => {
    if (!user) return
    const { data, error: fetchErr } = await supabase
      .from('enquiries')
      .select('*')
      .order('contact_name', { ascending: true })

    if (fetchErr) {
      setError(fetchErr.message)
      return
    }
    setEnquiries((data as Enquiry[]) ?? [])
  }, [user])

  useEffect(() => {
    if (!user) return
    /* eslint-disable react-hooks/set-state-in-effect -- load templates and enquiries on mount */
    void loadTemplates()
    void loadEnquiries()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user, loadTemplates, loadEnquiries])

  const visibleRows = useMemo(
    () => flattenVisibleRows(templates, collapsedIds),
    [templates, collapsedIds]
  )

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  )

  /* eslint-disable react-hooks/set-state-in-effect -- controlled draft mirrors selected template row */
  useEffect(() => {
    if (isNew) return
    if (!selectedTemplate) {
      setDraft(emptyDraft())
      return
    }
    setDraft({
      name: selectedTemplate.name,
      category: selectedTemplate.category ?? '',
      subject: selectedTemplate.subject,
      body: selectedTemplate.body,
    })
  }, [isNew, selectedTemplate])
  /* eslint-enable react-hooks/set-state-in-effect */

  const populateEnquiry = useMemo(
    () =>
      populateEnquiryId
        ? (enquiries.find((e) => e.id === populateEnquiryId) ?? null)
        : null,
    [enquiries, populateEnquiryId]
  )

  const populated = useMemo(() => {
    if (!populateEnquiry) return null
    return applyEnquiryPlaceholders(draft.subject, draft.body, populateEnquiry)
  }, [draft.subject, draft.body, populateEnquiry])

  const persistSiblingOrder = useCallback(
    async (parentId: string | null, updatedAll: EmailTemplate[]) => {
      setTemplates(updatedAll)
      setError(null)
      const siblings = getSiblings(updatedAll, parentId)
      for (let i = 0; i < siblings.length; i++) {
        const { error: upErr } = await supabase
          .from('email_templates')
          .update({ sort_order: i })
          .eq('id', siblings[i].id)
        if (upErr) {
          setError(upErr.message)
          void loadTemplates()
          return
        }
      }
    },
    [loadTemplates]
  )

  function handleTemplateDragEnd() {
    suppressTemplateRowClick.current = true
    window.setTimeout(() => {
      suppressTemplateRowClick.current = false
    }, 120)
  }

  function handleTemplateDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleTemplateDrop(targetVisibleIndex: number) {
    if (
      templateDragVisibleIndex === null ||
      templateDragVisibleIndex === targetVisibleIndex
    ) {
      setTemplateDragVisibleIndex(null)
      return
    }
    const dragRow = visibleRows[templateDragVisibleIndex]
    const targetRow = visibleRows[targetVisibleIndex]
    if (!dragRow || !targetRow) {
      setTemplateDragVisibleIndex(null)
      return
    }
    const d = dragRow.template
    const t = targetRow.template
    if (
      !sameParent(d.parent_id, t.parent_id) ||
      d.level !== t.level
    ) {
      setTemplateDragVisibleIndex(null)
      return
    }

    const parentKey = d.parent_id ?? null
    const siblings = getSiblings(templates, parentKey)
    const fromIndex = siblings.findIndex((s) => s.id === d.id)
    const toIndex = siblings.findIndex((s) => s.id === t.id)
    if (fromIndex < 0 || toIndex < 0) {
      setTemplateDragVisibleIndex(null)
      return
    }

    const nextAll = reorderSiblingGroup(
      templates,
      parentKey,
      fromIndex,
      toIndex
    )
    setTemplateDragVisibleIndex(null)
    void persistSiblingOrder(parentKey, nextAll)
  }

  function toggleCollapsed(parentId: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(parentId)) next.delete(parentId)
      else next.add(parentId)
      return next
    })
  }

  function selectTemplate(t: EmailTemplate) {
    if (suppressTemplateRowClick.current) return
    setIsNew(false)
    setSelectedId(t.id)
    setPopulateEnquiryId(null)
    setPopulateOpen(false)
  }

  function startNew() {
    setIsNew(true)
    setSelectedId(null)
    setCreateContext({ parentId: null, level: 0 })
    setDraft(emptyDraft())
    setPopulateEnquiryId(null)
    setPopulateOpen(false)
  }

  function startNewChild(parent: EmailTemplate) {
    if (parent.level >= 2) return
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      next.delete(parent.id)
      return next
    })
    setIsNew(true)
    setSelectedId(null)
    setCreateContext({
      parentId: parent.id,
      level: parent.level + 1,
    })
    setDraft(emptyDraft())
    setPopulateEnquiryId(null)
    setPopulateOpen(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const name = draft.name.trim()
    const subject = draft.subject.trim()
    const body = draft.body.trim()
    if (!name || !subject || !body) {
      setError('Name, subject and body are required.')
      return
    }
    setSaving(true)
    setError(null)

    if (isNew) {
      const pid = createContext.parentId
      const lev = createContext.level
      const sortOrder =
        pid === null
          ? maxSortOrderRoots(templates) + 1
          : maxSortOrderUnderParent(templates, pid) + 1

      const { data, error: insErr } = await supabase
        .from('email_templates')
        .insert({
          user_id: user.id,
          parent_id: pid,
          level: lev,
          name,
          subject,
          body,
          category: draft.category.trim() || null,
          sort_order: sortOrder,
        })
        .select(EMAIL_TEMPLATE_COLUMNS)
        .single()

      setSaving(false)
      if (insErr) {
        setError(insErr.message)
        return
      }
      const row = data as EmailTemplate
      setTemplates((cur) => [...cur, row])
      setIsNew(false)
      setSelectedId(row.id)
      setCreateContext({ parentId: null, level: 0 })
      return
    }

    if (!selectedId) {
      setSaving(false)
      return
    }

    const { error: upErr } = await supabase
      .from('email_templates')
      .update({
        name,
        subject,
        body,
        category: draft.category.trim() || null,
      })
      .eq('id', selectedId)

    setSaving(false)
    if (upErr) {
      setError(upErr.message)
      return
    }
    setTemplates((cur) =>
      cur.map((t) =>
        t.id === selectedId
          ? {
              ...t,
              name,
              subject,
              body,
              category: draft.category.trim() || null,
            }
          : t
      )
    )
  }

  async function handleDelete() {
    if (!selectedId || isNew) return
    const sel = templates.find((t) => t.id === selectedId)
    if (!sel) return

    let msg: string
    if (sel.level === 0) {
      msg =
        'This will also delete all child and sub-child templates. Are you sure?'
    } else if (sel.level === 1) {
      msg = 'This will also delete all sub-child templates. Are you sure?'
    } else {
      msg = 'Delete this template? This cannot be undone.'
    }

    if (!window.confirm(msg)) {
      return
    }
    setDeleting(true)
    setError(null)
    const { error: delErr } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', selectedId)
    setDeleting(false)
    if (delErr) {
      setError(delErr.message)
      return
    }
    await loadTemplates()
    setSelectedId(null)
    setDraft(emptyDraft())
  }

  async function copyBody() {
    const text = populated?.body ?? ''
    if (!text.trim()) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      setError('Could not copy to clipboard.')
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="shrink-0 space-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-white">
          Templates
        </h1>
        <p className="text-sm leading-snug text-slate-400">
          Email templates with placeholders. Save changes to Supabase; copy a
          populated body after choosing an enquiry.
        </p>
      </header>

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        <aside className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-flowop-navy-light/50 lg:col-span-4">
          <div className="shrink-0 border-b border-white/10 px-4 py-3">
            <button
              type="button"
              onClick={startNew}
              className="w-full rounded-lg bg-flowop-green px-3 py-2 text-sm font-medium text-white hover:bg-flowop-green-hover"
            >
              Add new template
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading ? (
              <p className="px-2 py-4 text-sm text-slate-500">Loading…</p>
            ) : templates.length === 0 ? (
              <p className="px-2 py-4 text-sm text-slate-500">
                No templates yet.
              </p>
            ) : (
              <ul className="space-y-1">
                {visibleRows.map(({ template: t, depth }, index) => {
                  const active = !isNew && selectedId === t.id
                  const kids = hasChildren(templates, t.id)
                  const collapsed = collapsedIds.has(t.id)
                  const borderClass =
                    depth === 1
                      ? 'border-l-2 border-flowop-green pl-2'
                      : depth === 2
                        ? 'border-l-2 border-flowop-green/40 pl-2'
                        : ''
                  const indentClass =
                    depth === 0 ? '' : depth === 1 ? 'ml-1' : 'ml-4'

                  return (
                    <li
                      key={t.id}
                      draggable
                      onDragStart={() => setTemplateDragVisibleIndex(index)}
                      onDragOver={handleTemplateDragOver}
                      onDrop={() => handleTemplateDrop(index)}
                      onDragEnd={handleTemplateDragEnd}
                      className={`cursor-grab rounded-lg active:cursor-grabbing ${indentClass} ${borderClass}`}
                    >
                      <div className="flex items-stretch gap-1">
                        <div className="flex w-6 shrink-0 items-center justify-center">
                          {kids ? (
                            <button
                              type="button"
                              aria-expanded={!collapsed}
                              aria-label={
                                collapsed ? 'Expand children' : 'Collapse children'
                              }
                              className="rounded p-0.5 text-slate-400 hover:bg-white/10 hover:text-white"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleCollapsed(t.id)
                              }}
                            >
                              <span className="sr-only">
                                {collapsed ? 'Expand' : 'Collapse'}
                              </span>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                                className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-90'}`}
                              >
                                <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06z" />
                              </svg>
                            </button>
                          ) : (
                            <span className="inline-block w-4" aria-hidden />
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => selectTemplate(t)}
                              className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
                                active
                                  ? 'bg-flowop-green/25 ring-1 ring-flowop-green/50'
                                  : 'hover:bg-white/5'
                              }`}
                            >
                              <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                                {t.name}
                              </span>
                              {t.category?.trim() ? (
                                <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                  {t.category.trim()}
                                </span>
                              ) : null}
                            </button>
                            {t.level < 2 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startNewChild(t)
                                }}
                                className="shrink-0 rounded border border-white/20 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:border-flowop-green/50 hover:text-flowop-green"
                              >
                                Add child
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-flowop-navy-light/50 lg:col-span-8">
          {!isNew && !selectedId ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center text-sm text-slate-500">
              Select a template or add a new one.
            </div>
          ) : (
            <form
              onSubmit={(e) => void handleSave(e)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setPopulateOpen((o) => !o)}
                      className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 hover:border-white/25 hover:text-white"
                    >
                      Auto-populate
                    </button>
                    {populateOpen ? (
                      <div className="absolute left-0 z-20 mt-1 max-h-56 min-w-[min(100vw-2rem,280px)] overflow-y-auto rounded-lg border border-white/15 bg-flowop-navy py-1 shadow-xl">
                        {enquiries.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-slate-500">
                            No enquiries yet.
                          </p>
                        ) : (
                          enquiries.map((en) => (
                            <button
                              key={en.id}
                              type="button"
                              onClick={() => {
                                setPopulateEnquiryId(en.id)
                                setPopulateOpen(false)
                              }}
                              className="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/10"
                            >
                              <span className="font-medium text-white">
                                {en.contact_name}
                              </span>
                              {en.company?.trim()
                                ? ` — ${en.company.trim()}`
                                : ''}
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={!populated?.body.trim()}
                    onClick={() => void copyBody()}
                    className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Copy to clipboard
                  </button>
                  {!isNew && selectedId ? (
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => void handleDelete()}
                      className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-200 hover:border-red-400/60 disabled:opacity-50"
                    >
                      {deleting ? 'Deleting…' : 'Delete template'}
                    </button>
                  ) : null}
                </div>

                {populateEnquiry ? (
                  <div className="rounded-lg border border-white/10 bg-flowop-navy/50 px-3 py-2 text-xs text-slate-400">
                    Preview for{' '}
                    <span className="font-medium text-slate-200">
                      {populateEnquiry.contact_name}
                    </span>
                    {populateEnquiry.company?.trim()
                      ? ` (${populateEnquiry.company.trim()})`
                      : ''}
                    . Copy uses the preview body; editor above still holds the
                    template with placeholders.
                  </div>
                ) : null}

                <label className="block">
                  <span className={fieldLabel}>Name</span>
                  <input
                    required
                    value={draft.name}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, name: e.target.value }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className={fieldLabel}>Category</span>
                  <input
                    value={draft.category}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, category: e.target.value }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className={fieldLabel}>Subject</span>
                  <input
                    required
                    value={draft.subject}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, subject: e.target.value }))
                    }
                    className={inputClass}
                  />
                </label>
                {populated ? (
                  <div className="rounded-lg border border-dashed border-white/15 bg-flowop-navy/30 px-3 py-2">
                    <p className={fieldLabel}>Preview subject</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {populated.subject}
                    </p>
                  </div>
                ) : null}
                <label className="block">
                  <span className={fieldLabel}>Body (placeholders)</span>
                  <textarea
                    required
                    value={draft.body}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, body: e.target.value }))
                    }
                    className={textareaClass}
                  />
                </label>
                {populated ? (
                  <div className="rounded-lg border border-dashed border-white/15 bg-flowop-navy/30 px-3 py-2">
                    <p className={fieldLabel}>Preview body</p>
                    <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words font-sans text-sm text-slate-200">
                      {populated.body}
                    </pre>
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 border-t border-white/10 px-4 py-3 sm:px-5">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-flowop-green px-4 py-2 text-sm font-medium text-white hover:bg-flowop-green-hover disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save template'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}
