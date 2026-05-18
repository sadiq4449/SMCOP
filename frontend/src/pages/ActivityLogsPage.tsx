import { useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { listActivityLogs } from '../services/usersApi'
import type { ActivityLogRow } from '../types/user'

export function ActivityLogsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<ActivityLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionFilter, setActionFilter] = useState('')

  const refresh = () =>
    listActivityLogs({
      limit: 100,
      action: actionFilter.trim() || undefined,
    })
      .then((res) => {
        setItems(res.items)
        setTotal(res.total)
      })
      .catch((err: Error) => setError(err.message))

  useEffect(() => {
    if (user?.role !== 'super_admin') return
    setLoading(true)
    setError(null)
    void refresh().finally(() => setLoading(false))
  }, [user?.role, actionFilter])

  if (user?.role !== 'super_admin') {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">The audit log is visible to programme administrators.</p>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Security</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Activity log</h1>
        <p className="mt-1 text-sm text-text-muted">
          Privileged actions such as user administration and authentication events (latest first).
        </p>
      </header>

      <section className="rounded-2xl border border-muted-surface bg-surface p-4 shadow-sm">
        <label className="block max-w-md text-sm">
          <span className="mb-1 block font-medium text-text-secondary">Filter by action</span>
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="e.g. users.update"
            className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
          />
        </label>
      </section>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-muted-surface bg-surface shadow-sm">
        <div className="border-b border-muted-surface px-4 py-3 text-sm text-text-muted">
          {loading ? 'Loading…' : `${total} entr${total === 1 ? 'y' : 'ies'} (showing ${items.length})`}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-muted-surface text-sm">
            <thead className="bg-section">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">When</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Action</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Actor</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Target</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted-surface">
              {items.map((row) => (
                <tr key={row.id} className="align-top hover:bg-section/80">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-text-muted">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-primary">{row.action}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">{row.user_id ?? '—'}</td>
                  <td className="max-w-[180px] truncate px-4 py-3 font-mono text-xs text-text-secondary" title={row.target}>
                    {row.target}
                  </td>
                  <td className="max-w-md px-4 py-3 text-xs text-text-muted">
                    {row.metadata ? (
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono">
                        {JSON.stringify(row.metadata, null, 2)}
                      </pre>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                    No log entries match this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
