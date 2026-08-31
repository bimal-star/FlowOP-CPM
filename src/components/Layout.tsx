import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { BrandLogo } from './BrandLogo'
import { FollowUpAlertBanner } from './FollowUpAlertBanner'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-flowop-green text-white'
      : 'text-slate-300 hover:bg-flowop-navy-light hover:text-white',
  ].join(' ')

const navItems = [
  { to: '/enquiries', label: 'Enquiry log', end: false },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/follow-ups', label: 'Follow-ups' },
  { to: '/templates', label: 'Templates' },
] as const

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-6 w-6"
      aria-hidden
    >
      {open ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 18L18 6M6 6l12 12"
        />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
        />
      )}
    </svg>
  )
}

export function Layout() {
  const { signOut, user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-flowop-navy">
      <header className="relative z-[60] shrink-0 border-b border-white/10 bg-flowop-navy-light/80 backdrop-blur-sm">
        <div className="flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <BrandLogo className="max-h-11 min-h-11 w-auto max-w-[min(52vw,220px)] sm:max-h-14 sm:min-h-14 sm:max-w-[280px]" />
            <div className="hidden min-w-0 border-l border-white/10 pl-3 sm:block">
              <p className="truncate text-xs text-slate-400">
                {user?.email ?? 'Signed in'}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-white/15 p-2 text-slate-200 hover:border-white/25 hover:text-white md:hidden"
            aria-expanded={menuOpen}
            aria-controls="app-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="sr-only">
              {menuOpen ? 'Close menu' : 'Open menu'}
            </span>
            <MenuIcon open={menuOpen} />
          </button>

          <nav
            id="app-nav"
            className={`absolute left-0 right-0 top-full z-50 border-b border-white/10 bg-flowop-navy-light/95 px-4 py-3 shadow-lg backdrop-blur-sm md:static md:z-auto md:flex md:flex-1 md:items-center md:justify-end md:border-0 md:bg-transparent md:p-0 md:shadow-none ${menuOpen ? 'block' : 'hidden md:flex'}`}
            aria-label="Main"
          >
            <div className="flex flex-col gap-1 md:flex-row md:flex-wrap md:items-center md:gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={'end' in item ? item.end : undefined}
                  className={navLinkClass}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
              <NavLink
                to="/settings"
                className={navLinkClass}
                title="Settings"
                onClick={() => setMenuOpen(false)}
              >
                <span className="inline-flex items-center gap-1.5">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-4 w-4 opacity-90"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.65.87.333.187.72.244 1.084.133l1.255-.405c.54-.174 1.13.115 1.402.61l1.295 2.243c.27.465.186 1.064-.194 1.388l-1.004.923c-.325.298-.488.735-.488 1.176 0 .44.163.878.488 1.176l1.004.923c.38.324.464.923.194 1.388l-1.295 2.243a1.125 1.125 0 01-1.402.61l-1.255-.405c-.364-.111-.751-.054-1.084.133-.337.184-.587.496-.65.87l-.213 1.281c-.09.542-.56.94-1.11.94h-2.593c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.063-.374-.313-.686-.65-.87a1.125 1.125 0 00-1.084-.133l-1.255.405a1.125 1.125 0 01-1.402-.61L4.5 16.5c-.27-.465-.186-1.064.194-1.388l1.004-.923c.325-.298.488-.735.488-1.176 0-.44-.163-.878-.488-1.176L4.45 10.5c-.38-.324-.464-.923-.194-1.388L5.55 5.87a1.125 1.125 0 011.402-.61l1.255.405c.364.111.751.054 1.084-.133.337-.184.587-.496.65-.87L9.593 3.94zM12 15a3 3 0 100-6 3 3 0 000 6z"
                    />
                  </svg>
                  Settings
                </span>
              </NavLink>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  void signOut()
                }}
                className="mt-1 block w-full rounded-lg border border-white/15 px-3 py-2.5 text-left text-sm text-slate-300 transition-colors hover:border-white/25 hover:text-white md:mt-0 md:w-auto md:text-center"
              >
                Sign out
              </button>
            </div>
          </nav>
        </div>
      </header>

      <FollowUpAlertBanner />

      <main className="flex min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 py-3 sm:px-6 sm:py-5 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
