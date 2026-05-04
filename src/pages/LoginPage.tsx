import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { BrandLogo } from '../components/BrandLogo'
import { LoginTimelineSvg } from '../components/LoginTimelineSvg'

const FEATURE_CARDS: { title: string; description: string }[] = [
  {
    title: 'Pipeline visibility',
    description: 'Always know where every conversation stands',
  },
  {
    title: 'Follow-up discipline',
    description:
      'Never miss a follow-up with priority and due date tracking',
  },
  {
    title: 'Consistent communication',
    description: 'Templates ready to personalise and send in seconds',
  },
]

export function LoginPage() {
  const { session, loading, signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) {
    return <Navigate to="/enquiries" replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: err } = await signIn(email, password)
    setSubmitting(false)
    if (err) {
      setError(err.message || 'Could not sign in')
    }
  }

  const inputClass =
    'mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition-shadow focus:border-flowop-green/50 focus:ring-2 focus:ring-flowop-green/30'

  const labelClass = 'text-xs font-medium text-slate-400'

  return (
    <div className="flex min-h-dvh flex-col bg-[#1a2332] lg:flex-row">
      {/* Column 1 — login */}
      <section className="flex w-full shrink-0 flex-col bg-[#1a2332] lg:min-h-dvh lg:w-[35%]">
        <div className="flex min-h-[min(50dvh,420px)] flex-1 flex-col items-center justify-center px-6 py-10 lg:min-h-0 lg:px-8 lg:py-12">
          <div className="flex w-full max-w-[320px] flex-col items-center">
            <BrandLogo className="h-20 w-auto max-h-20 max-w-[min(380px,92vw)] shrink-0 object-contain object-center" />
            <p className="mt-3 text-center text-sm font-medium tracking-wide text-slate-400">
              Client Pipeline Manager
            </p>
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="mt-8 w-full lg:mt-10"
            >
              <label className="block">
                <span className={labelClass}>Username</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputClass}
                />
              </label>
              <label className="mt-4 block">
                <span className={labelClass}>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={inputClass}
                />
              </label>

              {error ? (
                <p className="mt-3 text-center text-sm text-red-400" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting || loading}
                className="mt-8 w-full rounded-lg bg-flowop-green py-3 text-sm font-semibold text-white shadow-lg shadow-flowop-green/20 transition-colors hover:bg-flowop-green-hover disabled:opacity-50"
              >
                {submitting ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Column 2 — timeline, feature cards, footer */}
      <section className="flex w-full min-h-0 flex-1 flex-col bg-[#1e2a38] lg:min-h-dvh lg:w-[65%] lg:shrink-0 lg:border-l lg:border-white/5">
        <div className="flex min-h-0 flex-1 flex-col px-5 py-8 lg:min-h-dvh lg:px-10 lg:py-8">
          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-8 lg:gap-10">
            <div className="flex w-full max-h-[min(58vh,560px)] max-w-2xl shrink-0 flex-col items-center justify-center">
              <LoginTimelineSvg />
            </div>

            <div className="grid w-full min-w-0 max-w-4xl shrink-0 grid-cols-3 gap-3 lg:gap-4">
              {FEATURE_CARDS.map((card) => (
                <div
                  key={card.title}
                  className="min-w-0 rounded-lg border border-white/10 bg-[#1e2d3d] px-3 py-3.5 lg:px-4 lg:py-4"
                >
                  <p className="text-[11px] font-semibold leading-tight text-white lg:text-xs">
                    {card.title}
                  </p>
                  <p className="mt-1.5 text-[10px] leading-snug text-slate-400 lg:text-[11px]">
                    {card.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <p className="shrink-0 pt-6 text-center text-[11px] text-slate-500 lg:pt-8">
            © 2026 FlowOP Solutions. Internal use only.
          </p>
        </div>
      </section>

      {loading ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[#1a2332]/80 backdrop-blur-[2px]">
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      ) : null}
    </div>
  )
}
