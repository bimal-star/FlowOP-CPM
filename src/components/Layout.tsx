import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { BrandLogo } from './BrandLogo'
import { FollowUpAlertBanner } from './FollowUpAlertBanner'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-flowop-green text-white'
      : 'text-slate-300 hover:bg-flowop-navy-light hover:text-white',
  ].join(' ')

export function Layout() {
  const { signOut, user } = useAuth()

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-flowop-navy">
      <header className="shrink-0 border-b border-white/10 bg-flowop-navy-light/80 backdrop-blur-sm">
        <div className="flex w-full flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <BrandLogo className="max-h-16 min-h-16 sm:max-w-[320px]" />
            <div className="min-w-0 border-l border-white/10 pl-4">
              <p className="truncate text-xs text-slate-400">
                {user?.email ?? 'Signed in'}
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
            <NavLink to="/enquiries" className={navLinkClass} end={false}>
              Enquiry log
            </NavLink>
            <NavLink to="/pipeline" className={navLinkClass}>
              Pipeline
            </NavLink>
            <NavLink to="/follow-ups" className={navLinkClass}>
              Follow-ups
            </NavLink>
            <NavLink to="/templates" className={navLinkClass}>
              Templates
            </NavLink>
            <NavLink to="/settings" className={navLinkClass} title="Settings">
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
              onClick={() => void signOut()}
              className="ml-0 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-white/25 hover:text-white sm:ml-2"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <FollowUpAlertBanner />

      <main className="flex min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
