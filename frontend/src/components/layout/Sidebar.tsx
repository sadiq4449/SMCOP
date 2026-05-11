import { NavLink } from 'react-router-dom'

import { getNavigationForRole, roleLabels } from '../../config/navigation'
import type { UserProfile } from '../../types/auth'

interface SidebarProps {
  user: UserProfile
}

export function Sidebar({ user }: SidebarProps) {
  const navigation = getNavigationForRole(user.role)

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-primary text-white shadow-lg">
      <div className="border-b border-white/10 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">SMOCP Portal</p>
        <h1 className="mt-2 text-lg font-semibold">School Monitoring</h1>
        <p className="mt-1 text-sm text-white/75">{roleLabels[user.role]}</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dashboard'}
            className={({ isActive }) =>
              [
                'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-secondary text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white',
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
