import { useLayoutEffect, useRef, useState } from 'react'

const fieldLabel = 'text-xs font-medium text-slate-400'

/** Fixed-height textarea, non-resizable; Show more/less when content overflows. */
export function ExpandableFormTextarea({
  label,
  value,
  onChange,
  collapsedHeightClass,
  inputClassName = '',
  colSpanClass = 'sm:col-span-2',
}: {
  label: string
  value: string
  onChange: (next: string) => void
  collapsedHeightClass: string
  inputClassName?: string
  colSpanClass?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [showToggle, setShowToggle] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    /* eslint-disable react-hooks/set-state-in-effect -- overflow check after fixed height */
    if (expanded) {
      setShowToggle(true)
      return
    }
    setShowToggle(el.scrollHeight > el.clientHeight)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [value, expanded])

  return (
    <label className={`block w-full min-w-0 ${colSpanClass}`}>
      <span className={fieldLabel}>{label}</span>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ resize: 'none' }}
        className={`${inputClassName} resize-none ${
          expanded
            ? 'min-h-[12rem] max-h-[min(70vh,28rem)] overflow-y-auto'
            : `${collapsedHeightClass} overflow-y-auto`
        }`}
      />
      {showToggle ? (
        <button
          type="button"
          className="mt-1.5 text-xs font-medium text-flowop-green hover:text-flowop-green-hover hover:underline"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </label>
  )
}
