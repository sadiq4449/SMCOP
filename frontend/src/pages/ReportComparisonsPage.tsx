import { useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import { compareReports } from '../services/reportsApi'
import type { CompareSchoolRow } from '../types/report'

export function ReportComparisonsPage() {
  const { user } = useAuth()
  const [quarter, setQuarter] = useState('Q2-2026')
  const [schoolIds, setSchoolIds] = useState('')
  const [rows, setRows] = useState<CompareSchoolRow[]>([])
  const [normQuarter, setNormQuarter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runCompare = async () => {
    setLoading(true)
    setError(null)
    try {
      const csv = schoolIds
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(',')
      const res = await compareReports(quarter.trim(), csv)
      setRows(res.schools)
      setNormQuarter(res.quarter)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Comparison failed'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  if (!user || (user.role !== 'government' && user.role !== 'super_admin' && user.role !== 'deo')) {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">You do not have access to comparison tooling.</p>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Analytics</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">School comparisons</h1>
        <p className="mt-1 text-sm text-text-muted">
          Enter a quarter and two or more school UUIDs (comma or newline separated). Metrics align to finalized visits and
          linked quarterly reports where present.
        </p>
      </header>

      <section className="rounded-2xl border border-muted-surface bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap gap-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Quarter</span>
            <input
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className="w-36 rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
            />
          </label>
        </div>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium text-text-secondary">School IDs</span>
          <textarea
            value={schoolIds}
            onChange={(e) => setSchoolIds(e.target.value)}
            rows={4}
            placeholder="uuid-one, uuid-two, uuid-three"
            className="w-full rounded-lg border border-muted-surface px-3 py-2 font-mono text-xs text-text-primary"
          />
        </label>
        <button
          type="button"
          disabled={loading}
          onClick={() => void runCompare()}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-50"
        >
          {loading ? 'Comparing…' : 'Compare'}
        </button>
      </section>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-muted-surface bg-surface shadow-sm">
          <div className="border-b border-muted-surface px-4 py-3 text-sm font-medium text-text-primary">
            Quarter <span className="font-mono">{normQuarter}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-muted-surface text-sm">
              <thead className="bg-muted-surface/40 text-left text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-2">School</th>
                  <th className="px-4 py-2">Visit</th>
                  <th className="px-4 py-2">Score</th>
                  <th className="px-4 py-2">Observations</th>
                  <th className="px-4 py-2">Report status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted-surface">
                {rows.map((r) => (
                  <tr key={r.school_id}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-text-primary">{r.school_name ?? '—'}</div>
                      <div className="font-mono text-xs text-text-muted">{r.school_id}</div>
                    </td>
                    <td className="px-4 py-2 text-text-secondary">
                      {r.visit_found ? r.visit_status ?? 'present' : '—'}
                    </td>
                    <td className="px-4 py-2 text-text-secondary">{r.aggregate_score ?? '—'}</td>
                    <td className="px-4 py-2 text-text-secondary">{r.classroom_observation_count ?? '—'}</td>
                    <td className="px-4 py-2 capitalize text-text-secondary">{r.report_status ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}
