import type { CSSProperties } from 'react'

/** CSS rgba() from #RRGGBB for translucent fills/borders. */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '').trim()
  if (h.length !== 6) return `rgba(107, 114, 128, ${alpha})`
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Muted pill badge for dynamic pipeline colours. */
export function stageBadgeInlineStyle(
  colour: string | undefined
): CSSProperties {
  if (!colour) {
    return {
      borderColor: 'rgba(148,163,184,0.45)',
      backgroundColor: 'rgba(71,85,105,0.35)',
      color: '#e2e8f0',
    }
  }
  return {
    borderColor: hexToRgba(colour, 0.55),
    backgroundColor: hexToRgba(colour, 0.28),
    color: '#f8fafc',
  }
}
