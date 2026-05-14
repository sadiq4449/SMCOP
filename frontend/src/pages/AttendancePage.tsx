import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '../context/AuthContext'
import {
  downloadAttendanceExport,
  downloadAttendanceExportXlsx,
  monthlyStudentAttendance,
  monthlyTeacherAttendance,
  reviewTeacherAttendance,
  submitStudentAttendance,
} from '../services/attendanceApi'
import { getSchool } from '../services/schoolsApi'
import type { TeacherAttendanceRecord } from '../types/attendance'

function monthNow() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}`
}

export function AttendancePage() {
  const { user } = useAuth()
  const [schoolId, setSchoolId] = useState('')
  const [schoolLabel, setSchoolLabel] = useState('')
  const [month, setMonth] = useState(monthNow)
  const [teacherRows, setTeacherRows] = useState<TeacherAttendanceRecord[]>([])
  const [pendingOnly, setPendingOnly] = useState(true)
  const [studentDays, setStudentDays] = useState<{ attendance_date: string; boys_present: number; girls_present: number }[]>(
    [],
  )
  const [studentTotals, setStudentTotals] = useState<Record<string, number>>({})
  const [studentDate, setStudentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [boys, setBoys] = useState(0)
  const [girls, setGirls] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPrivileged = user?.role === 'principal' || user?.role === 'super_admin'

  const assigned = useMemo(() => user?.assigned_schools ?? [], [user?.assigned_schools])

  useEffect(() => {
    if (!user || user.role !== 'principal') return
    if (assigned[0] && !schoolId) {
      setSchoolId(assigned[0])
    }
  }, [user, assigned, schoolId])

  useEffect(() => {
    if (!schoolId.trim()) {
      setSchoolLabel('')
      return
    }
    let cancelled = false
    void getSchool(schoolId.trim())
      .then((s) => {
        if (!cancelled) setSchoolLabel(s.name)
      })
      .catch(() => {
        if (!cancelled) setSchoolLabel('')
      })
    return () => {
      cancelled = true
    }
  }, [schoolId])

  const reload = async () => {
    if (!schoolId.trim()) {
      setError('Pick or enter a school ID.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [tch, stu] = await Promise.all([
        monthlyTeacherAttendance({
          school_id: schoolId.trim(),
          month,
          approval_status: pendingOnly ? 'pending' : undefined,
        }),
        monthlyStudentAttendance({ school_id: schoolId.trim(), month }),
      ])
      setTeacherRows(tch.records)
      setStudentDays(stu.days.map((d) => ({ attendance_date: d.attendance_date, boys_present: d.boys_present, girls_present: d.girls_present })))
      setStudentTotals(stu.totals)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load attendance')
    } finally {
      setLoading(false)
    }
  }

  const onReview = async (id: string, approval_status: 'approved' | 'rejected') => {
    setError(null)
    try {
      await reviewTeacherAttendance(id, approval_status)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed')
    }
  }

  const onStudentSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!schoolId.trim()) return
    setLoading(true)
    setError(null)
    try {
      await submitStudentAttendance({
        school_id: schoolId.trim(),
        date: studentDate,
        boys_present: boys,
        girls_present: girls,
      })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  const visibleTeachers = pendingOnly ? teacherRows.filter((r) => r.approval_status === 'pending') : teacherRows

  if (!isPrivileged) {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">Attendance administration is available to Principals and Super Admin.</p>
      </section>
    )
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Attendance</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">School attendance</h1>
        <p className="mt-1 text-sm text-text-muted">Approve teacher marks, record student aggregates, export CSV or Excel.</p>
      </header>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm md:col-span-1">
            <span className="mb-1 block font-medium text-text-secondary">School</span>
            {user?.role === 'principal' ? (
              <select
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
              >
                {assigned.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                placeholder="School UUID"
                className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
              />
            )}
            {schoolLabel ? <p className="mt-1 text-xs text-text-muted">{schoolLabel}</p> : null}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Month</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-end gap-2 pb-1 text-sm">
            <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} />
            Teacher query: pending only
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void reload()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-60"
          >
            {loading ? 'Loading…' : 'Refresh data'}
          </button>
          <button
            type="button"
            disabled={!schoolId.trim() || loading}
            onClick={() => void downloadAttendanceExport({ school_id: schoolId.trim(), month, kind: 'teacher' })}
            className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-section"
          >
            Export teacher CSV
          </button>
          <button
            type="button"
            disabled={!schoolId.trim() || loading}
            onClick={() => void downloadAttendanceExport({ school_id: schoolId.trim(), month, kind: 'student' })}
            className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-section"
          >
            Export student CSV
          </button>
          <button
            type="button"
            disabled={!schoolId.trim() || loading}
            onClick={() => void downloadAttendanceExportXlsx({ school_id: schoolId.trim(), month, kind: 'teacher' })}
            className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-section"
          >
            Export teacher Excel
          </button>
          <button
            type="button"
            disabled={!schoolId.trim() || loading}
            onClick={() => void downloadAttendanceExportXlsx({ school_id: schoolId.trim(), month, kind: 'student' })}
            className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-section"
          >
            Export student Excel
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Teacher approvals</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-text-muted">
              <tr>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Teacher</th>
                <th className="py-2 pr-4">Present</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleTeachers.map((r) => (
                <tr key={r.id} className="border-b border-muted-surface/80">
                  <td className="py-2 pr-4 font-mono text-xs">{r.attendance_date}</td>
                  <td className="py-2 pr-4">{r.teacher_name ?? r.teacher_id}</td>
                  <td className="py-2 pr-4">{r.present ? 'Yes' : 'No'}</td>
                  <td className="py-2 pr-4">{r.approval_status}</td>
                  <td className="py-2">
                    {r.approval_status === 'pending' ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded bg-success/20 px-2 py-1 text-xs font-semibold text-success"
                          onClick={() => void onReview(r.id, 'approved')}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="rounded bg-danger/20 px-2 py-1 text-xs font-semibold text-danger"
                          onClick={() => void onReview(r.id, 'rejected')}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleTeachers.length === 0 ? <p className="py-4 text-sm text-text-muted">No rows for this filter.</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Student daily aggregates</h2>
        <form onSubmit={(e) => void onStudentSubmit(e)} className="grid gap-3 md:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Date</span>
            <input type="date" value={studentDate} onChange={(e) => setStudentDate(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Boys present</span>
            <input
              type="number"
              min={0}
              value={boys}
              onChange={(e) => setBoys(Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2"
            />
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
            <button type="submit" disabled={loading || !schoolId.trim()} className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white">
              Save day
            </button>
          </div>
        </form>
        <div className="text-xs text-text-muted">
          Month totals: boys sum {studentTotals.boys_present_sum ?? 0}, girls sum {studentTotals.girls_present_sum ?? 0}, days{' '}
          {studentTotals.days_recorded ?? 0}
        </div>
        <ul className="max-h-56 space-y-1 overflow-y-auto text-xs font-mono">
          {studentDays.map((d) => (
            <li key={d.attendance_date}>
              {d.attendance_date} · boys {d.boys_present} · girls {d.girls_present}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
