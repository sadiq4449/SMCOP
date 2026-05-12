import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '../context/AuthContext'
import { monthlyTeacherAttendance, submitTeacherAttendance } from '../services/attendanceApi'
import type { TeacherAttendanceRecord } from '../types/attendance'

function monthNow() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}`
}

export function MyAttendancePage() {
  const { user } = useAuth()
  const [schoolId, setSchoolId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [present, setPresent] = useState(true)
  const [remarks, setRemarks] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [month, setMonth] = useState(monthNow)
  const [myRows, setMyRows] = useState<TeacherAttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const assigned = useMemo(() => user?.assigned_schools ?? [], [user?.assigned_schools])

  const loadMonth = async () => {
    if (!schoolId.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await monthlyTeacherAttendance({ school_id: schoolId.trim(), month })
      const ltid = user?.linked_teacher_id
      const mine = ltid ? res.records.filter((r) => r.teacher_id === ltid) : res.records
      setMyRows(mine)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user?.linked_teacher_id) {
      setError('Your account is not linked to a teacher profile yet (Super Admin must set linked_teacher_id).')
      return
    }
    if (!schoolId.trim()) {
      setError('Select your school.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await submitTeacherAttendance({
        school_id: schoolId.trim(),
        date,
        teachers: [
          {
            teacher_id: user.linked_teacher_id,
            present,
            remarks: remarks.trim() || null,
            verification_photo_url: photoUrl.trim() || null,
          },
        ],
      })
      await loadMonth()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setLoading(false)
    }
  }

  if (user?.role !== 'teacher') {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">This page is for teacher accounts.</p>
      </section>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Attendance</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">My attendance</h1>
        <p className="mt-1 text-sm text-text-muted">Submit one row per day for your linked teacher profile.</p>
      </header>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm space-y-4">
        <p className="text-xs text-text-muted">
          Linked teacher ID: <span className="font-mono">{user.linked_teacher_id ?? '— not set —'}</span>
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-text-secondary">School</span>
            <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="w-full rounded-lg border px-3 py-2 font-mono text-sm">
              <option value="">Select…</option>
              {assigned.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={present} onChange={(e) => setPresent(e.target.checked)} />
            Present
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-text-secondary">Remarks</span>
            <input value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-text-secondary">Verification photo URL (optional)</span>
            <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-60 md:col-span-2"
          >
            {loading ? 'Saving…' : 'Submit for principal review'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Review month</span>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border px-3 py-2" />
          </label>
          <button
            type="button"
            disabled={loading || !schoolId}
            onClick={() => void loadMonth()}
            className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-section"
          >
            Load history
          </button>
        </div>
        <ul className="space-y-2 text-xs font-mono">
          {myRows.map((row) => (
            <li key={row.id}>
              {row.attendance_date} · {row.present ? 'present' : 'absent'} · {row.approval_status}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
