import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import { getDistricts, getSchools, getSchool } from '../services/schoolsApi'
import type { District, SchoolDetail, SchoolSummary } from '../types/school'

/** Illustrative timetable until Iteration 10 server-backed timetable APIs exist (PRD / Feature.md). */
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const

const SAMPLE_GRID: Record<string, string[]> = {
  '08:00–08:40': ['Assembly', 'Assembly', 'Assembly', 'Assembly', 'Assembly'],
  '08:45–09:25': ['Urdu', 'Mathematics', 'English', 'Science', 'Social studies'],
  '09:35–10:15': ['Mathematics', 'English', 'Urdu', 'Mathematics', 'English'],
  '10:25–11:05': ['Science', 'Urdu', 'Mathematics', 'English', 'Physical education'],
  '11:15–11:55': ['Arts', 'Science', 'Science', 'Urdu', 'Mathematics'],
  '12:45–01:25': ['English', 'Social studies', 'Arts', 'Library', 'Urdu'],
  '01:35–02:15': ['Islamiat / Ethics', 'Computer', 'Islamiat / Ethics', 'Islamiat / Ethics', 'Science lab'],
}

function slotTimes() {
  return Object.keys(SAMPLE_GRID).sort((a, b) => {
    const [ha] = a.split('–').map((s) => s.trim())
    const [hb] = b.split('–').map((s) => s.trim())
    return ha.localeCompare(hb)
  })
}

export function TimetablePage() {
  const { user } = useAuth()
  const assigned = useMemo(() => user?.assigned_schools ?? [], [user?.assigned_schools])
  const primaryId = assigned[0] ?? ''

  const [schoolLabel, setSchoolLabel] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [districts, setDistricts] = useState<District[]>([])
  const [districtId, setDistrictId] = useState('')
  const [schoolOptions, setSchoolOptions] = useState<SchoolSummary[]>([])
  const [govSchoolId, setGovSchoolId] = useState('')

  const times = useMemo(() => slotTimes(), [])

  useEffect(() => {
    if (!user) return
    if (user.role !== 'government') return
    void getDistricts()
      .then((d) => {
        setDistricts(d)
        setDistrictId((prev) => prev || d[0]?.id || '')
      })
      .catch((e: unknown) => setError(getApiErrorMessage(e, 'Failed to load districts')))
  }, [user])

  useEffect(() => {
    if (!user || user.role !== 'government' || !districtId) {
      setSchoolOptions([])
      setGovSchoolId('')
      return
    }
    void getSchools({ district_id: districtId, limit: 100 })
      .then((r) => {
        setSchoolOptions(r.items)
        setGovSchoolId((prev) => (prev && r.items.some((s) => s.id === prev) ? prev : r.items[0]?.id || ''))
      })
      .catch((e: unknown) => setError(getApiErrorMessage(e, 'Failed to load schools')))
  }, [user, districtId])

  const activeSchoolId = user?.role === 'government' ? govSchoolId : primaryId

  useEffect(() => {
    if (!user) return
    if (!activeSchoolId) {
      setSchoolLabel(null)
      return
    }
    setDetailLoading(true)
    setError(null)
    void getSchool(activeSchoolId)
      .then((r: SchoolDetail) => setSchoolLabel(r.name))
      .catch((e: unknown) => {
        setError(getApiErrorMessage(e, 'Failed to load school'))
        setSchoolLabel(null)
      })
      .finally(() => setDetailLoading(false))
  }, [user, activeSchoolId])

  if (!user) return null

  const readOnlyNote =
    user.role === 'principal'
      ? 'Principal timetable editing (full CRUD) is scheduled for Phase 2 (Iteration 10). This view is read-only and illustrative.'
      : 'This schedule is a demonstration template. A server-backed timetable will replace it in a later release.'

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Scheduling</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Timetable</h1>
        <p className="mt-1 text-sm text-text-muted">{readOnlyNote}</p>
      </header>

      {user.role === 'government' ? (
        <section className="rounded-2xl border border-muted-surface bg-surface p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Select school</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="block min-w-[200px] flex-1 text-sm">
              <span className="mb-1 block text-text-secondary">District</span>
              <select
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
                className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-[260px] flex-[2] text-sm">
              <span className="mb-1 block text-text-secondary">School</span>
              <select
                value={govSchoolId}
                onChange={(e) => setGovSchoolId(e.target.value)}
                className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
              >
                {schoolOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · EMIS {s.emis_code}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      ) : null}

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {!activeSchoolId ? (
        <section className="rounded-2xl border border-dashed border-secondary/35 bg-muted-surface/30 p-6 text-sm text-text-secondary">
          No school context is available yet. Ensure your account has an assigned school, or—for government
          users—pick a district with schools above.
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-muted-surface bg-surface shadow-sm">
          <div className="border-b border-muted-surface px-4 py-3">
            <h2 className="text-sm font-semibold text-text-primary">
              {detailLoading ? 'Loading school…' : schoolLabel ?? 'School'}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-text-muted">{activeSchoolId}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] divide-y divide-muted-surface text-xs">
              <thead className="bg-muted-surface/40">
                <tr>
                  <th className="w-28 px-2 py-2 text-left font-medium uppercase tracking-wide text-text-muted">Period</th>
                  {DAYS.map((d) => (
                    <th key={d} className="min-w-[100px] px-2 py-2 text-left font-medium text-text-muted">
                      {d.slice(0, 3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-muted-surface bg-surface">
                {times.map((slot) => (
                  <tr key={slot}>
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-[11px] text-text-secondary">{slot}</td>
                    {(SAMPLE_GRID[slot] ?? ['—', '—', '—', '—', '—']).map((subject, idx) => (
                      <td key={idx} className="px-2 py-2 text-text-primary">
                        {subject}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-muted-surface px-4 py-2 text-[11px] text-text-muted">
            Subjects shown are illustrative only and are not synced with live class assignments.
          </p>
        </section>
      )}
    </div>
  )
}
