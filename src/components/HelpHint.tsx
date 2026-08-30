import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  text: string
  label?: string
  placement?: 'top' | 'bottom'
  className?: string
}

type TooltipPos = {
  left: number
  top: number
  maxWidth: number
}

export function HelpHint({
  text,
  label = 'More information',
  placement = 'bottom',
  className = '',
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<TooltipPos | null>(null)

  const updatePosition = useCallback(() => {
    const btn = btnRef.current
    const tip = tooltipRef.current
    if (!btn || !tip) return

    const rect = btn.getBoundingClientRect()
    const tipRect = tip.getBoundingClientRect()
    const padding = 8
    const maxWidth = Math.min(256, window.innerWidth - padding * 2)

    let left = rect.left + rect.width / 2 - tipRect.width / 2
    left = Math.max(padding, Math.min(left, window.innerWidth - padding - tipRect.width))

    const top =
      placement === 'top'
        ? rect.top - tipRect.height - 6
        : rect.bottom + 6

    setPos({ left, top, maxWidth })
  }, [placement])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    updatePosition()
  }, [open, text, placement, updatePosition])

  return (
    <>
      <span className={`inline-flex shrink-0 align-middle ${className}`}>
        <button
          ref={btnRef}
          type="button"
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-white/5 text-[10px] font-bold leading-none text-slate-400 transition-colors hover:border-flowop-green/40 hover:bg-white/10 hover:text-slate-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-flowop-green/50"
          aria-label={label}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        >
          ?
        </button>
      </span>

      {open
        ? createPortal(
            <span
              ref={tooltipRef}
              role="tooltip"
              className="pointer-events-none fixed z-[250] rounded-md border border-white/10 bg-flowop-navy px-2 py-1.5 text-left text-[11px] font-normal leading-snug text-slate-300 shadow-lg"
              style={{
                left: pos?.left ?? 0,
                top: pos?.top ?? 0,
                maxWidth: pos?.maxWidth ?? Math.min(256, window.innerWidth - 16),
                visibility: pos ? 'visible' : 'hidden',
              }}
            >
              {text}
            </span>,
            document.body
          )
        : null}
    </>
  )
}
