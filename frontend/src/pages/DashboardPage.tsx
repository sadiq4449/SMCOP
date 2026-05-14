import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { roleLabels } from '../config/navigation'
import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import {
  getDashboardDistrict,
  getDashboardGovernment,
  getDashboardSchool,
  getDashboardSystem,
} from '../services/dashboardApi'
import { getDistricts } from '../services/schoolsApi'
import type { District } from '../types/school'

function quarterNow() {
  const d = new Date()
  const q = Math.floor(d.getMonth() / 3) + 1
  return `Q${q}-${d.getFullYear()}`
}

function barPct(score: number | null | undefined): number | null {
  if (score == null || Number.isNaN(Number(score))) return null
  const n = Number(score)
  if (n < 0) return 0
  return Math.min(100, Math.round(n))
}

function Card({
  title,
  value,
  hint,
  tone,
}: {
  title: string
  value: string | number
  hint?: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}) {
  const border =
    tone === 'success'
      ? 'border-[color:var(--color-success)]/40'
      : tone === 'warning'
        ? 'border-amber-500/40'
        : tone === 'danger'
          ? 'border-[color:var(--color-danger)]/40'
          : 'border-muted-surface'
  return (
    <article className={`rounded-2xl border ${border} bg-surface p-4 shadow-sm`}>
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-text-primary">{value}</p>
      {hint ? <p className="mt-1 text-xs text-text-secondary">{hint}</p> : null}
    </article>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const [quarter, setQuarter] = useState(quarterNow)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [main, setMain] = useState<Record<string, unknown> | null>(null)
  const [districtDetail, setDistrictDetail] = useState<Record<string, unknown> | null>(null)
  const [districts, setDistricts] = useState<District[]>([])
  const [govDistrictId, setGovDistrictId] = useState('')

  const assigned = useMemo(() => user?.assigned_schools ?? [], [user?.assigned_schools])
  const primarySchoolId = assigned[0] ?? ''

  useEffect(() => {
    if (user?.role !== 'government') return
    void getDistricts()
      .then((d) => {
        setDistricts(d)
        setGovDistrictId((prev) => prev || d[0]?.id || '')
      })
      .catch(() => {})
  }, [user?.role])

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const q = quarter.trim() || undefined
      if (user.role === 'super_admin') {
        const d = await getDashboardSystem({ quarter: q, district_limit: 25 })
        setMain(d)
        setDistrictDetail(null)
      } else if (user.role === 'government') {
        const d = await getDashboardGovernment({ quarter: q, district_limit: 25 })
        setMain(d)
        if (govDistrictId.trim()) {
          const dist = await getDashboardDistrict({ quarter: q, district_id: govDistrictId.trim() })
          setDistrictDetail(dist)
        } else {
          setDistrictDetail(null)
        }
      } else if (user.role === 'deo') {
        const dist = await getDashboardDistrict({ quarter: q })
        setMain(null)
        setDistrictDetail(dist)
      } else if (user.role === 'principal' || user.role === 'teacher' || user.role === 'enumerator') {
        if (!primarySchoolId) {
          setMain(null)
          setDistrictDetail(null)
        } else {
          const s = await getDashboardSchool(primarySchoolId, { quarter: q })
          setMain(s)
          setDistrictDetail(null)
        }
      } else {
        setMain(null)
        setDistrictDetail(null)
      }
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Could not load dashboard'))
      setMain(null)
      setDistrictDetail(null)
    } finally {
      setLoading(false)
    }
  }, [user, quarter, govDistrictId, primarySchoolId])

  useEffect(() => {
    void reload()
  }, [reload])

  if (!user) return null

  const totals =
    main && typeof main.totals === 'object' && main.totals !== null ? (main.totals as Record<string, unknown>) : null
  const districtRows =
    main && Array.isArray(main.districts) ? (main.districts as Record<string, unknown>[]) : null
  const heatmap =
    main && typeof main.heatmap === 'object' && main.heatmap !== null ? (main.heatmap as Record<string, unknown>) : null
  const issues =
    main && typeof main.issues === 'object' && main.issues !== null ? (main.issues as Record<string, unknown>) : null

  const enrollment =
    main && Array.isArray(main.enrollment_trend) ? (main.enrollment_trend as Record<string, unknown>[]) : null
  const attendance =
    main && typeof main.attendance === 'object' && main.attendance !== null
      ? (main.attendance as Record<string, unknown>)
      : null
  const kpiTrend = main && Array.isArray(main.kpi_trend) ? (main.kpi_trend as Record<string, unknown>[]) : null
  const visitsRecent = main && Array.isArray(main.visits_recent) ? (main.visits_recent as Record<string, unknown>[]) : null

  const distSchools =
    districtDetail && Array.isArray(districtDetail.schools)
      ? (districtDetail.schools as Record<string, unknown>[])
      : null
  const lowPerformers =
    districtDetail && Array.isArray(districtDetail.low_performers)
      ? (districtDetail.low_performers as Record<string, unknown>[])
      : null

  const maxEnrollment = enrollment?.length
    ? Math.max(...enrollment.map((r) => Number(r.total) || 0), 1)
    : 1

  const schoolDash =
    main &&
    typeof main.school_id === 'string' &&
    (user.role === 'principal' || user.role === 'teacher' || user.role === 'enumerator')

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Dashboard</p>
        <h1 className="mt-2 text-2xl font-semibold text-text-primary">{roleLabels[user.role]} analytics</h1>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">
          Quarter-scoped KPIs and operations. Metrics align with visit snapshots and attendance windows for the same
          quarter (Iteration 8).
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Quarter</span>
            <input
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className="w-36 rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
            />
          </label>
          {user.role === 'government' ? (
            <label className="block min-w-[200px] text-sm">
              <span className="mb-1 block font-medium text-text-secondary">District drill-down</span>
              <select
                value={govDistrictId}
                onChange={(e) => setGovDistrictId(e.target.value)}
                className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
              >
                <option value="">Select district…</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            disabled={loading}
            onClick={() => void reload()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </section>

      {error ? (
        <p
          className="rounded-lg bg-[color:var(--color-danger)]/10 px-4 py-3 text-sm text-[color:var(--color-danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {loading ? <p className="text-sm text-text-muted">Loading dashboard…</p> : null}

      {!loading &&
      (user.role === 'principal' || user.role === 'teacher' || user.role === 'enumerator') &&
      !primarySchoolId ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-text-secondary">
          No assigned school on your account yet. Ask a Super Admin to assign <span className="font-mono">assigned_schools</span>.
        </p>
      ) : null}

      {totals ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">National totals</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card title="Schools" value={String(totals.schools ?? '—')} />
            <Card
              title="Visits (quarter)"
              value={String(totals.visits ?? '—')}
              hint="All visit rows for the selected quarter"
            />
            <Card title="Finalized visits" value={String(totals.visits_finalized ?? '—')} tone="success" />
            <Card title="Draft visits" value={String(totals.visits_draft ?? '—')} tone="warning" />
            <Card
              title="Avg aggregate score"
              value={totals.overall_avg_aggregate_score != null ? String(totals.overall_avg_aggregate_score) : '—'}
              hint="Finalized visits with scores only"
            />
          </div>
        </section>
      ) : null}

      {issues ? (
        <section className="rounded-xl border border-muted-surface bg-section/40 px-4 py-3 text-sm text-text-secondary">
          <span className="font-medium text-text-primary">Issues: </span>
          {String(issues.note ?? '')} (open: {String(issues.open_count ?? 0)})
        </section>
      ) : null}

      {heatmap && user.role === 'super_admin' ? (
        <section className="rounded-xl border border-dashed border-muted-surface bg-muted-surface/20 p-4 text-sm text-text-muted">
          Heatmap: {String(heatmap.message ?? '—')}
        </section>
      ) : null}

      {districtRows && districtRows.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-muted-surface bg-surface shadow-sm">
          <div className="border-b border-muted-surface px-4 py-3 text-sm font-medium text-text-primary">District breakdown</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-muted-surface text-sm">
              <thead className="bg-muted-surface/40 text-left text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-2">District</th>
                  <th className="px-4 py-2">Schools</th>
                  <th className="px-4 py-2">Visits</th>
                  <th className="px-4 py-2">Finalized</th>
                  <th className="px-4 py-2">Avg score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted-surface">
                {districtRows.map((r) => {
                  const sc = barPct(r.avg_aggregate_score as number | null)
                  return (
                    <tr key={String(r.district_id)}>
                      <td className="px-4 py-2">
                        <div className="font-medium text-text-primary">{String(r.district_name ?? '')}</div>
                        <div className="font-mono text-xs text-text-muted">{String(r.district_id ?? '')}</div>
                      </td>
                      <td className="px-4 py-2 text-text-secondary">{String(r.school_count ?? '')}</td>
                      <td className="px-4 py-2 text-text-secondary">{String(r.visits ?? '')}</td>
                      <td className="px-4 py-2 text-text-secondary">{String(r.visits_finalized ?? '')}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-text-secondary">{String(r.avg_aggregate_score ?? '—')}</span>
                          {sc != null ? (
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-muted-surface">
                              <div className="h-full bg-[color:var(--color-success)]" style={{ width: `${sc}%` }} />
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!loading && districtRows && districtRows.length === 0 && (user.role === 'super_admin' || user.role === 'government') ? (
        <p className="text-sm text-text-muted">No districts on this page (empty database or beyond pagination).</p>
      ) : null}

      {districtDetail ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">
            District operations — {String(districtDetail.district_name ?? '')}{' '}
            <span className="font-mono text-sm font-normal text-text-muted">({String(districtDetail.district_id ?? '')})</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card title="Pending draft visits" value={String(districtDetail.pending_draft_visits ?? 0)} tone="warning" />
            <Card title="Reports awaiting review" value={String(districtDetail.pending_report_reviews ?? 0)} tone="warning" />
            <Card
              title="Schools with facility gaps"
              value={
                Array.isArray(districtDetail.facility_gap_school_ids)
                  ? (districtDetail.facility_gap_school_ids as string[]).length
                  : 0
              }
              tone="danger"
            />
          </div>

          {lowPerformers && lowPerformers.length > 0 ? (
            <div className="rounded-xl border border-[color:var(--color-danger)]/25 bg-[color:var(--color-danger)]/5 p-4">
              <h3 className="text-sm font-semibold text-text-primary">Lowest finalized scores (top {lowPerformers.length})</h3>
              <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                {lowPerformers.map((r) => (
                  <li key={String(r.school_id)}>
                    {String(r.school_name)} — <span className="font-mono">{String(r.school_id)}</span> — score{' '}
                    {String(r.aggregate_score)}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-text-muted">No finalized scores for ranking this quarter.</p>
          )}

          {distSchools && distSchools.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-muted-surface">
              <table className="min-w-full divide-y divide-muted-surface text-sm">
                <thead className="bg-muted-surface/40 text-left text-xs uppercase text-text-muted">
                  <tr>
                    <th className="px-3 py-2">School</th>
                    <th className="px-3 py-2">Visit</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">Report</th>
                    <th className="px-3 py-2">Fac. gaps</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted-surface">
                  {distSchools.map((s) => (
                    <tr key={String(s.school_id)}>
                      <td className="px-3 py-2">
                        <Link
                          to={`/dashboard/schools/${String(s.school_id)}`}
                          className="font-medium text-secondary hover:text-primary"
                        >
                          {String(s.name ?? '')}
                        </Link>
                        <div className="font-mono text-xs text-text-muted">{String(s.school_id)}</div>
                      </td>
                      <td className="px-3 py-2 capitalize text-text-secondary">{String(s.visit_status ?? '—')}</td>
                      <td className="px-3 py-2 text-text-secondary">{String(s.aggregate_score ?? '—')}</td>
                      <td className="px-3 py-2 capitalize text-text-secondary">{String(s.report_status ?? '—')}</td>
                      <td className="px-3 py-2 text-text-secondary">{String(s.facility_gap_items ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-text-muted">No schools in this district page.</p>
          )}
        </section>
      ) : null}

      {schoolDash ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">
            {String(main?.school_name ?? 'School')}{' '}
            <span className="font-mono text-sm font-normal text-text-muted">({String(main?.school_id)})</span>
          </h2>
          {main && typeof main.report === 'object' && main.report !== null ? (
            <p className="text-sm text-text-secondary">
              Report status:{' '}
              <span className="capitalize text-text-primary">
                {String((main.report as Record<string, unknown>).status ?? '')}
              </span>
            </p>
          ) : null}

          {enrollment && enrollment.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Enrollment trend</h3>
              <div className="mt-2 space-y-2">
                {enrollment.map((row) => {
                  const t = Number(row.total) || 0
                  const w = Math.round((t / maxEnrollment) * 100)
                  return (
                    <div key={String(row.quarter)} className="flex items-center gap-3 text-sm">
                      <span className="w-20 font-mono text-text-muted">{String(row.quarter)}</span>
                      <div className="h-3 max-w-md flex-1 overflow-hidden rounded-full bg-muted-surface">
                        <div className="h-full bg-secondary" style={{ width: `${w}%` }} />
                      </div>
                      <span className="text-text-secondary">
                        total {t} (boys {String(row.boys)}, girls {String(row.girls)})
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-muted">No enrollment snapshots yet.</p>
          )}

          {attendance ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Card title="Teacher rows (quarter)" value={String(attendance.teacher_attendance_rows ?? 0)} />
              <Card title="Teacher approved (quarter)" value={String(attendance.teacher_approved_rows ?? 0)} tone="success" />
              <Card title="Student daily rows (quarter)" value={String(attendance.student_daily_rows ?? 0)} />
              <Card title="Teacher rows (30d)" value={String(attendance.last_30d_teacher_rows ?? 0)} hint="Rolling window" />
              <Card title="Student days (30d)" value={String(attendance.last_30d_student_days ?? 0)} />
            </div>
          ) : null}

          {kpiTrend && kpiTrend.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-text-primary">KPI / visit score trend</h3>
              <div className="mt-2 space-y-2">
                {kpiTrend.map((row) => {
                  const p = barPct(row.aggregate_score as number | null)
                  return (
                    <div key={String(row.quarter)} className="flex items-center gap-3 text-sm">
                      <span className="w-20 font-mono text-text-muted">{String(row.quarter)}</span>
                      <span className="w-20 capitalize text-text-secondary">{String(row.status)}</span>
                      <div className="h-3 max-w-md flex-1 overflow-hidden rounded-full bg-muted-surface">
                        {p != null ? <div className="h-full bg-primary" style={{ width: `${p}%` }} /> : null}
                      </div>
                      <span className="text-text-secondary">{String(row.aggregate_score ?? '—')}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          {visitsRecent && visitsRecent.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Recent visits</h3>
              <ul className="mt-2 space-y-1 font-mono text-xs text-text-secondary">
                {visitsRecent.map((v) => (
                  <li key={String(v.visit_id)}>
                    {String(v.quarter)} · {String(v.status)} · score {String(v.aggregate_score ?? '—')}{' '}
                    <Link to={`/dashboard/monitoring/${String(v.visit_id)}`} className="text-secondary hover:text-primary">
                      open
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Link
              to={`/dashboard/schools/${String(main?.school_id)}`}
              className="rounded-lg border border-muted-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-section"
            >
              School profile
            </Link>
            {(user.role === 'principal' || user.role === 'teacher') && (
              <Link
                to="/dashboard/attendance"
                className="rounded-lg border border-muted-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-section"
              >
                Attendance
              </Link>
            )}
          </div>
        </section>
      ) : null}

      {!loading &&
      user.role !== 'super_admin' &&
      user.role !== 'government' &&
      user.role !== 'deo' &&
      user.role !== 'principal' &&
      user.role !== 'teacher' &&
      user.role !== 'enumerator' ? (
        <p className="text-sm text-text-muted">No dashboard module for this role.</p>
      ) : null}
    </div>
  )
}
