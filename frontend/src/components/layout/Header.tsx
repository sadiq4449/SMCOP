import { useLocation } from 'react-router-dom'

import { NotificationBell } from './NotificationBell'

import { pageTitleForPath } from '../../config/routeMeta'
import { roleLabels } from '../../config/navigation'
import type { UserProfile } from '../../types/auth'

interface HeaderProps {
  user: UserProfile
  onLogout: () => Promise<void>
}

export function Header({ user, onLogout }: HeaderProps) {
  const { pathname } = useLocation()
  const pageTitle = pageTitleForPath(pathname)

  return (
    <header
      className="relative z-30 flex flex-wrap items-center gap-4 rounded-ref-lg border border-slate-200/80 bg-white/65 px-5 py-3.5 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_8px_32px_rgb(15_23_42/0.05)] backdrop-blur-xl"
      style={{ borderRadius: 'var(--radius-card-lg, 1.75rem)' }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Current page</p>
        <h2 className="truncate text-lg font-semibold tracking-tight text-text-primary">{pageTitle}</h2>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-4 border-l border-slate-200/70 pl-4">
        <div className="hidden min-w-0 text-right sm:block">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Signed in</p>
          <p className="truncate text-sm font-semibold text-text-primary">{user.full_name}</p>
          <p className="truncate text-xs text-text-secondary">{roleLabels[user.role]}</p>
        </div>
        <NotificationBell />
        <button
          type="button"
          onClick={() => {
            void onLogout()
          }}
          className="rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-[13px] font-medium text-text-secondary shadow-[inset_0_1px_0_rgb(255_255_255/0.9)] transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-text-primary"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
