import { useEffect, useState } from 'react'

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

function formatDate(iso: unknown): string {
  if (typeof iso !== 'string' || !iso.trim()) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function infraStatusLabel(status: string): string {
  const map: Record<string, string> = {
    available: 'Available',
    not_available: 'Not available',
    needs_repair: 'Needs repair',
  }
  return map[status] ?? status.replace(/_/g, ' ')
}

function visitStatusLabel(status: unknown): string {
  if (typeof status !== 'string') return '—'
  return status.replace(/_/g, ' ')
}

function KpiPerformanceBar({ score, maxScore }: { score: unknown; maxScore: unknown }) {
  const [pctDisplay, setPctDisplay] = useState(0)
  let mx = Number(maxScore)
  if (!Number.isFinite(mx) || mx <= 0) mx = 5
  let sc = Number(score)
  if (!Number.isFinite(sc)) sc = 0
  const target = Math.min(100, Math.round((sc / mx) * 100))

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setPctDisplay(target)
      return
    }
    setPctDisplay(0)
    const id = window.requestAnimationFrame(() => setPctDisplay(target))
    return () => window.cancelAnimationFrame(id)
  }, [target])

  return (
    <div className="flex min-w-[120px] items-center gap-2">
      <div className="h-2 min-w-[72px] flex-1 overflow-hidden rounded-full bg-muted-surface">
        <div
          className="h-full rounded-full bg-gradient-to-r from-secondary to-primary transition-[width] duration-[850ms] ease-out"
          style={{ width: `${pctDisplay}%` }}
        />
      </div>
      <span className="shrink-0 tabular-nums text-[11px] text-text-muted">{target}%</span>
    </div>
  )
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-muted-surface bg-section/80 px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-text-primary">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-text-muted">{hint}</p> : null}
    </div>
  )
}

function RawSnapshotDetails({ snapshot }: { snapshot: Record<string, unknown> }) {
  return (
    <details className="rounded-lg border border-muted-surface bg-muted-surface/15">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-text-muted hover:bg-muted-surface/30 hover:text-text-secondary">
        Raw snapshot (JSON) — technical / support only
      </summary>
      <pre className="max-h-44 overflow-auto border-t border-muted-surface p-3 font-mono text-[11px] leading-relaxed text-text-secondary">
        {JSON.stringify(snapshot, null, 2)}
      </pre>
    </details>
  )
}

export function ReportSnapshotPanel({ snapshot }: { snapshot: Record<string, unknown> | null | undefined }) {
  if (!snapshot || Object.keys(snapshot).length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-muted-surface bg-muted-surface/20 px-4 py-6 text-center text-sm text-text-muted">
        No auto-generated snapshot on this report yet. Metrics appear when the system can tie this quarter to
        monitoring and attendance data.
      </div>
    )
  }

  const visitFound = snapshot.visit_found === true
  const message = typeof snapshot.message === 'string' ? snapshot.message : null

  if (!visitFound) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-text-secondary">
          <p className="font-semibold text-amber-900">Visit data not linked for this quarter</p>
          <p className="mt-1 text-text-secondary">
            {message ?? 'There is no finalized monitoring visit for this school and quarter, or data is still being recorded.'}
          </p>
        </div>
        <RawSnapshotDetails snapshot={snapshot} />
      </div>
    )
  }

  const quarter = typeof snapshot.quarter === 'string' ? snapshot.quarter : '—'
  const visitId = typeof snapshot.visit_id === 'string' ? snapshot.visit_id : null
  const visitDate = snapshot.visit_date
  const visitStatus = visitStatusLabel(snapshot.visit_status)
  const aggRaw = snapshot.aggregate_score
  const aggNum = typeof aggRaw === 'number' ? aggRaw : typeof aggRaw === 'string' ? Number(aggRaw) : NaN
  const agg =
    aggRaw != null && aggRaw !== '' && Number.isFinite(aggNum) ? `${aggNum.toFixed(aggNum % 1 === 0 ? 0 : 1)}%` : '—'

  const kpiScores = Array.isArray(snapshot.kpi_scores) ? snapshot.kpi_scores : []
  const infraRows = Array.isArray(snapshot.infrastructure_checklist) ? snapshot.infrastructure_checklist : []

  const overallHint =
    agg === '—' && kpiScores.length > 0
      ? 'KPI scores exist but no weighted total yet — click Refresh metrics to sync from the visit.'
      : 'Weighted average from the monitoring KPI rubric'

  const obsCount =
    typeof snapshot.classroom_observation_count === 'number'
      ? String(snapshot.classroom_observation_count)
      : typeof snapshot.classroom_observation_count === 'string'
        ? snapshot.classroom_observation_count
        : '—'

  const attendance = isRecord(snapshot.attendance) ? snapshot.attendance : null
  const periodStart = attendance ? formatDate(attendance.period_start) : '—'
  const periodEnd = attendance ? formatDate(attendance.period_end) : '—'
  const teacherRows =
    typeof attendance?.approved_teacher_attendance_rows === 'number'
      ? String(attendance.approved_teacher_attendance_rows)
      : '—'
  const studentEntries =
    typeof attendance?.student_daily_entries === 'number' ? String(attendance.student_daily_entries) : '—'
  const boysSum =
    typeof attendance?.student_boys_present_sum === 'number' ? String(attendance.student_boys_present_sum) : '—'
  const girlsSum =
    typeof attendance?.student_girls_present_sum === 'number' ? String(attendance.student_girls_present_sum) : '—'

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Quarter monitoring snapshot</h3>
        <p className="mt-1 text-xs text-text-muted">
          Figures below are read-only and refreshed from the finalized visit and attendance registers for{' '}
          <span className="font-medium text-text-secondary">{quarter}</span>. Independent Evaluators update registers under{' '}
          <span className="font-medium text-text-secondary">Schools → school detail → Attendance registers</span>, then use{' '}
          <span className="font-medium text-text-secondary">Refresh metrics</span> on this report.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Overall visit score" value={agg === '—' ? 'Not scored' : agg} hint={overallHint} />
        <MetricCard label="Classroom observations" value={obsCount} hint="Linked to this visit" />
        <MetricCard label="Visit status" value={visitStatus} />
        <MetricCard label="Visit date" value={formatDate(visitDate)} />
      </div>

      {visitId ? (
        <p className="text-xs text-text-muted">
          Monitoring visit ID:{' '}
          <span className="break-all font-mono text-text-secondary" title={visitId}>
            {visitId}
          </span>
        </p>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-muted-surface bg-section/50">
        <div className="border-b border-muted-surface bg-muted-surface/30 px-4 py-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Attendance in this quarter</h4>
          <p className="mt-0.5 text-xs text-text-muted">
            Period {periodStart} — {periodEnd}
          </p>
        </div>
        <div className="grid gap-px bg-muted-surface sm:grid-cols-2 lg:grid-cols-4">
          {[
            { k: 'Approved teacher attendance rows', v: teacherRows },
            { k: 'Student daily register rows', v: studentEntries },
            { k: 'Student boys present (sum)', v: boysSum },
            { k: 'Student girls present (sum)', v: girlsSum },
          ].map((cell) => (
            <div key={cell.k} className="bg-surface px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{cell.k}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-text-primary">{cell.v}</p>
            </div>
          ))}
        </div>
      </section>

      {kpiScores.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-muted-surface">
          <div className="border-b border-muted-surface bg-muted-surface/30 px-4 py-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">KPI scores</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-muted-surface text-sm">
              <thead className="bg-section text-left text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-2">Indicator</th>
                  <th className="px-4 py-2">Score</th>
                  <th className="px-4 py-2">Max</th>
                  <th className="px-4 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted-surface">
                {kpiScores.map((row, idx) => {
                  if (!isRecord(row)) return null
                  const name = typeof row.kpi_name === 'string' ? row.kpi_name : `KPI ${idx + 1}`
                  const score = row.score != null ? String(row.score) : '—'
                  const max = row.max_score != null ? String(row.max_score) : '—'
                  const remarks = typeof row.remarks === 'string' && row.remarks.trim() ? row.remarks : '—'
                  return (
                    <tr key={typeof row.kpi_id === 'string' ? row.kpi_id : idx} className="bg-surface">
                      <td className="px-4 py-2 font-medium text-text-primary">{name}</td>
                      <td className="px-4 py-2">
                        <KpiPerformanceBar score={row.score} maxScore={row.max_score} />
                      </td>
                      <td className="px-4 py-2 tabular-nums text-text-secondary">{score}</td>
                      <td className="px-4 py-2 tabular-nums text-text-muted">{max}</td>
                      <td className="max-w-xs px-4 py-2 text-xs text-text-muted">{remarks}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {infraRows.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-muted-surface">
          <div className="border-b border-muted-surface bg-muted-surface/30 px-4 py-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Infrastructure checklist</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-muted-surface text-sm">
              <thead className="bg-section text-left text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted-surface">
                {infraRows.map((row, idx) => {
                  if (!isRecord(row)) return null
                  const item = typeof row.item_name === 'string' ? row.item_name : `Item ${idx + 1}`
                  const st = typeof row.status === 'string' ? infraStatusLabel(row.status) : '—'
                  const remarks = typeof row.remarks === 'string' && row.remarks.trim() ? row.remarks : '—'
                  return (
                    <tr key={idx} className="bg-surface">
                      <td className="px-4 py-2 text-text-primary">{item}</td>
                      <td className="px-4 py-2 text-text-secondary">{st}</td>
                      <td className="max-w-md px-4 py-2 text-xs text-text-muted">{remarks}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <RawSnapshotDetails snapshot={snapshot} />
    </div>
  )
}
