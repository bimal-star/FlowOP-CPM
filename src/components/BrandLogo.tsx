import { useState } from 'react'

/** Local asset in `public/`; override with `VITE_BRAND_LOGO_URL` if needed */
const LOGO_SRC =
  import.meta.env.VITE_BRAND_LOGO_URL ?? '/Logo_B_On_W-removebg-preview.png'

/** Light mark on dark UI; subtle shadow for edge definition (transparent PNG) */
const ON_DARK_IMG_CLASS = 'drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)]'

/** Wordmark when the image fails to load */
function LogoInlineFallback({ className }: { className?: string }) {
  return (
    <div
      className={`flex shrink-0 flex-col justify-center leading-none ${className ?? ''}`}
      role="img"
      aria-label="FlowOP Solutions"
    >
      <span className="text-2xl font-bold tracking-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] sm:text-[1.65rem]">
        Flow<span className="text-flowop-green">OP</span>
      </span>
      <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-300">
        Solutions
      </span>
    </div>
  )
}

/** Taller default mark; lots of empty padding inside the asset file */
const DEFAULT_IMG_CLASS =
  `h-16 w-auto min-h-16 max-h-16 max-w-[min(320px,88vw)] shrink-0 object-contain object-left [image-rendering:auto] ${ON_DARK_IMG_CLASS}`

export function BrandLogo({ className }: { className?: string }) {
  const [useFallback, setUseFallback] = useState(false)

  if (useFallback) {
    return <LogoInlineFallback className={className} />
  }

  const mergedClass = [DEFAULT_IMG_CLASS, className].filter(Boolean).join(' ')

  return (
    <img
      src={LOGO_SRC}
      alt="FlowOP Solutions"
      width={280}
      height={64}
      className={mergedClass}
      loading="eager"
      decoding="async"
      onError={() => setUseFallback(true)}
    />
  )
}
