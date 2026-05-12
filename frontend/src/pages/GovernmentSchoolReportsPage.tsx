import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import {
  addReportComment,
  downloadReportExport,
  getReport,
  listReportComments,
  listReports,
} from '../services/reportsApi'
import type { District } from '../types/school'
import type { ReportComment, ReportSummary } from '../types/report'
import { getDistricts } from '../services/schoolsApi'

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function GovernmentSchoolReportsPage() {
  const { user } = useAuth()
  const [districts, setDistricts] = useState<District[]>([])
  const [districtId, setDistrictId] = useState('')
  const [quarter, setQuarter] = useState('')
  const [status, setStatus] = useState('')
  const [items, setItems] = useState<ReportSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [pick, setPick] = useState<ReportSummary | null>(null)
  const [comments, setComments] = useState<ReportComment[]>([])
  const [detail, setDetail] = useState<ReportSummary | null>(null)
  const [commentBody, setCommentBody] = useState('')
  const [panelBusy, setPanelBusy] = useState(false)

  useEffect(() => {
    if (user?.role !== 'government') return
    void getDistricts()
      .then(setDistricts)
      .catch(() => setError('Could not load districts'))
  }, [user])

  const reload = useCallback(async () => {
    if (user?.role !== 'government') return
    setLoading(true)
    setError(null)
    try {
      const res = await listReports({
        district_id: districtId || undefined,
        quarter: quarter.trim() || undefined,
        status: status || undefined,
        limit: 100,
      })
      setItems(res.items)
      setTotal(res.total)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Failed to load reports'))
    } finally {
      setLoading(false)
    }
  }, [user, districtId, quarter, status])

  useEffect(() => {
    void reload()
  }, [reload])

  const openPanel = async (row: ReportSummary) => {
    setPick(row)
    setPanelBusy(true)
    setError(null)
    try {
      const [d, cs] = await Promise.all([getReport(row.id), listReportComments(row.id)])
      setDetail(d)
      setComments(cs)
      setCommentBody('')
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Failed to load report detail'))
    } finally {
      setPanelBusy(false)
    }
  }

  const postComment = async () => {
    if (!pick || !commentBody.trim()) return
    setPanelBusy(true)
    try {
      await addReportComment(pick.id, commentBody.trim())
      setCommentBody('')
      const cs = await listReportComments(pick.id)
      setComments(cs)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Comment failed'))
    } finally {
      setPanelBusy(false)
    }
  }

  if (!user || user.role !== 'government') {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">This library is available to government users.</p>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Read-only library</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">School reports</h1>
        <p className="mt-1 text-sm text-text-muted">
          Browse approved and in-progress district reports, add comments, and download exports.
        </p>
      </header>

      <div className="flex flex-wrap gap-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-secondary">District</span>
          <select
            value={districtId}
            onChange={(e) => setDistrictId(e.target.value)}
            className="min-w-[200px] rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
          >
            <option value="">All districts</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-secondary">Quarter</span>
          <input
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            placeholder="e.g. Q2-2026"
            className="w-36 rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-secondary">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
          >
            <option value="">Any</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
      </div>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-muted-surface bg-surface shadow-sm">
        <div className="border-b border-muted-surface px-4 py-3 text-sm text-text-muted">
          {loading ? 'Loading…' : `${total} report${total === 1 ? '' : 's'} shown`}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-muted-surface text-sm">
            <thead className="bg-muted-surface/40 text-left text-xs uppercase text-text-muted">
              <tr>
                <th className="px-4 py-2">Quarter</th>
                <th className="px-4 py-2">School</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted-surface">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-muted-surface/30">
                  <td className="px-4 py-2 font-medium text-text-primary">{r.quarter}</td>
                  <td className="max-w-[200px] truncate px-4 py-2 font-mono text-xs text-text-secondary">{r.school_id}</td>
                  <td className="px-4 py-2 capitalize text-text-secondary">{r.status}</td>
                  <td className="space-x-2 px-4 py-2">
                    <button
                      type="button"
                      onClick={() => void openPanel(r)}
                      className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-white hover:bg-secondary"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void downloadReportExport(r.id, 'xlsx').then((b) =>
                          triggerDownload(b, `report-${r.quarter}-${r.school_id}.xlsx`),
                        )
                      }
                      className="rounded-md border border-muted-surface px-2 py-1 text-xs text-text-primary"
                    >
                      Excel
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-text-muted">
                    No reports match filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {pick ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{detail?.quarter ?? 'Report'}</h2>
                <p className="font-mono text-xs text-text-muted">{pick.school_id}</p>
              </div>
              <div className="flex gap-2">
                {detail ? (
                  <button
                    type="button"
                    onClick={() =>
                      void downloadReportExport(detail.id, 'pdf').then((b) =>
                        triggerDownload(b, `report-${detail.quarter}-${detail.school_id}.pdf`),
                      )
                    }
                    className="rounded-lg border border-muted-surface px-3 py-1 text-xs"
                  >
                    PDF
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setPick(null)
                    setDetail(null)
                  }}
                  className="rounded-lg bg-muted-surface px-3 py-1 text-xs"
                >
                  Close
                </button>
              </div>
            </div>

            {panelBusy || !detail ? (
              <p className="mt-4 text-sm text-text-muted">Loading…</p>
            ) : (
              <>
                <div className="mt-4 space-y-2 text-sm text-text-secondary">
                  <p>
                    <span className="font-medium text-text-primary">Summary:</span> {detail.summary || '—'}
                  </p>
                  <p>
                    <span className="font-medium text-text-primary">Recommendations:</span>{' '}
                    {detail.recommendations || '—'}
                  </p>
                </div>

                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-text-primary">Government comments</h3>
                  <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-sm text-text-secondary">
                    {comments.map((c) => (
                      <li key={c.id} className="rounded-lg bg-muted-surface/40 px-3 py-2">
                        <span className="text-xs text-text-muted">{new Date(c.created_at).toLocaleString()}</span>
                        <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
                      </li>
                    ))}
                    {comments.length === 0 ? <li className="text-text-muted">No comments yet.</li> : null}
                  </ul>
                  <textarea
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    rows={3}
                    placeholder="Add a comment…"
                    className="mt-3 w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
                  />
                  <button
                    type="button"
                    disabled={panelBusy || !commentBody.trim()}
                    onClick={() => void postComment()}
                    className="mt-2 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Post comment
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
