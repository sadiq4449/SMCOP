import { NavLink } from 'react-router-dom'

import { getNavigationForRole, roleLabels } from '../../config/navigation'
import type { UserProfile } from '../../types/auth'

interface SidebarProps {
  user: UserProfile
}

export function Sidebar({ user }: SidebarProps) {
  const navigation = getNavigationForRole(user.role)

  return (
    <aside className="sticky top-5 flex h-[calc(100vh-2.5rem)] w-[280px] shrink-0 flex-col overflow-y-auto rounded-ref-lg border border-white/10 bg-gradient-to-b from-sidebar to-sidebar-deep shadow-[0_18px_45px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 px-5 py-6">
        <div className="flex items-start gap-3.5">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary text-sm font-extrabold tracking-wide text-white shadow-[0_12px_30px_rgba(91,140,255,0.32)]">
            SM
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">SMOCP Portal</p>
            <h1 className="mt-1 text-lg font-semibold leading-snug text-text-primary">School monitoring</h1>
            <p className="mt-1 text-xs text-text-muted">{roleLabels[user.role]}</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-2 px-3 py-4">
        <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">Menu</p>
        {navigation.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dashboard'}
            className={({ isActive }) =>
              [
                'block rounded-xl border px-3.5 py-3 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'border-primary/35 bg-primary/15 text-text-primary shadow-[inset_0_0_0_1px_rgba(91,140,255,0.12)]'
                  : 'border-transparent text-text-secondary hover:border-primary/25 hover:bg-primary/10 hover:text-text-primary',
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
