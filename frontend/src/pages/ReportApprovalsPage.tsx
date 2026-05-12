import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import { downloadReportExport, listReports, reviewReport } from '../services/reportsApi'
import type { ReportSummary } from '../types/report'

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ReportApprovalsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<ReportSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pick, setPick] = useState<ReportSummary | null>(null)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listReports({ status: 'submitted', limit: 100 })
      setItems(res.items)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Failed to load queue'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role !== 'deo' && user?.role !== 'super_admin') return
    void reload()
  }, [user, reload])

  const decide = async (decision: 'approved' | 'rejected') => {
    if (!pick) return
    setBusy(true)
    setError(null)
    try {
      await reviewReport(pick.id, { status: decision, remarks: remarks.trim() || null })
      setPick(null)
      setRemarks('')
      await reload()
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Review failed'))
    } finally {
      setBusy(false)
    }
  }

  if (!user || (user.role !== 'deo' && user.role !== 'super_admin')) {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">Approvals are limited to district officers and super admins.</p>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">District workflow</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Report approvals</h1>
        <p className="mt-1 text-sm text-text-muted">
          Submitted quarterly reports awaiting{' '}
          {user.role === 'deo' ? 'your district decision' : 'your override decision'}.
        </p>
      </header>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-muted-surface bg-surface shadow-sm">
        <div className="border-b border-muted-surface px-4 py-3 text-sm text-text-muted">
          {loading ? 'Loading…' : `${items.length} submitted report${items.length === 1 ? '' : 's'}`}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-muted-surface text-sm">
            <thead className="bg-muted-surface/40 text-left text-xs uppercase text-text-muted">
              <tr>
                <th className="px-4 py-2">Quarter</th>
                <th className="px-4 py-2">School</th>
                <th className="px-4 py-2">Updated</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted-surface">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-muted-surface/30">
                  <td className="px-4 py-2 font-medium text-text-primary">{r.quarter}</td>
                  <td className="max-w-[220px] truncate px-4 py-2 font-mono text-xs text-text-secondary">{r.school_id}</td>
                  <td className="px-4 py-2 text-text-muted">{new Date(r.updated_at).toLocaleString()}</td>
                  <td className="space-x-2 px-4 py-2">
                    <button
                      type="button"
                      onClick={() => setPick(r)}
                      className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-white hover:bg-secondary"
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void downloadReportExport(r.id, 'pdf').then((b) =>
                          triggerDownload(b, `report-${r.quarter}-${r.school_id}.pdf`),
                        )
                      }
                      className="rounded-md border border-muted-surface px-2 py-1 text-xs text-text-primary"
                    >
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-text-muted">
                    No submitted reports in your scope.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {pick ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-text-primary">Review report</h2>
            <p className="mt-1 font-mono text-xs text-text-muted">{pick.id}</p>
            <p className="mt-2 text-sm text-text-secondary">
              {pick.quarter} — school {pick.school_id}
            </p>
            <label className="mt-4 block text-sm">
              <span className="font-medium text-text-secondary">Remarks (optional)</span>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
              />
            </label>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void decide('approved')}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-primary disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void decide('rejected')}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setPick(null)
                  setRemarks('')
                }}
                className="rounded-lg border border-muted-surface px-4 py-2 text-sm text-text-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
