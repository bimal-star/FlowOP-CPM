import type { EmailTemplate } from '../types/crm'

function sameParent(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return (a ?? null) === (b ?? null)
}

/** Direct children of `parentId` (null = root), ordered by sort_order then name. */
export function getSiblings(
  all: EmailTemplate[],
  parentId: string | null
): EmailTemplate[] {
  return all
    .filter((t) => sameParent(t.parent_id, parentId))
    .sort((a, b) => {
      const o = (a.sort_order ?? 0) - (b.sort_order ?? 0)
      if (o !== 0) return o
      return a.name.localeCompare(b.name)
    })
}

export function hasChildren(all: EmailTemplate[], id: string): boolean {
  return all.some((t) => t.parent_id === id)
}

/** Visible rows in tree order; `collapsed` = parent ids whose children are hidden. */
export function flattenVisibleRows(
  all: EmailTemplate[],
  collapsed: Set<string>
): { template: EmailTemplate; depth: number }[] {
  const out: { template: EmailTemplate; depth: number }[] = []

  function walk(parentId: string | null, depth: number) {
    const siblings = getSiblings(all, parentId)
    for (const t of siblings) {
      out.push({ template: t, depth })
      if (hasChildren(all, t.id) && !collapsed.has(t.id)) {
        walk(t.id, depth + 1)
      }
    }
  }

  walk(null, 0)
  return out
}

/**
 * Reorder siblings only: `fromIndex` / `toIndex` are indices within
 * getSiblings(all, parentId). Returns full list with updated sort_order for that group.
 */
export function reorderSiblingGroup(
  all: EmailTemplate[],
  parentId: string | null,
  fromIndex: number,
  toIndex: number
): EmailTemplate[] {
  const siblings = getSiblings(all, parentId)
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= siblings.length ||
    toIndex >= siblings.length
  ) {
    return all
  }
  if (fromIndex === toIndex) return all

  const next = [...siblings]
  const [removed] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, removed)
  const reindexed = next.map((t, i) => ({ ...t, sort_order: i }))
  const idSet = new Set(siblings.map((s) => s.id))
  const others = all.filter((t) => !idSet.has(t.id))
  return [...others, ...reindexed]
}

/** Next sort_order among roots (parent_id null). */
export function maxSortOrderRoots(all: EmailTemplate[]): number {
  return getSiblings(all, null).reduce(
    (m, t) => Math.max(m, t.sort_order ?? 0),
    -1
  )
}

/** Next sort_order among children of `parentId`. */
export function maxSortOrderUnderParent(
  all: EmailTemplate[],
  parentId: string
): number {
  return getSiblings(all, parentId).reduce(
    (m, t) => Math.max(m, t.sort_order ?? 0),
    -1
  )
}
