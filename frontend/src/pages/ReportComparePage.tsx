import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import { compareDistricts, compareQuarters, compareReports } from '../services/reportsApi'
import { getDistricts, getSchools } from '../services/schoolsApi'
import type { District } from '../types/school'

type CompareTab = 'schools' | 'quarters' | 'districts'

export function ReportComparePage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<CompareTab>('schools')

  const [quarter, setQuarter] = useState('Q2-2026')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [schoolPickList, setSchoolPickList] = useState<{ id: string; label: string }[]>([])
  const [schoolSearch, setSchoolSearch] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([])
  const [schoolCompareResult, setSchoolCompareResult] = useState<Awaited<ReturnType<typeof compareReports>> | null>(
    null,
  )

  const [oneSchoolId, setOneSchoolId] = useState('')
  const [quartersCsv, setQuartersCsv] = useState('Q1-2026,Q2-2026')
  const [quarterCompareResult, setQuarterCompareResult] = useState<Awaited<ReturnType<typeof compareQuarters>> | null>(
    null,
  )

  const [districts, setDistricts] = useState<District[]>([])
  const [selectedDistrictIds, setSelectedDistrictIds] = useState<string[]>([])
  const [districtCompareResult, setDistrictCompareResult] = useState<
    Awaited<ReturnType<typeof compareDistricts>> | null
  >(null)

  const canDistrictTab = user?.role === 'super_admin' || user?.role === 'government'

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(schoolSearch.trim()), 280)
    return () => window.clearTimeout(t)
  }, [schoolSearch])

  useEffect(() => {
    let cancelled = false
    void getSchools({ limit: 80, ...(debouncedQ.length >= 1 ? { q: debouncedQ } : {}) })
      .then((res) => {
        if (cancelled) return
        setSchoolPickList(
          res.items.map((s) => ({
            id: s.id,
            label: `${s.name} — EMIS ${s.emis_code} (${s.district_name})`,
          })),
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [debouncedQ])

  useEffect(() => {
    if (!canDistrictTab) return
    let cancelled = false
    void getDistricts()
      .then((d) => {
        if (!cancelled) setDistricts(d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [canDistrictTab])

  const toggleSchool = (id: string) => {
    setSelectedSchoolIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 12)))
  }

  const toggleDistrict = (id: string) => {
    setSelectedDistrictIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 8),
    )
  }

  const runSchoolCompare = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      if (selectedSchoolIds.length < 2) {
        setError('Select at least two schools to compare.')
        return
      }
      const res = await compareReports(quarter.trim(), selectedSchoolIds.join(','))
      setSchoolCompareResult(res)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Comparison failed'))
    } finally {
      setBusy(false)
    }
  }, [quarter, selectedSchoolIds])

  const runQuarterCompare = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      if (!oneSchoolId.trim()) {
        setError('Pick one school for quarter-over-quarter comparison.')
        return
      }
      const qcsv = quartersCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .join(',')
      if (qcsv.split(',').length < 2) {
        setError('Enter at least two quarters separated by commas (e.g. Q1-2026,Q2-2026).')
        return
      }
      const res = await compareQuarters(oneSchoolId.trim(), qcsv)
      setQuarterCompareResult(res)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Comparison failed'))
    } finally {
      setBusy(false)
    }
  }, [oneSchoolId, quartersCsv])

  const runDistrictCompare = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      if (selectedDistrictIds.length < 2) {
        setError('Select at least two districts.')
        return
      }
      const res = await compareDistricts(quarter.trim(), selectedDistrictIds.join(','))
      setDistrictCompareResult(res)
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Comparison failed'))
    } finally {
      setBusy(false)
    }
  }, [quarter, selectedDistrictIds])

  const tabBtn = (id: CompareTab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
        tab === id ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:bg-muted-surface/60'
      }`}
    >
      {label}
    </button>
  )

  const fmtScore = (v: number | null | undefined) =>
    v == null || Number.isNaN(Number(v)) ? '—' : `${Number(v).toFixed(v % 1 === 0 ? 0 : 1)}%`

  const schoolLabels = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of schoolPickList) m.set(s.id, s.label)
    return m
  }, [schoolPickList])

  if (user?.role === 'ie') {
    return <Navigate to="/dashboard/reports" replace />
  }

  if (!user || !['super_admin', 'government', 'partner'].includes(user.role)) {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">Your role cannot access comparison tools.</p>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Analytics</p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">Report comparison</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-muted">
            Compare quarterly monitoring outcomes across schools for the same period, track one school across multiple
            quarters, or roll up districts (PPP Node / Super Admin). Scoped automatically to schools your role may access.
          </p>
        </div>
        <Link
          to="/dashboard/reports"
          className="rounded-lg border border-muted-surface px-4 py-2 text-sm font-semibold text-secondary hover:bg-muted-surface/40"
        >
          ← Quarterly reports
        </Link>
      </header>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-muted-surface bg-section/40 p-2">
        {tabBtn('schools', 'Schools · same quarter')}
        {tabBtn('quarters', 'One school · quarters')}
        {canDistrictTab ? tabBtn('districts', 'Districts · roll-up') : null}
      </div>

      <label className="block max-w-xs text-sm">
        <span className="mb-1 block font-medium text-text-secondary">Quarter (school / district modes)</span>
        <input
          value={quarter}
          onChange={(e) => setQuarter(e.target.value)}
          className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
          placeholder="e.g. Q2-2026"
        />
      </label>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {tab === 'schools' ? (
        <section className="space-y-4 rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary">Cross-school comparison</h2>
          <p className="text-sm text-text-muted">
            Pick schools visible to your role for the same quarter (up to 12 schools).
          </p>
          <label className="block text-sm">
            <span className="font-medium text-text-secondary">Search schools</span>
            <input
              value={schoolSearch}
              onChange={(e) => setSchoolSearch(e.target.value)}
              placeholder="Name or EMIS…"
              className="mt-1 w-full max-w-md rounded-lg border border-muted-surface px-3 py-2 text-sm"
            />
          </label>
          <div className="max-h-52 overflow-y-auto rounded-xl border border-muted-surface bg-section/30 p-2">
            {schoolPickList.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-start gap-2 border-b border-muted-surface/50 px-2 py-2 last:border-0 hover:bg-muted-surface/20">
                <input
                  type="checkbox"
                  checked={selectedSchoolIds.includes(s.id)}
                  onChange={() => toggleSchool(s.id)}
                  className="mt-1"
                />
                <span className="text-sm text-text-primary">{s.label}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-text-muted">
            <span className="font-medium text-text-secondary">{selectedSchoolIds.length}</span> selected
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runSchoolCompare()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-50"
          >
            {busy ? 'Running…' : 'Generate comparison'}
          </button>

          {schoolCompareResult ? (
            <div className="overflow-x-auto rounded-xl border border-muted-surface">
              <table className="min-w-full divide-y divide-muted-surface text-sm">
                <thead className="bg-muted-surface/40 text-left text-xs uppercase text-text-muted">
                  <tr>
                    <th className="px-4 py-2">School</th>
                    <th className="px-4 py-2">Visit</th>
                    <th className="px-4 py-2">Aggregate</th>
                    <th className="px-4 py-2">Observations</th>
                    <th className="px-4 py-2">Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted-surface">
                  {schoolCompareResult.schools.map((row) => (
                    <tr key={row.school_id} className="bg-surface hover:bg-section/40">
                      <td className="px-4 py-2 font-medium text-text-primary">
                        {row.school_name ?? schoolLabels.get(row.school_id) ?? row.school_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2 capitalize text-text-secondary">{row.visit_status ?? '—'}</td>
                      <td className="px-4 py-2 tabular-nums">{fmtScore(row.aggregate_score)}</td>
                      <td className="px-4 py-2 tabular-nums">{row.classroom_observation_count ?? '—'}</td>
                      <td className="px-4 py-2 capitalize text-text-muted">{row.report_status ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === 'quarters' ? (
        <section className="space-y-4 rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary">Same school · multiple quarters</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm md:col-span-2">
              <span className="font-medium text-text-secondary">School</span>
              <select
                value={oneSchoolId}
                onChange={(e) => setOneSchoolId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-muted-surface px-3 py-2 text-sm"
              >
                <option value="">Choose…</option>
                {schoolPickList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="font-medium text-text-secondary">Quarters (comma-separated)</span>
              <input
                value={quartersCsv}
                onChange={(e) => setQuartersCsv(e.target.value)}
                className="mt-1 w-full rounded-lg border border-muted-surface px-3 py-2 font-mono text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runQuarterCompare()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-50"
          >
            {busy ? 'Running…' : 'Generate comparison'}
          </button>
          {quarterCompareResult ? (
            <div className="overflow-x-auto rounded-xl border border-muted-surface">
              <table className="min-w-full divide-y divide-muted-surface text-sm">
                <thead className="bg-muted-surface/40 text-left text-xs uppercase text-text-muted">
                  <tr>
                    <th className="px-4 py-2">Quarter</th>
                    <th className="px-4 py-2">Visit</th>
                    <th className="px-4 py-2">Aggregate</th>
                    <th className="px-4 py-2">Observations</th>
                  </tr>
                </thead>
                <tbody>
                  {quarterCompareResult.quarters.map((row) => (
                    <tr key={row.quarter} className="divide-y divide-muted-surface bg-surface hover:bg-section/40">
                      <td className="px-4 py-2 font-medium">{row.quarter}</td>
                      <td className="px-4 py-2 capitalize">{row.visit_status ?? '—'}</td>
                      <td className="px-4 py-2 tabular-nums">{fmtScore(row.aggregate_score)}</td>
                      <td className="px-4 py-2 tabular-nums">{row.classroom_observation_count ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-muted-surface px-4 py-2 text-xs text-text-muted">
                School: {quarterCompareResult.school_name ?? quarterCompareResult.school_id}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === 'districts' && canDistrictTab ? (
        <section className="space-y-4 rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary">District roll-up</h2>
          <p className="text-sm text-text-muted">Compare aggregated signals across districts for one quarter (2–8).</p>
          <div className="max-h-52 overflow-y-auto rounded-xl border border-muted-surface bg-section/30 p-2">
            {districts.map((d) => (
              <label key={d.id} className="flex cursor-pointer items-start gap-2 border-b border-muted-surface/50 px-2 py-2 last:border-0 hover:bg-muted-surface/20">
                <input
                  type="checkbox"
                  checked={selectedDistrictIds.includes(d.id)}
                  onChange={() => toggleDistrict(d.id)}
                  className="mt-1"
                />
                <span className="text-sm text-text-primary">{d.name}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runDistrictCompare()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-50"
          >
            {busy ? 'Running…' : 'Generate district comparison'}
          </button>
          {districtCompareResult ? (
            <div className="overflow-x-auto rounded-xl border border-muted-surface">
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
                <tbody>
                  {districtCompareResult.districts.map((row) => (
                    <tr key={row.district_id} className="bg-surface hover:bg-section/40">
                      <td className="px-4 py-2 font-medium">{row.district_name ?? row.district_id.slice(0, 8)}</td>
                      <td className="px-4 py-2 tabular-nums">{row.school_count}</td>
                      <td className="px-4 py-2 tabular-nums">{row.visits_recorded}</td>
                      <td className="px-4 py-2 tabular-nums">{fmtScore(row.avg_aggregate_score)}</td>
                      <td className="px-4 py-2 tabular-nums">{row.classroom_observations_total}</td>
                      <td className="px-4 py-2 tabular-nums">{row.approved_reports_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
