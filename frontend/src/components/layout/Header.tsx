import { NotificationBell } from './NotificationBell'

import { roleLabels } from '../../config/navigation'
import type { UserProfile } from '../../types/auth'

interface HeaderProps {
  user: UserProfile
  onLogout: () => Promise<void>
}

export function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-ref-lg border border-white/10 bg-surface/85 px-6 py-4 shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur-md">
      <div className="min-w-0">
        <p className="text-sm text-text-muted">Signed in as</p>
        <h2 className="truncate text-xl font-semibold tracking-tight text-text-primary">{user.full_name}</h2>
        <p className="text-sm text-text-secondary">{roleLabels[user.role]}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <NotificationBell />
        <button
          type="button"
          onClick={() => {
            void onLogout()
          }}
          className="rounded-xl bg-gradient-to-br from-primary to-secondary px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(91,140,255,0.26)] transition hover:-translate-y-0.5 hover:opacity-95 active:translate-y-0"
        >
          Log out
        </button>
      </div>
    </header>
  )
}
