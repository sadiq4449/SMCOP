import { Link } from 'react-router-dom'

import { roleLabels } from '../config/navigation'
import { useAuth } from '../context/AuthContext'

export function SettingsPage() {
  const { user, logout } = useAuth()

  if (!user) return null

  const apiResolved =
    typeof import.meta.env.VITE_API_BASE_URL === 'string' &&
    String(import.meta.env.VITE_API_BASE_URL).trim() !== ''
      ? String(import.meta.env.VITE_API_BASE_URL).trim()
      : '(default: dev /api/v1 · prod /svc/v1)'

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">System</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-muted">
          Profile and basic session preferences. Organizational data lives under Geography, Schools, and Users.
        </p>
      </header>

      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-text-primary">Account</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">Name</dt>
            <dd className="mt-1 text-text-primary">{user.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">Email</dt>
            <dd className="mt-1 text-text-primary">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">Role</dt>
            <dd className="mt-1 text-text-primary">{roleLabels[user.role]}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">Status</dt>
            <dd className="mt-1 capitalize text-text-primary">{user.status}</dd>
          </div>
          {user.district_id ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">District scope ID</dt>
              <dd className="mt-1 font-mono text-xs text-text-secondary">{user.district_id}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-6 flex flex-wrap gap-3 border-t border-muted-surface pt-6">
          <Link
            to="/forgot-password"
            className="rounded-lg border border-muted-surface px-4 py-2 text-sm font-semibold text-text-primary hover:bg-muted-surface/40"
          >
            Reset password
          </Link>
          <button
            type="button"
            className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            onClick={() => void logout()}
          >
            Sign out
          </button>
        </div>
      </section>

      {import.meta.env.DEV ? (
        <section className="rounded-2xl border border-dashed border-secondary/35 bg-muted-surface/20 p-6">
          <h2 className="text-sm font-semibold text-text-primary">Developer</h2>
          <p className="mt-1 text-xs text-text-muted">
            <code className="font-mono">VITE_API_BASE_URL</code> override:{' '}
            <span className="font-mono text-text-secondary">{apiResolved}</span>
          </p>
        </section>
      ) : null}
    </div>
  )
}
