import { roleLabels } from '../../config/navigation'
import type { UserProfile } from '../../types/auth'

interface HeaderProps {
  user: UserProfile
  onLogout: () => Promise<void>
}

export function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-muted-surface bg-surface px-6 py-4 shadow-sm">
      <div>
        <p className="text-sm text-text-muted">Signed in as</p>
        <h2 className="text-lg font-semibold text-text-primary">{user.full_name}</h2>
        <p className="text-sm text-text-secondary">{roleLabels[user.role]}</p>
      </div>

      <button
        type="button"
        onClick={() => {
          void onLogout()
        }}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-secondary"
      >
        Log out
      </button>
    </header>
  )
}
