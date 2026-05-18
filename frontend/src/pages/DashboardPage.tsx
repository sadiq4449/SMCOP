import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  DashboardGaugeBoard,
  kpiAggregateToPercent,
  type ScoreGaugeCardDef,
} from '../components/dashboard/ScoreGaugeStrip'
import { PremiumEyebrow, PremiumMetricCard, PremiumPanel } from '../components/premium/PremiumMetricCard'
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

function ratioPct(num: unknown, den: unknown): number | null {
  const a = Number(num)
  const b = Number(den)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null
  return Math.min(100, Math.round((a / b) * 100))
}

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)))
}

function meanAggregateScore(rows: Record<string, unknown>[] | null): number | null {
  if (!rows?.length) return null
  const nums = rows.map((r) => Number(r.aggregate_score)).filter((x) => Number.isFinite(x))
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/** Title-case segments for display without changing stored geography names. */
function formatGeographicDisplayName(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  return s
    .split(/(\s+|-)/)
    .map((part) => {
      if (/^\s+$/.test(part)) return part
      if (part === '-') return part
      if (!part) return part
      const lower = part.toLocaleLowerCase()
      return lower.charAt(0).toLocaleUpperCase() + lower.slice(1)
    })
    .join('')
}

function formatAvgAggregateCell(v: unknown): string {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(2)
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
  /** Bumps after each successful load so score rings replay their entrance animation. */
  const [gaugeAnim, setGaugeAnim] = useState(0)

  const assigned = useMemo(() => user?.assigned_schools ?? [], [user?.assigned_schools])
  const primarySchoolId = assigned[0] ?? ''

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
        const detailId = govDistrictId.trim()
        const [districtList, govMain, distRaw] = await Promise.all([
          getDistricts().catch(() => [] as District[]),
          getDashboardGovernment({ quarter: q, district_limit: 25 }),
          detailId ? getDashboardDistrict({ quarter: q, district_id: detailId }) : Promise.resolve(null),
        ])
        setDistricts(districtList)
        setMain(govMain)
        setDistrictDetail(distRaw && typeof distRaw === 'object' ? (distRaw as Record<string, unknown>) : null)
      } else if (user.role === 'ie') {
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
      setGaugeAnim((n) => n + 1)
    }
  }, [user, quarter, govDistrictId, primarySchoolId])

  useEffect(() => {
    void reload()
  }, [reload])

  const nationalGaugeCards = useMemo((): ScoreGaugeCardDef[] => {
    const t =
      main && typeof main.totals === 'object' && main.totals !== null ? (main.totals as Record<string, unknown>) : null
    if (!t) return []
    const iss =
      main && typeof main.issues === 'object' && main.issues !== null ? (main.issues as Record<string, unknown>) : null

    const overall = kpiAggregateToPercent(t.overall_avg_aggregate_score as number | null)
    const fin = ratioPct(t.visits_finalized, t.visits)
    const draft = ratioPct(t.visits_draft, t.visits)
    const visits = Number(t.visits) || 0
    const schools = Number(t.schools) || 0
    const pulse = schools > 0 ? clampPct((visits / schools) * 22) : null

    const cards: ScoreGaugeCardDef[] = [
      {
        key: 'overall',
        label: 'Overall score',
        hint: 'Avg KPI index (0–5 scaled to 100)',
        ringProgress: overall,
        displayValue: overall ?? '—',
      },
      {
        key: 'certainty',
        label: 'Visit certainty',
        hint: 'Share of finalized visits',
        ringProgress: fin,
        displayValue: fin ?? '—',
      },
      {
        key: 'drafts',
        label: 'Draft load',
        hint: 'Draft share of quarter visits',
        ringProgress: draft,
        displayValue: draft ?? '—',
      },
      {
        key: 'pulse',
        label: 'Field pulse',
        hint: 'Visits per school (scaled)',
        ringProgress: pulse,
        displayValue: pulse ?? '—',
      },
      {
        key: 'schools',
        label: 'Schools',
        hint: 'In national registry',
        ringProgress: null,
        displayValue: String(t.schools ?? '—'),
      },
    ]

    if (iss && iss.open_count != null) {
      const oc = Number(iss.open_count)
      if (Number.isFinite(oc) && oc >= 0) {
        cards.push({
          key: 'issues',
          label: 'Open issues',
          hint: 'Workload in the queue',
          ringProgress: oc <= 0 ? 0 : clampPct(oc * 9),
          displayValue: oc,
        })
      }
    }

    return cards
  }, [main])

  const districtGaugeCards = useMemo((): ScoreGaugeCardDef[] => {
    if (!districtDetail) return []
    const schools = Array.isArray(districtDetail.schools)
      ? (districtDetail.schools as Record<string, unknown>[])
      : []
    const low = Array.isArray(districtDetail.low_performers)
      ? (districtDetail.low_performers as Record<string, unknown>[])
      : []
    const gapIds = Array.isArray(districtDetail.facility_gap_school_ids)
      ? (districtDetail.facility_gap_school_ids as string[])
      : []

    const mean = meanAggregateScore(schools)
    const kpiIdx = kpiAggregateToPercent(mean)
    const pDraft = Number(districtDetail.pending_draft_visits) || 0
    const pRep = Number(districtDetail.pending_report_reviews) || 0
    const gaps = gapIds.length
    const lows = low.length

    return [
      {
        key: 'kpi',
        label: 'District KPI',
        hint: 'Avg visit score on this page',
        ringProgress: kpiIdx,
        displayValue: kpiIdx ?? '—',
      },
      {
        key: 'draft',
        label: 'Draft pressure',
        hint: 'Pending IE visits',
        ringProgress: clampPct(pDraft * 8),
        displayValue: pDraft,
      },
      {
        key: 'reports',
        label: 'Report queue',
        hint: 'Awaiting review',
        ringProgress: clampPct(pRep * 12),
        displayValue: pRep,
      },
      {
        key: 'facilities',
        label: 'Facility signals',
        hint: 'Schools with infra gaps',
        ringProgress: clampPct(gaps * 14),
        displayValue: gaps,
      },
      {
        key: 'risk',
        label: 'Risk basket',
        hint: 'Tracked low performers',
        ringProgress: clampPct(lows * 18),
        displayValue: lows,
      },
    ]
  }, [districtDetail])

  const schoolGaugeCards = useMemo((): ScoreGaugeCardDef[] => {
    if (!main || typeof main.school_id !== 'string') return []
    const kt = Array.isArray(main.kpi_trend) ? (main.kpi_trend as Record<string, unknown>[]) : null
    const att =
      typeof main.attendance === 'object' && main.attendance !== null
        ? (main.attendance as Record<string, unknown>)
        : null
    const enrol = Array.isArray(main.enrollment_trend) ? (main.enrollment_trend as Record<string, unknown>[]) : null

    const qn = quarter.trim()
    let row: Record<string, unknown> | null = null
    if (kt?.length) {
      row = kt.find((r) => String(r.quarter) === qn) ?? null
      if (!row) {
        for (let i = kt.length - 1; i >= 0; i--) {
          if (kt[i].aggregate_score != null) {
            row = kt[i]
            break
          }
        }
        if (!row) row = kt[kt.length - 1]
      }
    }

    const kpiPct = kpiAggregateToPercent(row?.aggregate_score as number | null)
    const teach = ratioPct(att?.teacher_approved_rows, att?.teacher_attendance_rows)
    const s30 = Number(att?.last_30d_student_days) || 0
    const t30 = Number(att?.last_30d_teacher_rows) || 0
    const mix = s30 + t30 > 0 ? clampPct((s30 / (s30 + t30)) * 100) : null

    let enrollPct: number | null = null
    let enrollTot = 0
    if (enrol?.length) {
      const mx = Math.max(...enrol.map((r) => Number(r.total) || 0), 1)
      const last = enrol[enrol.length - 1]
      enrollTot = Number(last.total) || 0
      enrollPct = clampPct((enrollTot / mx) * 100)
    }

    return [
      {
        key: 'kpi',
        label: 'Visit KPI',
        hint: row ? `Quarter ${String(row.quarter)}` : 'Latest visit signal',
        ringProgress: kpiPct,
        displayValue: kpiPct ?? '—',
      },
      {
        key: 'teachers',
        label: 'Teacher approvals',
        hint: 'Approved rows this quarter',
        ringProgress: teach,
        displayValue: teach ?? '—',
      },
      {
        key: 'rolling',
        label: 'Rolling mix',
        hint: 'Student vs teacher capture (30d)',
        ringProgress: mix,
        displayValue: mix ?? '—',
      },
      {
        key: 'enrollment',
        label: 'Enrollment pulse',
        hint: 'Latest headcount vs peak',
        ringProgress: enrollPct,
        displayValue: enrollTot > 0 ? enrollTot : '—',
        centerSuffix: null,
      },
    ]
  }, [main, quarter])

  if (!user) return null

  const totals =
    main && typeof main.totals === 'object' && main.totals !== null ? (main.totals as Record<string, unknown>) : null
  const districtRows =
    main && Array.isArray(main.districts) ? (main.districts as Record<string, unknown>[]) : null
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
    main && typeof main.school_id === 'string' && user.role === 'ie'

  const execSummary =
    totals != null
      ? `National view for ${quarter.trim() || 'the selected quarter'}: ${String(totals.schools ?? '—')} schools in scope, ${String(totals.visits_finalized ?? '—')} finalized visits, and ${String(totals.visits_draft ?? '—')} drafts still in flight.`
      : districtDetail != null
        ? `District command view for ${formatGeographicDisplayName(String(districtDetail.district_name ?? 'selected geography'))} — monitor drafts, report reviews, and facility signals before they escalate.`
        : schoolDash
          ? `School operational picture for ${String(main?.school_name ?? 'your assigned school')} — enrollment momentum, attendance compliance, and visit quality in one place.`
          : `Quarter-scoped intelligence for ${roleLabels[user.role]}. Metrics align with finalized visits and attendance registers.`

  return (
    <div className="space-y-10">
      <PremiumPanel>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-3xl animate-premium-in">
            <PremiumEyebrow>Monitoring intelligence</PremiumEyebrow>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary sm:text-[2rem] sm:leading-tight">
              {roleLabels[user.role]}
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-text-secondary">{execSummary}</p>
          </div>
          <div className="flex flex-wrap items-end gap-4 animate-premium-in" style={{ animationDelay: '60ms' }}>
            <label className="block min-w-[8.5rem]">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">Quarter</span>
              <input
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                className="w-full !text-[13px]"
                placeholder="e.g. Q2-2026"
              />
            </label>
            {user.role === 'government' ? (
              <label className="block min-w-[200px] flex-1">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  District
                </span>
                <select
                  value={govDistrictId}
                  onChange={(e) => setGovDistrictId(e.target.value)}
                  className="w-full !text-[13px]"
                >
                  <option value="">All / select…</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {formatGeographicDisplayName(d.name)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button
              type="button"
              disabled={loading}
              onClick={() => void reload()}
              className="rounded-xl border border-slate-200/90 bg-slate-900/[0.04] px-5 py-2.5 text-[13px] font-medium text-text-primary transition-colors duration-200 hover:bg-slate-900/[0.07] disabled:opacity-45"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </PremiumPanel>

      {error ? (
        <div
          className="animate-premium-in rounded-xl border border-rose-200/80 bg-rose-50/90 px-5 py-4 text-sm text-rose-900"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="animate-premium-in pl-1 text-sm font-medium text-text-muted">Loading operational metrics…</p>
      ) : null}

      {!loading &&
      (user.role === 'ie') &&
      !primarySchoolId ? (
        <div className="animate-premium-in rounded-xl border border-amber-200/90 bg-amber-50/90 px-5 py-4 text-sm text-amber-950">
          No assigned school on your account yet. Ask a Super Admin to assign{' '}
          <span className="font-mono text-[13px]">assigned_schools</span>.
        </div>
      ) : null}

      {totals ? (
        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4 pl-1">
            <div>
              <PremiumEyebrow>KPI overview</PremiumEyebrow>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">National totals</h2>
            </div>
          </div>
          {nationalGaugeCards.length > 0 ? (
            <DashboardGaugeBoard
              location={`National programme · ${quarter.trim() || quarterNow()}`}
              contextLine={roleLabels[user.role]}
              cards={nationalGaugeCards}
              animateKey={gaugeAnim > 0 ? String(gaugeAnim) : ''}
            />
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Schools', value: String(totals.schools ?? '—'), hint: 'In national scope', icon: 'S', tone: 'neutral' as const, progress: null },
              {
                label: 'Visits (quarter)',
                value: String(totals.visits ?? '—'),
                hint: 'All visit rows for the quarter',
                icon: 'V',
                tone: 'neutral' as const,
                progress: null,
              },
              {
                label: 'Finalized visits',
                value: String(totals.visits_finalized ?? '—'),
                hint: 'Locked for audit trail',
                icon: 'F',
                tone: 'success' as const,
                progress: ratioPct(totals.visits_finalized, totals.visits),
              },
              {
                label: 'Draft visits',
                value: String(totals.visits_draft ?? '—'),
                hint: 'Still editable in field',
                icon: 'D',
                tone: 'warning' as const,
                progress: ratioPct(totals.visits_draft, totals.visits),
              },
              {
                label: 'Avg aggregate score',
                value: totals.overall_avg_aggregate_score != null ? String(totals.overall_avg_aggregate_score) : '—',
                hint: 'Finalized visits with scores',
                icon: 'K',
                tone: 'neutral' as const,
                progress: kpiAggregateToPercent(totals.overall_avg_aggregate_score as number | null),
              },
            ].map((m, idx) => (
              <div
                key={m.label}
                className="animate-premium-in"
                style={{ animationDelay: `${80 + idx * 45}ms` }}
              >
                <PremiumMetricCard
                  label={m.label}
                  value={m.value}
                  hint={m.hint}
                  tone={m.tone}
                  progress={m.progress}
                  iconLetter={m.icon}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {issues ? (
        <PremiumPanel className="animate-premium-in border-amber-200/60 bg-amber-50/40">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <PremiumEyebrow>Risk & workload</PremiumEyebrow>
              <h3 className="mt-2 text-lg font-semibold text-text-primary">Issues queue</h3>
              <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-text-secondary">{String(issues.note ?? '')}</p>
            </div>
            <div className="rounded-2xl border border-amber-200/70 bg-white/70 px-5 py-3 text-center shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Open</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{String(issues.open_count ?? 0)}</p>
            </div>
          </div>
        </PremiumPanel>
      ) : null}

      {districtRows && districtRows.length > 0 ? (
        <PremiumPanel noPadding className="animate-premium-in overflow-hidden">
          <div className="border-b border-slate-100 px-8 py-5">
            <PremiumEyebrow>Regional performance</PremiumEyebrow>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">District breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  <th className="px-8 py-3">District</th>
                  <th className="px-4 py-3">Schools</th>
                  <th className="px-4 py-3">Visits</th>
                  <th className="px-4 py-3">Finalized</th>
                  <th className="px-8 py-3">Avg score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {districtRows.map((r) => {
                  const sc = kpiAggregateToPercent(r.avg_aggregate_score as number | null)
                  const districtId = String(r.district_id ?? '')
                  const rawCode = r.district_code != null ? String(r.district_code).trim() : ''
                  const codeLine = rawCode ? rawCode.toUpperCase() : ''
                  const schools = Number(r.school_count)
                  const visits = Number(r.visits)
                  const inactive = Number.isFinite(schools) && Number.isFinite(visits) && schools === 0 && visits === 0
                  const metaBits: string[] = []
                  if (codeLine) metaBits.push(codeLine)
                  if (inactive) metaBits.push('No activity this quarter')
                  const displayName = formatGeographicDisplayName(String(r.district_name ?? ''))
                  const numTone = inactive ? 'tabular-nums text-text-muted' : 'tabular-nums text-text-secondary'
                  return (
                    <tr
                      key={districtId}
                      title={districtId ? `Record ID: ${districtId}` : undefined}
                      className="bg-white/40 transition-colors hover:bg-slate-50/80"
                    >
                      <td className="px-8 py-4 align-top">
                        <div className="font-medium text-text-primary">{displayName}</div>
                        {metaBits.length > 0 ? (
                          <div className="mt-1 text-[11px] leading-snug text-text-muted">{metaBits.join(' · ')}</div>
                        ) : null}
                      </td>
                      <td className={`px-4 py-4 align-top ${numTone}`}>{String(r.school_count ?? '0')}</td>
                      <td className={`px-4 py-4 align-top ${numTone}`}>{String(r.visits ?? '0')}</td>
                      <td className={`px-4 py-4 align-top ${numTone}`}>{String(r.visits_finalized ?? '0')}</td>
                      <td className="px-8 py-4 align-top">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="tabular-nums text-text-secondary">{formatAvgAggregateCell(r.avg_aggregate_score)}</span>
                          {sc != null ? (
                            <div className="h-1.5 min-w-[7rem] flex-1 overflow-hidden rounded-full bg-slate-200 sm:w-28 sm:flex-none">
                              <div className="h-full rounded-full bg-emerald-600/55" style={{ width: `${sc}%` }} />
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
        </PremiumPanel>
      ) : null}

      {!loading && districtRows && districtRows.length === 0 && (user.role === 'super_admin' || user.role === 'government') ? (
        <p className="pl-1 text-sm text-text-muted">No districts on this page (empty database or beyond pagination).</p>
      ) : null}

      {districtDetail ? (
        <section className="space-y-8">
          <PremiumPanel className="animate-premium-in">
            <PremiumEyebrow>District command</PremiumEyebrow>
            <h2
              className="mt-2 text-2xl font-semibold tracking-tight text-text-primary"
              title={
                districtDetail.district_id ? `Record ID: ${String(districtDetail.district_id)}` : undefined
              }
            >
              {formatGeographicDisplayName(String(districtDetail.district_name ?? ''))}
            </h2>
            {districtDetail.district_code != null && String(districtDetail.district_code).trim() !== '' ? (
              <p className="mt-2 text-[13px] font-semibold uppercase tracking-wide text-text-muted">
                {String(districtDetail.district_code).trim().toUpperCase()}
              </p>
            ) : null}
          </PremiumPanel>

          <DashboardGaugeBoard
            location={formatGeographicDisplayName(String(districtDetail.district_name ?? 'District'))}
            contextLine={`${roleLabels[user.role]} · ${String(districtDetail.quarter ?? (quarter.trim() || quarterNow()))}`}
            cards={districtGaugeCards}
            animateKey={gaugeAnim > 0 ? String(gaugeAnim) : ''}
          />

          <div>
            <PremiumEyebrow>Compliance indicators</PremiumEyebrow>
            <h3 className="mt-2 text-lg font-semibold text-text-primary">Operational pressure</h3>
            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <PremiumMetricCard
                label="Pending draft visits"
                value={String(districtDetail.pending_draft_visits ?? 0)}
                hint="IE workload"
                tone="warning"
                iconLetter="P"
                progress={null}
              />
              <PremiumMetricCard
                label="Reports awaiting review"
                value={String(districtDetail.pending_report_reviews ?? 0)}
                hint="Super Admin approvals pipeline"
                tone="warning"
                iconLetter="R"
                progress={null}
              />
              <PremiumMetricCard
                label="Schools with facility gaps"
                value={
                  Array.isArray(districtDetail.facility_gap_school_ids)
                    ? (districtDetail.facility_gap_school_ids as string[]).length
                    : 0
                }
                hint="Infrastructure checklist signals"
                tone="danger"
                iconLetter="F"
                progress={null}
              />
            </div>
          </div>

          {lowPerformers && lowPerformers.length > 0 ? (
            <PremiumPanel className="animate-premium-in border-rose-200/70 bg-rose-50/35">
              <PremiumEyebrow>Risk alerts</PremiumEyebrow>
              <h3 className="mt-2 text-lg font-semibold text-text-primary">Lowest finalized scores</h3>
              <p className="mt-1 text-sm text-text-secondary">Top {lowPerformers.length} schools by lowest aggregate this quarter.</p>
              <ul className="mt-5 space-y-3 border-l border-rose-200/60 pl-5">
                {lowPerformers.map((r) => (
                  <li key={String(r.school_id)} className="text-[14px] text-text-secondary">
                    <span className="font-medium text-text-primary">{String(r.school_name)}</span>{' '}
                    <span className="font-mono text-xs text-text-muted">{String(r.school_id)}</span>
                    <span className="ml-2 tabular-nums text-rose-900/90">score {String(r.aggregate_score)}</span>
                  </li>
                ))}
              </ul>
            </PremiumPanel>
          ) : (
            <p className="pl-1 text-sm text-text-muted">No finalized scores for ranking this quarter.</p>
          )}

          {distSchools && distSchools.length > 0 ? (
            <PremiumPanel noPadding className="animate-premium-in overflow-hidden">
              <div className="border-b border-slate-100 px-8 py-5">
                <PremiumEyebrow>School registry</PremiumEyebrow>
                <h3 className="mt-2 text-lg font-semibold text-text-primary">Performance & reporting</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      <th className="px-6 py-3">School</th>
                      <th className="px-4 py-3">Visit</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Report</th>
                      <th className="px-6 py-3">Fac. gaps</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {distSchools.map((s) => (
                      <tr key={String(s.school_id)} className="bg-white/40 transition-colors hover:bg-slate-50/80">
                        <td className="px-6 py-3">
                          <Link
                            to={`/dashboard/schools/${String(s.school_id)}`}
                            className="font-medium text-primary transition-colors hover:text-accent"
                          >
                            {String(s.name ?? '')}
                          </Link>
                          <div className="font-mono text-[11px] text-text-muted">{String(s.school_id)}</div>
                        </td>
                        <td className="px-4 py-3 capitalize text-text-secondary">{String(s.visit_status ?? '—')}</td>
                        <td className="px-4 py-3 tabular-nums text-text-secondary">{String(s.aggregate_score ?? '—')}</td>
                        <td className="px-4 py-3 capitalize text-text-secondary">{String(s.report_status ?? '—')}</td>
                        <td className="px-6 py-3 tabular-nums text-text-secondary">{String(s.facility_gap_items ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PremiumPanel>
          ) : (
            <p className="pl-1 text-sm text-text-muted">No schools in this district page.</p>
          )}
        </section>
      ) : null}

      {schoolDash ? (
        <section className="space-y-10">
          <PremiumPanel className="animate-premium-in">
            <PremiumEyebrow>Executive summary</PremiumEyebrow>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
              {String(main?.school_name ?? 'School')}
            </h2>
            <p className="mt-1 font-mono text-xs text-text-muted">{String(main?.school_id)}</p>
            {main && typeof main.report === 'object' && main.report !== null ? (
              <p className="mt-5 text-[15px] leading-relaxed text-text-secondary">
                Report status:{' '}
                <span className="font-medium capitalize text-text-primary">
                  {String((main.report as Record<string, unknown>).status ?? '')}
                </span>
                . Use the KPI and attendance panels below to brief stakeholders in one pass.
              </p>
            ) : (
              <p className="mt-5 text-[15px] leading-relaxed text-text-secondary">
                Consolidated quarter view for this school — enrollment, attendance compliance, and visit trajectory.
              </p>
            )}
          </PremiumPanel>

          {schoolGaugeCards.length > 0 ? (
            <DashboardGaugeBoard
              location={String(main?.school_name ?? 'School')}
              contextLine={`${quarter.trim() || quarterNow()} · ${roleLabels[user.role]}`}
              cards={schoolGaugeCards}
              animateKey={gaugeAnim > 0 ? String(gaugeAnim) : ''}
            />
          ) : null}

          {enrollment && enrollment.length > 0 ? (
            <PremiumPanel className="animate-premium-in">
              <PremiumEyebrow>Quarterly analytics</PremiumEyebrow>
              <h3 className="mt-2 text-lg font-semibold text-text-primary">Enrollment trend</h3>
              <p className="mt-2 text-sm text-text-secondary">Relative scale across recorded quarters.</p>
              <div className="mt-8 space-y-5">
                {enrollment.map((row) => {
                  const t = Number(row.total) || 0
                  const w = Math.round((t / maxEnrollment) * 100)
                  return (
                    <div key={String(row.quarter)} className="flex flex-wrap items-center gap-4 text-[13px]">
                      <span className="w-24 shrink-0 font-mono text-xs font-medium text-text-muted">{String(row.quarter)}</span>
                      <div className="h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-slate-500/35 transition-[width] duration-700" style={{ width: `${w}%` }} />
                      </div>
                      <span className="text-text-secondary">
                        Total <span className="tabular-nums font-medium text-text-primary">{t}</span>
                        <span className="text-text-muted"> · boys {String(row.boys)} · girls {String(row.girls)}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </PremiumPanel>
          ) : (
            <PremiumPanel>
              <PremiumEyebrow>Quarterly analytics</PremiumEyebrow>
              <p className="mt-3 text-sm text-text-muted">No enrollment snapshots yet.</p>
            </PremiumPanel>
          )}

          {attendance ? (
            <div>
              <PremiumEyebrow>School performance</PremiumEyebrow>
              <h3 className="mt-2 text-lg font-semibold text-text-primary">Attendance compliance</h3>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <PremiumMetricCard
                  label="Teacher rows (quarter)"
                  value={String(attendance.teacher_attendance_rows ?? 0)}
                  iconLetter="T"
                  tone="neutral"
                />
                <PremiumMetricCard
                  label="Teacher approved (quarter)"
                  value={String(attendance.teacher_approved_rows ?? 0)}
                  iconLetter="A"
                  tone="success"
                  progress={ratioPct(attendance.teacher_approved_rows, attendance.teacher_attendance_rows)}
                />
                <PremiumMetricCard
                  label="Student daily rows (quarter)"
                  value={String(attendance.student_daily_rows ?? 0)}
                  iconLetter="S"
                  tone="neutral"
                />
                <PremiumMetricCard
                  label="Teacher rows (30d)"
                  value={String(attendance.last_30d_teacher_rows ?? 0)}
                  hint="Rolling window"
                  iconLetter="W"
                  tone="neutral"
                />
                <PremiumMetricCard
                  label="Student days (30d)"
                  value={String(attendance.last_30d_student_days ?? 0)}
                  iconLetter="M"
                  tone="neutral"
                />
              </div>
            </div>
          ) : null}

          {kpiTrend && kpiTrend.length > 0 ? (
            <PremiumPanel className="animate-premium-in">
              <PremiumEyebrow>Progress tracking</PremiumEyebrow>
              <h3 className="mt-2 text-lg font-semibold text-text-primary">Visit score trajectory</h3>
              <div className="mt-8 space-y-5">
                {kpiTrend.map((row) => {
                  const p = kpiAggregateToPercent(row.aggregate_score as number | null)
                  return (
                    <div key={String(row.quarter)} className="flex flex-wrap items-center gap-4 text-[13px]">
                      <span className="w-24 shrink-0 font-mono text-xs font-medium text-text-muted">{String(row.quarter)}</span>
                      <span className="w-24 shrink-0 capitalize text-text-secondary">{String(row.status)}</span>
                      <div className="h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-slate-200">
                        {p != null ? (
                          <div className="h-full rounded-full bg-primary/40 transition-[width] duration-700" style={{ width: `${p}%` }} />
                        ) : null}
                      </div>
                      <span className="tabular-nums text-text-secondary">{String(row.aggregate_score ?? '—')}</span>
                    </div>
                  )
                })}
              </div>
            </PremiumPanel>
          ) : null}

          {visitsRecent && visitsRecent.length > 0 ? (
            <PremiumPanel className="animate-premium-in">
              <PremiumEyebrow>Recent monitoring activity</PremiumEyebrow>
              <h3 className="mt-2 text-lg font-semibold text-text-primary">Latest visits</h3>
              <ul className="mt-6 space-y-4 border-l border-slate-200 pl-6">
                {visitsRecent.map((v) => (
                  <li key={String(v.visit_id)} className="relative text-[13px] text-text-secondary">
                    <span className="absolute -left-[25px] top-1.5 size-2 rounded-full bg-slate-300 ring-4 ring-white" aria-hidden />
                    <span className="font-mono text-xs text-text-muted">{String(v.quarter)}</span>
                    <span className="mx-2 text-text-muted">·</span>
                    <span className="capitalize">{String(v.status)}</span>
                    <span className="mx-2 text-text-muted">·</span>
                    <span>score {String(v.aggregate_score ?? '—')}</span>
                    <span className="mx-2 text-text-muted">·</span>
                    <Link to={`/dashboard/monitoring/${String(v.visit_id)}`} className="font-medium text-primary hover:text-accent">
                      Open visit
                    </Link>
                  </li>
                ))}
              </ul>
            </PremiumPanel>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Link
              to={`/dashboard/schools/${String(main?.school_id)}`}
              className="rounded-xl border border-slate-200/90 bg-white px-5 py-2.5 text-[13px] font-medium text-text-primary shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              School profile
            </Link>
          </div>
        </section>
      ) : null}

    </div>
  )
}
