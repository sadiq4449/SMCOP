import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import { listVisits } from '../services/visitsApi'
import type { VisitSummary } from '../types/visit'
import { normalizeQuarterInput } from '../utils/quarter'

const monitorRoles = ['ie', 'government', 'super_admin', 'partner']

export function MonitoringVisitsPage() {
  const { user } = useAuth()
  const [quarter, setQuarter] = useState('Q2-2026')
  const [items, setItems] = useState<VisitSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !monitorRoles.includes(user.role)) return
    setLoading(true)
    setError(null)
    void listVisits({ quarter: normalizeQuarterInput(quarter).trim() || undefined, limit: 100 })
      .then((r) => {
        setItems(r.items)
        setTotal(r.total)
      })
      .catch((e: unknown) => setError(getApiErrorMessage(e, 'Failed to load visits')))
      .finally(() => setLoading(false))
  }, [user, quarter])

  if (!user || !monitorRoles.includes(user.role)) {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">You do not have access to monitoring visits.</p>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Monitoring</p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">Quarterly visits</h1>
          <p className="mt-1 text-sm text-text-muted">
            Independent Evaluators capture KPI scores and evidence; PPP Node and partners review visits in their scope.
          </p>
        </div>
        {user.role === 'ie' ? (
          <Link
            to="/dashboard/assigned-schools"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary"
          >
            Assigned schools
          </Link>
        ) : null}
      </header>

      <label className="block max-w-xs text-sm">
        <span className="mb-1 block font-medium text-text-secondary">Quarter filter</span>
        <input
          value={quarter}
          onChange={(e) => setQuarter(e.target.value)}
          className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
          placeholder="e.g. Q1-2026"
        />
      </label>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-muted-surface bg-surface shadow-sm">
        <div className="border-b border-muted-surface px-4 py-3 text-sm text-text-muted">
          {loading ? 'Loading…' : `${total} visit${total === 1 ? '' : 's'} (showing ${items.length})`}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-muted-surface text-sm">
            <thead className="bg-section">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Quarter</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">School</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Score</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted-surface">
              {items.map((v) => (
                <tr key={v.id} className="hover:bg-section/80">
                  <td className="px-4 py-3 font-mono text-text-primary">{v.quarter}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{v.school_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-text-secondary">{v.visit_date ?? '—'}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {v.aggregate_score != null ? `${v.aggregate_score}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        v.status === 'finalized'
                          ? 'rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success'
                          : 'rounded-full bg-muted-surface px-2 py-0.5 text-xs font-medium text-text-muted'
                      }
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/dashboard/monitoring/${v.id}`}
                      className="font-medium text-secondary hover:text-primary"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    No visits for this quarter filter.
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
