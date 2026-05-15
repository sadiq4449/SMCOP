import { NavLink } from 'react-router-dom'

import { getNavigationForRole, roleLabels } from '../../config/navigation'
import type { UserProfile } from '../../types/auth'

interface SidebarProps {
  user: UserProfile
}

export function Sidebar({ user }: SidebarProps) {
  const navigation = getNavigationForRole(user.role)

  return (
    <aside
      className="sticky top-6 flex h-[calc(100vh-3rem)] w-[260px] shrink-0 flex-col overflow-y-auto rounded-ref-lg border border-slate-200/80 bg-white/70 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_12px_40px_rgb(15_23_42/0.06)] backdrop-blur-xl"
      style={{ borderRadius: 'var(--radius-card-lg, 1.75rem)' }}
    >
      <div className="border-b border-slate-200/60 px-5 py-7">
        <div className="flex items-start gap-3">
          <div
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-xs font-bold tracking-wide text-white shadow-[0_4px_14px_rgb(51_78_104/0.25)]"
            aria-hidden
          >
            SM
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Operations</p>
            <h1 className="mt-1 text-[15px] font-semibold leading-snug tracking-tight text-text-primary">SMOCP</h1>
            <p className="mt-1.5 text-xs leading-snug text-text-secondary">{roleLabels[user.role]}</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Navigate</p>
        {navigation.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dashboard'}
            className={({ isActive }) =>
              [
                'rounded-xl px-3 py-2.5 text-[13px] font-medium tracking-tight transition-colors duration-200',
                isActive
                  ? 'bg-slate-900/[0.06] text-text-primary shadow-[inset_0_0_0_1px_rgb(15_23_42/0.06)]'
                  : 'text-text-secondary hover:bg-slate-900/[0.035] hover:text-text-primary',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
