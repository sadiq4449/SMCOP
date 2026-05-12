import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '../context/AuthContext'
import { monthlyStudentAttendance, submitStudentAttendance } from '../services/attendanceApi'

function monthNow() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}`
}

export function ClassAttendancePage() {
  const { user } = useAuth()
  const [schoolId, setSchoolId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [boys, setBoys] = useState(0)
  const [girls, setGirls] = useState(0)
  const [month, setMonth] = useState(monthNow)
  const [days, setDays] = useState<{ attendance_date: string; boys_present: number; girls_present: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const assigned = useMemo(() => user?.assigned_schools ?? [], [user?.assigned_schools])

  const allowed = user?.role === 'teacher' || user?.role === 'principal' || user?.role === 'super_admin'

  const reload = async () => {
    if (!schoolId.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await monthlyStudentAttendance({ school_id: schoolId.trim(), month })
      setDays(res.days.map((d) => ({ attendance_date: d.attendance_date, boys_present: d.boys_present, girls_present: d.girls_present })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!schoolId.trim()) return
    setLoading(true)
    setError(null)
    try {
      await submitStudentAttendance({ school_id: schoolId.trim(), date, boys_present: boys, girls_present: girls })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  if (!allowed) {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">Student attendance entry is limited to teachers and principals.</p>
      </section>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Attendance</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Class attendance</h1>
        <p className="mt-1 text-sm text-text-muted">Daily boys/girls present aggregates for your school.</p>
      </header>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-secondary">School</span>
          {user?.role === 'super_admin' ? (
            <input
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
              placeholder="School UUID"
            />
          ) : (
            <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="w-full rounded-lg border px-3 py-2 font-mono text-sm">
              <option value="">Select…</option>
              {assigned.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          )}
        </label>

        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-3 md:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Boys present</span>
            <input type="number" min={0} value={boys} onChange={(e) => setBoys(Number(e.target.value))} className="w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Girls present</span>
            <input
              type="number"
              min={0}
              value={girls}
              onChange={(e) => setGirls(Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={loading || !schoolId} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
              Save
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Month</span>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border px-3 py-2" />
          </label>
          <button
            type="button"
            disabled={loading || !schoolId}
            onClick={() => void reload()}
            className="self-end rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-section"
          >
            Load month
          </button>
        </div>
        <ul className="max-h-72 space-y-1 overflow-y-auto font-mono text-xs">
          {days.map((d) => (
            <li key={d.attendance_date}>
              {d.attendance_date} · boys {d.boys_present} · girls {d.girls_present}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
