import { NotificationBell } from './NotificationBell'

import { roleLabels } from '../../config/navigation'
import type { UserProfile } from '../../types/auth'

interface HeaderProps {
  user: UserProfile
  onLogout: () => Promise<void>
}

function SearchCommand() {
  return (
    <div className="relative min-w-0 max-w-xl flex-1">
      <svg
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.75}
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
      </svg>
      <input
        type="search"
        placeholder="Search schools, EMIS, visits, reports…"
        className="w-full !border-slate-200/90 !bg-white/90 !py-2.5 !pl-11 !text-[13px] !shadow-none"
        disabled
        title="Search coming soon"
        aria-disabled="true"
      />
    </div>
  )
}

export function Header({ user, onLogout }: HeaderProps) {
  return (
    <header
      className="flex flex-wrap items-center gap-4 rounded-ref-lg border border-slate-200/80 bg-white/65 px-5 py-3.5 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_8px_32px_rgb(15_23_42/0.05)] backdrop-blur-xl"
      style={{ borderRadius: 'var(--radius-card-lg, 1.75rem)' }}
    >
      <SearchCommand />

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
