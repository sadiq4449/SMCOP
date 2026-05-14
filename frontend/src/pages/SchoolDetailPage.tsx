import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { monthlyStudentAttendance, monthlyTeacherAttendance } from '../services/attendanceApi'
import { listObservations } from '../services/observationsApi'
import {
  createEnrollment,
  createTeacher,
  deleteSchool,
  deleteTeacher,
  getEnrollment,
  getSchool,
  getTeachers,
} from '../services/schoolsApi'
import { downloadDocument } from '../services/visitsApi'
import type { TeacherAttendanceRecord } from '../types/attendance'
import type { ClassroomObservation } from '../types/observation'
import type { EnrollmentRow, SchoolDetail, TeacherRow } from '../types/school'

function attendanceMonthNow() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}`
}

export function SchoolDetailPage() {
  const { schoolId } = useParams<{ schoolId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'
  const isGovernment = user?.role === 'government'
  const isDeoUser = user?.role === 'deo'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [school, setSchool] = useState<SchoolDetail | null>(null)
  const [enrollment, setEnrollment] = useState<EnrollmentRow[]>([])
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [observations, setObservations] = useState<ClassroomObservation[]>([])
  const [attMonth, setAttMonth] = useState(attendanceMonthNow)
  const [attTeachers, setAttTeachers] = useState<TeacherAttendanceRecord[]>([])
  const [attStudentDays, setAttStudentDays] = useState<
    { attendance_date: string; boys_present: number; girls_present: number }[]
  >([])
  const [attTotals, setAttTotals] = useState({ boys_present_sum: 0, girls_present_sum: 0, days_recorded: 0 })
  const [attBusy, setAttBusy] = useState(false)

  const [qQuarter, setQQuarter] = useState('Q2-2026')
  const [qBoys, setQBoys] = useState(0)
  const [qGirls, setQGirls] = useState(0)
  const [tName, setTName] = useState('')
  const [tGender, setTGender] = useState('male')
  const [tSubject, setTSubject] = useState('')

  const loadAll = async () => {
    if (!schoolId) return
    setLoading(true)
    setError(null)
    try {
      const [s, e, t] = await Promise.all([getSchool(schoolId), getEnrollment(schoolId), getTeachers(schoolId)])
      setSchool(s)
      setEnrollment(e)
      setTeachers(t)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load school')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [schoolId])

  useEffect(() => {
    if (!schoolId) return
    let cancelled = false
    void listObservations({ school_id: schoolId, limit: 50 })
      .then((r) => {
        if (!cancelled) setObservations(r.items)
      })
      .catch(() => {
        if (!cancelled) setObservations([])
      })
    return () => {
      cancelled = true
    }
  }, [schoolId])

  useEffect(() => {
    if (!schoolId || (!isGovernment && !isDeoUser)) return
    let cancelled = false
    setAttBusy(true)
    void Promise.all([
      monthlyTeacherAttendance({ school_id: schoolId, month: attMonth }),
      monthlyStudentAttendance({ school_id: schoolId, month: attMonth }),
    ])
      .then(([tch, stu]) => {
        if (cancelled) return
        setAttTeachers(tch.records)
        setAttStudentDays(
          stu.days.map((d) => ({
            attendance_date: d.attendance_date,
            boys_present: d.boys_present,
            girls_present: d.girls_present,
          })),
        )
        setAttTotals({
          boys_present_sum: stu.totals.boys_present_sum ?? 0,
          girls_present_sum: stu.totals.girls_present_sum ?? 0,
          days_recorded: stu.totals.days_recorded ?? stu.days.length,
        })
      })
      .catch(() => {
        if (!cancelled) {
          setAttTeachers([])
          setAttStudentDays([])
          setAttTotals({ boys_present_sum: 0, girls_present_sum: 0, days_recorded: 0 })
        }
      })
      .finally(() => {
        if (!cancelled) setAttBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [schoolId, attMonth, isGovernment, isDeoUser])

  const handleDeleteSchool = async () => {
    if (!schoolId || !window.confirm('Delete this school and related enrollment/teachers?')) return
    try {
      await deleteSchool(schoolId)
      navigate('/dashboard/schools')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handleAddEnrollment = async (e: FormEvent) => {
    e.preventDefault()
    if (!schoolId) return
    try {
      await createEnrollment(schoolId, { quarter: qQuarter.trim(), boys: qBoys, girls: qGirls })
      await loadAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not add enrollment')
    }
  }

  const handleAddTeacher = async (e: FormEvent) => {
    e.preventDefault()
    if (!schoolId || !tName.trim()) return
    try {
      await createTeacher(schoolId, {
        name: tName.trim(),
        gender: tGender,
        subject: tSubject.trim() || null,
        status: 'active',
      })
      setTName('')
      setTSubject('')
      await loadAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not add teacher')
    }
  }

  const handleDeleteTeacher = async (teacherId: string) => {
    if (!schoolId || !window.confirm('Remove this teacher record?')) return
    try {
      await deleteTeacher(schoolId, teacherId)
      await loadAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handleDownloadObs = async (docId: string, filename: string) => {
    try {
      const blob = await downloadDocument(docId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Download failed')
    }
  }

  if (!schoolId) {
    return null
  }

  if (loading) {
    return <p className="text-text-muted">Loading school profile…</p>
  }

  if (error || !school) {
    return (
      <section className="rounded-2xl border border-danger/30 bg-surface p-6">
        <p className="text-danger">{error ?? 'School not found.'}</p>
        <Link to="/dashboard/schools" className="mt-4 inline-block text-secondary hover:text-primary">
          ← Back to schools
        </Link>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/dashboard/schools" className="text-sm font-medium text-secondary hover:text-primary">
            ← Schools
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">{school.name}</h1>
          <p className="mt-1 font-mono text-sm text-text-muted">EMIS {school.emis_code}</p>
          <p className="mt-2 text-sm text-text-secondary">
            {school.district_name} → {school.taluka_name} → {school.uc_name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSuperAdmin ? (
            <>
              <Link
                to={`/dashboard/schools/${schoolId}/edit`}
                className="rounded-lg border border-secondary px-4 py-2 text-sm font-medium text-secondary hover:bg-section"
              >
                Edit school
              </Link>
              <button
                type="button"
                onClick={() => void handleDeleteSchool()}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Delete school
              </button>
            </>
          ) : null}
          {isGovernment ? (
            <span className="rounded-full bg-info/15 px-3 py-1 text-xs font-medium text-primary">
              Read-only profile
            </span>
          ) : null}
        </div>
      </div>

      <section className="grid gap-4 rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Details</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Level</dt>
              <dd className="text-text-primary">{school.level}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Gender</dt>
              <dd className="text-text-primary">{school.gender}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Partner org</dt>
              <dd className="text-text-primary">{school.partner_org_name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Principal</dt>
              <dd className="text-text-primary">{school.principal_name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Phone</dt>
              <dd className="text-text-primary">{school.principal_phone ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">GPS</dt>
              <dd className="text-text-primary">
                {school.gps_latitude != null && school.gps_longitude != null
                  ? `${school.gps_latitude}, ${school.gps_longitude}`
                  : '—'}
              </dd>
            </div>
          </dl>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Identifiers</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">District ID</dt>
              <dd className="break-all font-mono text-xs text-text-secondary">{school.district_id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">School ID</dt>
              <dd className="break-all font-mono text-xs text-text-secondary">{school.id}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-text-primary">Enrollment by quarter</h2>
        {isSuperAdmin ? (
          <form onSubmit={handleAddEnrollment} className="mt-4 flex flex-wrap items-end gap-3 border-b border-muted-surface pb-4">
            <label className="text-sm">
              <span className="mb-1 block text-text-secondary">Quarter</span>
              <input
                value={qQuarter}
                onChange={(e) => setQQuarter(e.target.value)}
                className="rounded-lg border border-muted-surface px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-text-secondary">Boys</span>
              <input
                type="number"
                min={0}
                value={qBoys}
                onChange={(e) => setQBoys(Number(e.target.value))}
                className="w-24 rounded-lg border border-muted-surface px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-text-secondary">Girls</span>
              <input
                type="number"
                min={0}
                value={qGirls}
                onChange={(e) => setQGirls(Number(e.target.value))}
                className="w-24 rounded-lg border border-muted-surface px-3 py-2"
              />
            </label>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
              Add snapshot
            </button>
          </form>
        ) : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-muted-surface text-left text-text-muted">
                <th className="py-2">Quarter</th>
                <th className="py-2">Boys</th>
                <th className="py-2">Girls</th>
                <th className="py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {enrollment.map((row) => (
                <tr key={row.id} className="border-b border-muted-surface">
                  <td className="py-2">{row.quarter}</td>
                  <td className="py-2">{row.boys}</td>
                  <td className="py-2">{row.girls}</td>
                  <td className="py-2">{row.total}</td>
                </tr>
              ))}
              {enrollment.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-text-muted">
                    No enrollment rows yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {isGovernment || isDeoUser ? (
        <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Attendance (read-only)</h2>
              <p className="mt-1 text-xs text-text-muted">Monthly teacher marks and student daily aggregates for this school.</p>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-text-secondary">Month</span>
              <input
                type="month"
                value={attMonth}
                onChange={(e) => setAttMonth(e.target.value)}
                className="rounded-lg border border-muted-surface px-3 py-2 text-sm"
              />
            </label>
          </div>
          {attBusy ? <p className="text-sm text-text-muted">Loading attendance…</p> : null}
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Teachers</h3>
              <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-muted-surface">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-muted-surface/40 text-text-muted">
                    <tr>
                      <th className="px-2 py-1">Date</th>
                      <th className="px-2 py-1">Teacher</th>
                      <th className="px-2 py-1">Present</th>
                      <th className="px-2 py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attTeachers.map((r) => (
                      <tr key={r.id} className="border-t border-muted-surface">
                        <td className="px-2 py-1 font-mono">{r.attendance_date}</td>
                        <td className="px-2 py-1">{r.teacher_name ?? r.teacher_id}</td>
                        <td className="px-2 py-1">{r.present ? 'yes' : 'no'}</td>
                        <td className="px-2 py-1">{r.approval_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {attTeachers.length === 0 && !attBusy ? (
                  <p className="px-2 py-3 text-text-muted">No teacher rows this month.</p>
                ) : null}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Students (aggregates)</h3>
              <p className="mt-1 text-xs text-text-secondary">
                Boys present sum {attTotals.boys_present_sum} · Girls present sum {attTotals.girls_present_sum} · Days{' '}
                {attTotals.days_recorded}
              </p>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto font-mono text-xs">
                {attStudentDays.map((d) => (
                  <li key={d.attendance_date}>
                    {d.attendance_date} · boys {d.boys_present} · girls {d.girls_present}
                  </li>
                ))}
              </ul>
              {attStudentDays.length === 0 && !attBusy ? (
                <p className="mt-2 text-text-muted">No student aggregates this month.</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Classroom observations</h2>
            <p className="mt-1 text-xs text-text-muted">Latest observations captured during monitoring visits for this school.</p>
          </div>
          {(user?.role === 'enumerator' || user?.role === 'deo' || user?.role === 'principal') && schoolId ? (
            <Link to="/dashboard/observations" className="text-sm font-semibold text-secondary hover:text-primary">
              Full list →
            </Link>
          ) : null}
        </div>
        <ul className="mt-4 space-y-3">
          {observations.map((o) => (
            <li key={o.id} className="rounded-lg border border-muted-surface bg-section/40 px-3 py-2 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium text-text-primary">
                  {o.subject} · grade {o.grade} · quarter {o.quarter}
                </p>
                <Link to={`/dashboard/monitoring/${o.visit_id}`} className="text-xs font-semibold text-secondary hover:text-primary">
                  Visit
                </Link>
              </div>
              <p className="text-xs text-text-muted">Teacher {o.teacher_name ?? o.teacher_id ?? '—'}</p>
              <p className="text-xs text-text-secondary mt-1">
                Rubric {o.score_engagement}/{o.score_pedagogy}/{o.score_environment}
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {o.documents.map((d) => (
                  <li key={d.id} className="flex justify-between gap-2">
                    <span>{d.file_name}</span>
                    <button
                      type="button"
                      className="font-semibold text-secondary hover:text-primary"
                      onClick={() => void handleDownloadObs(d.id, d.file_name)}
                    >
                      Download
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {observations.length === 0 ? <li className="text-sm text-text-muted">No observations visible yet.</li> : null}
        </ul>
      </section>

      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-text-primary">Teachers</h2>
        {isSuperAdmin ? (
          <form onSubmit={handleAddTeacher} className="mt-4 flex flex-wrap items-end gap-3 border-b border-muted-surface pb-4">
            <label className="text-sm">
              <span className="mb-1 block text-text-secondary">Name</span>
              <input
                value={tName}
                onChange={(e) => setTName(e.target.value)}
                className="rounded-lg border border-muted-surface px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-text-secondary">Gender</span>
              <select
                value={tGender}
                onChange={(e) => setTGender(e.target.value)}
                className="rounded-lg border border-muted-surface px-3 py-2"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-text-secondary">Subject</span>
              <input
                value={tSubject}
                onChange={(e) => setTSubject(e.target.value)}
                className="rounded-lg border border-muted-surface px-3 py-2"
              />
            </label>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
              Add teacher
            </button>
          </form>
        ) : null}
        <ul className="mt-4 divide-y divide-muted-surface">
          {teachers.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium text-text-primary">{t.name}</p>
                <p className="text-sm text-text-muted">
                  {t.gender} · {t.subject ?? 'Subject TBD'} · {t.status}
                </p>
              </div>
              {isSuperAdmin ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteTeacher(t.id)}
                  className="text-sm text-danger hover:underline"
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
          {teachers.length === 0 ? (
            <li className="py-6 text-text-muted">No teachers recorded.</li>
          ) : null}
        </ul>
      </section>
    </div>
  )
}
