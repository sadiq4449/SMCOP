import { useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import { compareDistricts, compareQuarters, compareReports } from '../services/reportsApi'
import type { CompareDistrictRow, CompareQuarterRow, CompareSchoolRow } from '../types/report'

const schoolCompareRoles = ['government', 'super_admin', 'deo', 'enumerator', 'principal'] as const
const districtCompareRoles = ['government', 'super_admin'] as const

function scoreBarPercent(score: number | null | undefined): number | null {
  if (score == null || Number.isNaN(score)) return null
  const n = Number(score)
  if (n < 0) return 0
  if (n > 100) return 100
  return Math.round(n)
}

export function ReportComparisonsPage() {
  const { user } = useAuth()

  const [quarter, setQuarter] = useState('Q2-2026')
  const [schoolIds, setSchoolIds] = useState('')
  const [schoolRows, setSchoolRows] = useState<CompareSchoolRow[]>([])
  const [normQuarterSchools, setNormQuarterSchools] = useState('')
  const [schoolLoading, setSchoolLoading] = useState(false)
  const [schoolError, setSchoolError] = useState<string | null>(null)

  const [distQuarter, setDistQuarter] = useState('Q2-2026')
  const [districtIds, setDistrictIds] = useState('')
  const [districtRows, setDistrictRows] = useState<CompareDistrictRow[]>([])
  const [normQuarterDist, setNormQuarterDist] = useState('')
  const [distLoading, setDistLoading] = useState(false)
  const [distError, setDistError] = useState<string | null>(null)

  const [qSchoolId, setQSchoolId] = useState('')
  const [quartersStr, setQuartersStr] = useState('Q1-2026,Q2-2026')
  const [quarterRows, setQuarterRows] = useState<CompareQuarterRow[]>([])
  const [quarterLabelSchool, setQuarterLabelSchool] = useState('')
  const [qLoading, setQLoading] = useState(false)
  const [qError, setQError] = useState<string | null>(null)

  const canSchoolCompare = user && (schoolCompareRoles as readonly string[]).includes(user.role)
  const canDistrictCompare = user && (districtCompareRoles as readonly string[]).includes(user.role)

  const runSchoolCompare = async () => {
    setSchoolLoading(true)
    setSchoolError(null)
    try {
      const csv = schoolIds
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(',')
      const res = await compareReports(quarter.trim(), csv)
      setSchoolRows(res.schools)
      setNormQuarterSchools(res.quarter)
    } catch (e: unknown) {
      setSchoolError(getApiErrorMessage(e, 'Comparison failed'))
      setSchoolRows([])
      setNormQuarterSchools('')
    } finally {
      setSchoolLoading(false)
    }
  }

  const runDistrictCompare = async () => {
    setDistLoading(true)
    setDistError(null)
    try {
      const csv = districtIds
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(',')
      const res = await compareDistricts(distQuarter.trim(), csv)
      setDistrictRows(res.districts)
      setNormQuarterDist(res.quarter)
    } catch (e: unknown) {
      setDistError(getApiErrorMessage(e, 'District comparison failed'))
      setDistrictRows([])
      setNormQuarterDist('')
    } finally {
      setDistLoading(false)
    }
  }

  const runQuarterCompare = async () => {
    setQLoading(true)
    setQError(null)
    try {
      const csv = quartersStr
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(',')
      const res = await compareQuarters(qSchoolId.trim(), csv)
      setQuarterRows(res.quarters)
      setQuarterLabelSchool(res.school_name ?? res.school_id)
    } catch (e: unknown) {
      setQError(getApiErrorMessage(e, 'Quarter comparison failed'))
      setQuarterRows([])
      setQuarterLabelSchool('')
    } finally {
      setQLoading(false)
    }
  }

  if (!user || !canSchoolCompare) {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">You do not have access to comparison tooling.</p>
      </section>
    )
  }

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Analytics</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Report comparisons</h1>
        <p className="mt-1 text-sm text-text-muted">
          School vs school (same quarter), district roll-ups, and quarter-over-quarter trends for one school. Metrics follow
          the same visit and report linkage rules as the reporting API.
        </p>
      </header>

      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Compare schools (one quarter)</h2>
        <p className="text-xs text-text-muted">Provide two or more school UUIDs (comma or newline separated).</p>
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
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-secondary">School IDs</span>
          <textarea
            value={schoolIds}
            onChange={(e) => setSchoolIds(e.target.value)}
            rows={3}
            placeholder="school-uuid-one, school-uuid-two"
            className="w-full rounded-lg border border-muted-surface px-3 py-2 font-mono text-xs text-text-primary"
          />
        </label>
        <button
          type="button"
          disabled={schoolLoading}
          onClick={() => void runSchoolCompare()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-50"
        >
          {schoolLoading ? 'Comparing…' : 'Compare schools'}
        </button>
        {schoolError ? (
          <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
            {schoolError}
          </p>
        ) : null}
        {schoolRows.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-muted-surface">
            <div className="border-b border-muted-surface px-4 py-2 text-sm font-medium text-text-primary">
              Quarter <span className="font-mono">{normQuarterSchools}</span>
            </div>
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
                {schoolRows.map((r) => {
                  const pct = scoreBarPercent(r.aggregate_score)
                  return (
                    <tr key={r.school_id}>
                      <td className="px-4 py-2">
                        <div className="font-medium text-text-primary">{r.school_name ?? '—'}</div>
                        <div className="font-mono text-xs text-text-muted">{r.school_id}</div>
                      </td>
                      <td className="px-4 py-2 text-text-secondary">
                        {r.visit_found ? (r.visit_status ?? 'present') : '—'}
                      </td>
                      <td className="px-4 py-2 text-text-secondary">
                        <div className="flex items-center gap-2">
                          <span>{r.aggregate_score ?? '—'}</span>
                          {pct != null ? (
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-muted-surface">
                              <div className="h-full bg-secondary" style={{ width: `${pct}%` }} />
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-text-secondary">{r.classroom_observation_count ?? '—'}</td>
                      <td className="px-4 py-2 capitalize text-text-secondary">{r.report_status ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {canDistrictCompare ? (
        <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Compare districts (one quarter)</h2>
          <p className="text-xs text-text-muted">
            Government and Super Admin: two or more district UUIDs. Roll-ups use all schools in each district.
          </p>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Quarter</span>
            <input
              value={distQuarter}
              onChange={(e) => setDistQuarter(e.target.value)}
              className="w-36 rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">District IDs</span>
            <textarea
              value={districtIds}
              onChange={(e) => setDistrictIds(e.target.value)}
              rows={3}
              placeholder="district-uuid-one, district-uuid-two"
              className="w-full rounded-lg border border-muted-surface px-3 py-2 font-mono text-xs text-text-primary"
            />
          </label>
          <button
            type="button"
            disabled={distLoading}
            onClick={() => void runDistrictCompare()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-50"
          >
            {distLoading ? 'Comparing…' : 'Compare districts'}
          </button>
          {distError ? (
            <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
              {distError}
            </p>
          ) : null}
          {districtRows.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-muted-surface">
              <div className="border-b border-muted-surface px-4 py-2 text-sm font-medium text-text-primary">
                Quarter <span className="font-mono">{normQuarterDist}</span>
              </div>
              <table className="min-w-full divide-y divide-muted-surface text-sm">
                <thead className="bg-muted-surface/40 text-left text-xs uppercase text-text-muted">
                  <tr>
                    <th className="px-4 py-2">District</th>
                    <th className="px-4 py-2">Schools</th>
                    <th className="px-4 py-2">Visits</th>
                    <th className="px-4 py-2">Avg score</th>
                    <th className="px-4 py-2">Observations</th>
                    <th className="px-4 py-2">Approved reports</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted-surface">
                  {districtRows.map((r) => (
                    <tr key={r.district_id}>
                      <td className="px-4 py-2">
                        <div className="font-medium text-text-primary">{r.district_name ?? '—'}</div>
                        <div className="font-mono text-xs text-text-muted">{r.district_id}</div>
                      </td>
                      <td className="px-4 py-2 text-text-secondary">{r.school_count}</td>
                      <td className="px-4 py-2 text-text-secondary">{r.visits_recorded}</td>
                      <td className="px-4 py-2 text-text-secondary">{r.avg_aggregate_score ?? '—'}</td>
                      <td className="px-4 py-2 text-text-secondary">{r.classroom_observations_total}</td>
                      <td className="px-4 py-2 text-text-secondary">{r.approved_reports_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Compare quarters (one school)</h2>
        <p className="text-xs text-text-muted">Same school across two or more quarters (comma-separated, e.g. Q1-2026,Q2-2026).</p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-text-secondary">School ID</span>
            <input
              value={qSchoolId}
              onChange={(e) => setQSchoolId(e.target.value)}
              className="w-full rounded-lg border border-muted-surface px-3 py-2 font-mono text-sm text-text-primary"
              placeholder="School UUID"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-text-secondary">Quarters</span>
            <input
              value={quartersStr}
              onChange={(e) => setQuartersStr(e.target.value)}
              className="w-full rounded-lg border border-muted-surface px-3 py-2 text-sm text-text-primary"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={qLoading}
          onClick={() => void runQuarterCompare()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-50"
        >
          {qLoading ? 'Comparing…' : 'Compare quarters'}
        </button>
        {qError ? (
          <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
            {qError}
          </p>
        ) : null}
        {quarterRows.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-muted-surface">
            <div className="border-b border-muted-surface px-4 py-2 text-sm font-medium text-text-primary">
              {quarterLabelSchool ? <span>{quarterLabelSchool}</span> : null}
            </div>
            <table className="min-w-full divide-y divide-muted-surface text-sm">
              <thead className="bg-muted-surface/40 text-left text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-2">Quarter</th>
                  <th className="px-4 py-2">Visit</th>
                  <th className="px-4 py-2">Score</th>
                  <th className="px-4 py-2">Observations</th>
                  <th className="px-4 py-2">Report status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted-surface">
                {quarterRows.map((r) => {
                  const pct = scoreBarPercent(r.aggregate_score)
                  return (
                    <tr key={r.quarter}>
                      <td className="px-4 py-2 font-mono text-text-primary">{r.quarter}</td>
                      <td className="px-4 py-2 text-text-secondary">
                        {r.visit_found ? (r.visit_status ?? 'present') : '—'}
                      </td>
                      <td className="px-4 py-2 text-text-secondary">
                        <div className="flex items-center gap-2">
                          <span>{r.aggregate_score ?? '—'}</span>
                          {pct != null ? (
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-muted-surface">
                              <div className="h-full bg-secondary" style={{ width: `${pct}%` }} />
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-text-secondary">{r.classroom_observation_count ?? '—'}</td>
                      <td className="px-4 py-2 capitalize text-text-secondary">{r.report_status ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}
