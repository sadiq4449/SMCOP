import { useCallback, useEffect, useMemo, useState } from 'react'

import { Link } from 'react-router-dom'

import { ReportSnapshotPanel } from '../components/reports/ReportSnapshotPanel'
import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import { getSchools } from '../services/schoolsApi'
import {
  createReport,
  downloadReportExport,
  getReport,
  listReports,
  patchReport,
  reviewReport,
  listReportComments,
  addReportComment,
} from '../services/reportsApi'
import type { ReportComment, ReportSummary } from '../types/report'
import type { SchoolSummary } from '../types/school'

const workspaceRoles = ['super_admin', 'ie', 'government', 'partner'] as const

function shortenId(id: string) {
  if (id.length <= 12) return id
  return `${id.slice(0, 8)}…`
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ReportsWorkspacePage() {
  const { user } = useAuth()
  const [quarter, setQuarter] = useState('Q2-2026')
  const [items, setItems] = useState<ReportSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReportSummary | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [newSchoolId, setNewSchoolId] = useState('')
  const [newQuarter, setNewQuarter] = useState('Q2-2026')
  const [createBusy, setCreateBusy] = useState(false)
  const [schoolPickList, setSchoolPickList] = useState<SchoolSummary[]>([])
  const [schoolSearch, setSchoolSearch] = useState('')
  const [debouncedSchoolQ, setDebouncedSchoolQ] = useState('')
  const [schoolPickerLoading, setSchoolPickerLoading] = useState(false)

  const [formSummary, setFormSummary] = useState('')
  const [formRec, setFormRec] = useState('')
  const [formInfra, setFormInfra] = useState('')
  const [formDaily, setFormDaily] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [comments, setComments] = useState<ReportComment[]>([])
  const [oversightNote, setOversightNote] = useState('')
  const [decisionRemarks, setDecisionRemarks] = useState('')
  const [commentBusy, setCommentBusy] = useState(false)

  const role = user?.role

  const canUse =
    !!user && (workspaceRoles as readonly string[]).includes(user.role)

  const canCreateDraft = role === 'super_admin' || role === 'ie'
  const showCompareLinks = role !== 'ie'

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSchoolQ(schoolSearch.trim()), 280)
    return () => window.clearTimeout(t)
  }, [schoolSearch])

  useEffect(() => {
    setNewQuarter(quarter.trim())
  }, [quarter])

  useEffect(() => {
    if (!canUse) return
    let cancelled = false
    setSchoolPickerLoading(true)
    void getSchools({
      limit: 100,
      ...(debouncedSchoolQ.length >= 1 ? { q: debouncedSchoolQ } : {}),
    })
      .then((res) => {
        if (!cancelled) setSchoolPickList(res.items)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(getApiErrorMessage(e, 'Failed to load schools'))
      })
      .finally(() => {
        if (!cancelled) setSchoolPickerLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canUse, debouncedSchoolQ])

  const schoolLabelById = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of schoolPickList) {
      const label = `${s.name} (${s.emis_code}) · ${s.district_name}`
      m.set(s.id, label)
    }
    return m
  }, [schoolPickList])

  const reload = useCallback(async () => {
    if (!canUse) return
    setLoading(true)
    setError(null)
    try {
      const q = quarter.trim() || undefined
      const res = await listReports({ quarter: q, limit: 100 })
      setItems(res.items)
      setTotal(res.total)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Failed to load reports'))
    } finally {
      setLoading(false)
    }
  }, [canUse, quarter])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!selected?.id) {
      setComments([])
      return
    }
    let cancelled = false
    void listReportComments(selected.id).then((rows) => {
      if (!cancelled) setComments(rows)
    })
    return () => {
      cancelled = true
    }
  }, [selected?.id])

  const loadDetail = async (id: string) => {
    setDetailLoading(true)
    setError(null)
    try {
      const r = await getReport(id)
      setSelected(r)
      setFormSummary(r.summary ?? '')
      setFormRec(r.recommendations ?? '')
      setFormInfra(r.principal_infrastructure_notes ?? '')
      setFormDaily(r.principal_daily_activity_notes ?? '')
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Failed to load report'))
    } finally {
      setDetailLoading(false)
    }
  }

  const onCreate = async () => {
    if (!newSchoolId.trim()) {
      setError('Select a school from the list to create a report.')
      return
    }
    setCreateBusy(true)
    setError(null)
    try {
      await createReport({
        school_id: newSchoolId.trim(),
        quarter: newQuarter.trim() || 'Q1-2026',
      })
      setNewSchoolId('')
      setSchoolSearch('')
      await reload()
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Create failed'))
    } finally {
      setCreateBusy(false)
    }
  }

  const draftEditable = selected?.status === 'draft'

  const canPatchReportBody =
    role === 'super_admin' || (role === 'ie' && draftEditable)
  const canSubmitDraft =
    draftEditable && (role === 'super_admin' || role === 'ie')

  const canPostOversightNote = role === 'government' || role === 'partner'

  const postOversightNote = async () => {
    if (!selected?.id || !oversightNote.trim()) return
    setCommentBusy(true)
    setError(null)
    try {
      await addReportComment(selected.id, oversightNote.trim())
      setOversightNote('')
      const rows = await listReportComments(selected.id)
      setComments(rows)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Could not post review note'))
    } finally {
      setCommentBusy(false)
    }
  }

  const runDecision = async (decision: 'approved' | 'rejected') => {
    if (!selected?.id || user?.role !== 'super_admin') return
    setSaveBusy(true)
    setError(null)
    try {
      const updated = await reviewReport(selected.id, {
        status: decision,
        remarks: decisionRemarks.trim() || null,
      })
      setSelected(updated)
      setDecisionRemarks('')
      await reload()
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Review failed'))
    } finally {
      setSaveBusy(false)
    }
  }

  const onSaveBody = async () => {
    if (!selected) return
    setSaveBusy(true)
    setError(null)
    try {
      const updated = await patchReport(selected.id, {
        summary: formSummary || null,
        recommendations: formRec || null,
        principal_infrastructure_notes: formInfra || null,
        principal_daily_activity_notes: formDaily || null,
      })
      setSelected(updated)
      await reload()
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Save failed'))
    } finally {
      setSaveBusy(false)
    }
  }

  const onSubmitForReview = async () => {
    if (!selected) return
    setSaveBusy(true)
    setError(null)
    try {
      const updated = await patchReport(selected.id, { status: 'submitted' })
      setSelected(updated)
      await reload()
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Submit failed'))
    } finally {
      setSaveBusy(false)
    }
  }

  const onReopenDraft = async () => {
    if (!selected || user?.role !== 'super_admin') return
    setSaveBusy(true)
    setError(null)
    try {
      const updated = await patchReport(selected.id, { status: 'draft' })
      setSelected(updated)
      await reload()
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Reopen failed'))
    } finally {
      setSaveBusy(false)
    }
  }

  const onExport = async (format: 'xlsx' | 'pdf') => {
    if (!selected) return
    try {
      const blob = await downloadReportExport(selected.id, format)
      triggerDownload(blob, `report-${selected.quarter}-${selected.school_id}.${format}`)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Export failed'))
    }
  }

  const onRefreshSnapshot = async () => {
    if (!selected || !user || (user.role !== 'super_admin' && user.role !== 'ie')) return
    setSaveBusy(true)
    setError(null)
    try {
      const updated = await patchReport(selected.id, { refresh_snapshot: true })
      setSelected(updated)
      await reload()
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Could not refresh metrics'))
    } finally {
      setSaveBusy(false)
    }
  }

  if (!user || !canUse) {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">Your role cannot manage quarterly reports here.</p>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-muted-surface bg-gradient-to-br from-section to-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Reporting</p>
            <h1 className="mt-1 text-2xl font-semibold text-text-primary">Quarterly reports</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-muted">
              Super Admin assigns schools to Independent Evaluators (under Users → IE profile). IE completes KPI-aligned
              monitoring visits, then drafts quarterly narrative here and submits for formal approval. Super Admin may edit or
              resubmit content anytime; PPP Node and Partner Organization colleagues preview outcomes, download Excel/PDF
              (PDF adds KPI charts), and attach threaded oversight notes only—they cannot alter IE narrative fields.
            </p>
          </div>
          {showCompareLinks ? (
            <Link
              to="/dashboard/reports/compare"
              className="rounded-lg border border-muted-surface bg-surface px-4 py-2 text-sm font-semibold text-secondary shadow-sm hover:bg-muted-surface/40"
            >
              Compare reports →
            </Link>
          ) : null}
        </div>
        <ol className="mt-4 grid gap-2 text-xs text-text-secondary sm:grid-cols-2 lg:grid-cols-4">
          <li className="rounded-lg border border-muted-surface bg-surface/80 px-3 py-2">
            <span className="font-semibold text-primary">1.</span> Assign schools to IE (Super Admin).
          </li>
          <li className="rounded-lg border border-muted-surface bg-surface/80 px-3 py-2">
            <span className="font-semibold text-primary">2.</span> IE finalizes visit & KPI evidence.
          </li>
          <li className="rounded-lg border border-muted-surface bg-surface/80 px-3 py-2">
            <span className="font-semibold text-primary">3.</span> IE drafts report → Submit.
          </li>
          <li className="rounded-lg border border-muted-surface bg-surface/80 px-3 py-2">
            <span className="font-semibold text-primary">4.</span> Super Admin approves; Gov/Partner note & export.
          </li>
        </ol>
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <label className="block max-w-xs text-sm">
          <span className="mb-1 block font-medium text-text-secondary">List filter — quarter</span>
          <input
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
            placeholder="e.g. Q2-2026"
          />
        </label>
      </div>

      {canCreateDraft ? (
        <section className="rounded-2xl border border-muted-surface bg-surface p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-text-primary">Create report</h2>
          <p className="mt-1 text-xs text-text-muted">Requires access to the school (assigned schools or super admin).</p>
          <div className="mt-3 space-y-2">
            <label className="block text-xs font-medium text-text-secondary">
              Find school (name or EMIS)
              <input
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
                placeholder="Type to search…"
                className="mt-1 block w-full max-w-md rounded-lg border border-muted-surface px-3 py-2 text-sm text-text-primary"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <label className="flex min-w-[min(100%,280px)] flex-1 flex-col text-xs font-medium text-text-secondary">
                School
                <select
                  value={newSchoolId}
                  onChange={(e) => setNewSchoolId(e.target.value)}
                  disabled={schoolPickerLoading}
                  className="mt-1 rounded-lg border border-muted-surface px-3 py-2 text-sm text-text-primary disabled:opacity-50"
                >
                  <option value="">{schoolPickerLoading ? 'Loading schools…' : 'Choose a school…'}</option>
                  {schoolPickList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — EMIS {s.emis_code} ({s.district_name})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-xs font-medium text-text-secondary">
                Quarter for new draft
                <input
                  value={newQuarter}
                  onChange={(e) => setNewQuarter(e.target.value)}
                  placeholder="Quarter"
                  className="mt-1 w-32 rounded-lg border border-muted-surface px-3 py-2 text-sm text-text-primary"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={createBusy}
              onClick={() => void onCreate()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-50"
            >
              {createBusy ? 'Creating…' : 'Create draft'}
            </button>
            <p className="text-xs text-text-muted">New-draft quarter matches the list filter until you edit it.</p>
          </div>
        </section>
      ) : (
        <p className="rounded-2xl border border-muted-surface bg-surface px-4 py-3 text-sm text-text-muted">
          New quarterly drafts are created by Independent Evaluators (or Super Admin). Use the list below to open reports in
          your scope.
        </p>
      )}

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-muted-surface bg-surface shadow-sm">
        <div className="border-b border-muted-surface px-4 py-3 text-sm text-text-muted">
          {loading ? 'Loading…' : `${total} report${total === 1 ? '' : 's'} (showing ${items.length})`}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-muted-surface text-sm">
            <thead className="bg-muted-surface/40 text-left text-xs uppercase text-text-muted">
              <tr>
                <th className="px-4 py-2">Quarter</th>
                <th className="px-4 py-2">School</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted-surface">
              {items.map((r) => (
                <tr
                  key={r.id}
                  className={
                    selected?.id === r.id ? 'cursor-pointer bg-secondary/10' : 'cursor-pointer hover:bg-muted-surface/30'
                  }
                  onClick={() => void loadDetail(r.id)}
                >
                  <td className="px-4 py-2 font-medium text-text-primary">{r.quarter}</td>
                  <td className="max-w-[280px] truncate px-4 py-2 text-sm text-text-primary" title={r.school_id}>
                    {schoolLabelById.get(r.school_id) ?? shortenId(r.school_id)}
                  </td>
                  <td className="px-4 py-2 capitalize text-text-secondary">{r.status}</td>
                  <td className="px-4 py-2 text-text-muted">{new Date(r.updated_at).toLocaleString()}</td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-text-muted">
                    No reports for this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <section className="space-y-4 rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                {selected.quarter} —{' '}
                <span className="text-base">
                  {schoolLabelById.get(selected.school_id) ?? shortenId(selected.school_id)}
                </span>
              </h2>
              <p className="mt-1 font-mono text-xs text-text-muted">ID {selected.school_id}</p>
              <p className="mt-1 text-sm capitalize text-text-muted">Status: {selected.status}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {showCompareLinks ? (
                <Link
                  to="/dashboard/reports/compare"
                  className="rounded-lg border border-muted-surface px-3 py-1.5 text-sm font-medium text-secondary hover:bg-muted-surface/40"
                >
                  Compare
                </Link>
              ) : null}
              {(user.role === 'super_admin' || user.role === 'ie') ? (
                <button
                  type="button"
                  disabled={saveBusy}
                  onClick={() => void onRefreshSnapshot()}
                  className="rounded-lg border border-muted-surface px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-muted-surface/40 disabled:opacity-50"
                >
                  Refresh metrics
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void onExport('xlsx')}
                className="rounded-lg border border-muted-surface px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-muted-surface/40"
              >
                Excel
              </button>
              <button
                type="button"
                onClick={() => void onExport('pdf')}
                className="rounded-lg border border-muted-surface px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-muted-surface/40"
              >
                PDF
              </button>
            </div>
          </div>

          {detailLoading ? (
            <p className="text-sm text-text-muted">Loading detail…</p>
          ) : (
            <>
              <div className="rounded-xl border border-muted-surface bg-section/50 p-4">
                <ReportSnapshotPanel snapshot={selected.generated_snapshot} />
              </div>

              {user.role === 'super_admin' && selected.status === 'submitted' ? (
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
                  <h3 className="text-sm font-semibold text-text-primary">Formal Super Admin decision</h3>
                  <p className="mt-1 text-xs text-text-muted">
                    Approve to lock the submission or reject to send narrative back for corrections (IE must revise while in
                    draft after reopen).
                  </p>
                  <label className="mt-3 block text-sm">
                    <span className="font-medium text-text-secondary">Decision remarks (optional)</span>
                    <textarea
                      value={decisionRemarks}
                      onChange={(e) => setDecisionRemarks(e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-muted-surface px-3 py-2 text-sm text-text-primary"
                      placeholder="Optional feedback attached to the approval/rejection record…"
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saveBusy}
                      onClick={() => void runDecision('approved')}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Approve report
                    </button>
                    <button
                      type="button"
                      disabled={saveBusy}
                      onClick={() => void runDecision('rejected')}
                      className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                    >
                      Reject & request changes
                    </button>
                  </div>
                </div>
              ) : null}

              {(selected.status === 'approved' || selected.status === 'rejected') && selected.review_remarks ? (
                <div className="rounded-xl border border-muted-surface bg-muted-surface/20 px-4 py-3 text-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Formal decision remarks
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-text-primary">{selected.review_remarks}</p>
                </div>
              ) : null}

              <div className="rounded-xl border border-muted-surface bg-section/40 p-4">
                <h3 className="text-sm font-semibold text-text-primary">PPP Node & partner oversight notes</h3>
                <p className="mt-1 text-xs text-text-muted">
                  Threaded review comments only—does not change KPI narrative fields or substitute formal approval above.
                </p>
                <ul className="mt-3 space-y-2">
                  {comments.map((c) => (
                    <li key={c.id} className="rounded-lg border border-muted-surface bg-surface px-3 py-2">
                      <p className="text-[11px] text-text-muted">
                        <span className="font-semibold text-text-secondary">{c.author_name ?? 'Reviewer'}</span>
                        {' · '}
                        {new Date(c.created_at).toLocaleString()}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-text-primary">{c.body}</p>
                    </li>
                  ))}
                  {comments.length === 0 ? (
                    <li className="text-xs italic text-text-muted">No oversight notes yet.</li>
                  ) : null}
                </ul>
                {canPostOversightNote ? (
                  <div className="mt-4 space-y-2 border-t border-muted-surface pt-4">
                    <label className="block text-sm">
                      <span className="font-medium text-text-secondary">Add oversight note</span>
                      <textarea
                        value={oversightNote}
                        onChange={(e) => setOversightNote(e.target.value)}
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-muted-surface px-3 py-2 text-sm text-text-primary"
                        placeholder="Observations for Government / NGO partner reviewers…"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={commentBusy || !oversightNote.trim()}
                      onClick={() => void postOversightNote()}
                      className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-primary disabled:opacity-50"
                    >
                      {commentBusy ? 'Posting…' : 'Post oversight note'}
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-text-muted">
                    Oversight notes are enabled for PPP Node (Government) and Partner Organization viewers with export
                    access.
                  </p>
                )}
              </div>

              <div className="border-t border-muted-surface pt-4">
                <h3 className="text-sm font-semibold text-text-primary">IE narrative & principal inputs</h3>
                <p className="mt-1 text-xs text-text-muted">
                  Super Admin may edit anytime; IE edits while status is draft. PPP Node / partners are view-only here—use
                  oversight notes above. PDF exports include KPI bar charts from the snapshot.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium text-text-secondary">Summary</span>
                  <textarea
                    value={formSummary}
                    disabled={!canPatchReportBody}
                    onChange={(e) => setFormSummary(e.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary disabled:bg-muted-surface/50"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-text-secondary">Recommendations</span>
                  <textarea
                    value={formRec}
                    disabled={!canPatchReportBody}
                    onChange={(e) => setFormRec(e.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary disabled:bg-muted-surface/50"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-text-secondary">Principal — infrastructure notes</span>
                  <textarea
                    value={formInfra}
                    disabled={!canPatchReportBody}
                    onChange={(e) => setFormInfra(e.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary disabled:bg-muted-surface/50"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-text-secondary">Principal — daily activity notes</span>
                  <textarea
                    value={formDaily}
                    disabled={!canPatchReportBody}
                    onChange={(e) => setFormDaily(e.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary disabled:bg-muted-surface/50"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saveBusy || !canPatchReportBody}
                  onClick={() => void onSaveBody()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-50"
                >
                  Save fields
                </button>
                {canSubmitDraft ? (
                  <button
                    type="button"
                    disabled={saveBusy}
                    onClick={() => void onSubmitForReview()}
                    className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-primary disabled:opacity-50"
                  >
                    Submit for Super Admin review
                  </button>
                ) : null}
                {user.role === 'super_admin' && selected.status === 'rejected' ? (
                  <button
                    type="button"
                    disabled={saveBusy}
                    onClick={() => void onReopenDraft()}
                    className="rounded-lg border border-danger px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/10"
                  >
                    Reopen as draft
                  </button>
                ) : null}
              </div>
            </>
          )}
        </section>
      ) : null}
    </div>
  )
}
