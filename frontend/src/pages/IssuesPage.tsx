import { useCallback, useEffect, useMemo, useState } from 'react'

import { roleLabels } from '../config/navigation'
import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import { getSchool, getSchools } from '../services/schoolsApi'
import {
  createIssue,
  createTask,
  listAnnouncements,
  listIssues,
  listSchoolAssignees,
  listTasks,
  patchIssue,
  patchTask,
  type AnnouncementRow,
  type AssigneeOption,
  type IssueRow,
  type TaskRow,
} from '../services/operationalApi'
import type { SchoolSummary } from '../types/school'
import type { UserRole } from '../types/auth'

function canCreateIssue(role: UserRole) {
  return role !== 'teacher'
}

function canAssignIssue(role: UserRole) {
  return role === 'super_admin' || role === 'deo'
}

function canCreateTask(role: UserRole) {
  return role === 'super_admin' || role === 'deo'
}

function SchoolQuickPicker({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (schoolId: string) => void
  label: string
}) {
  const [search, setSearch] = useState('')
  const [hits, setHits] = useState<SchoolSummary[]>([])
  const [selectedLabel, setSelectedLabel] = useState('')

  useEffect(() => {
    if (!value) {
      setSelectedLabel('')
      return
    }
    void getSchool(value)
      .then((s) => setSelectedLabel(`${s.emis_code} · ${s.name}`))
      .catch(() => setSelectedLabel(`School ${value.slice(0, 8)}…`))
  }, [value])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void getSchools({ q: search.trim() || undefined, limit: 40 })
        .then((r) => setHits(r.items))
        .catch(() => setHits([]))
    }, 280)
    return () => window.clearTimeout(t)
  }, [search])

  return (
    <div className="space-y-2">
      <span className="text-sm text-text-secondary">{label}</span>
      {selectedLabel ? (
        <p className="rounded-lg border border-muted-surface bg-section px-3 py-2 text-sm text-text-primary">
          Selected: {selectedLabel}
        </p>
      ) : (
        <p className="text-xs text-text-muted">Search and pick a school below (school UUID is filled automatically).</p>
      )}
      <input
        type="search"
        className="w-full rounded-lg border border-muted-surface px-3 py-2 text-sm text-text-primary"
        value={search}
        onChange={(ev) => setSearch(ev.target.value)}
        placeholder="Search by EMIS code or school name"
      />
      <ul className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-muted-surface bg-surface p-1">
        {hits.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => {
                onChange(s.id)
                setSearch('')
              }}
              className={`w-full rounded-md px-2 py-2 text-left text-sm hover:bg-section ${
                value === s.id ? 'bg-section font-medium text-text-primary' : 'text-text-secondary'
              }`}
            >
              <span className="font-mono text-xs text-text-muted">{s.emis_code}</span> · {s.name}
              <span className="mt-0.5 block text-[11px] text-text-muted">{s.district_name}</span>
            </button>
          </li>
        ))}
        {hits.length === 0 ? <li className="px-2 py-4 text-center text-xs text-text-muted">No matches.</li> : null}
      </ul>
    </div>
  )
}

export function IssuesPage() {
  const { user } = useAuth()
  const [issues, setIssues] = useState<IssueRow[]>([])
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const defaultSchoolId = user?.assigned_schools?.[0] ?? ''

  const [schoolId, setSchoolId] = useState(defaultSchoolId)
  const [category, setCategory] = useState('infrastructure')
  const [severity, setSeverity] = useState('medium')
  const [details, setDetails] = useState('')

  const [issueAssigneePick, setIssueAssigneePick] = useState<Record<string, string>>({})
  const [issueAssigneesBySchool, setIssueAssigneesBySchool] = useState<Record<string, AssigneeOption[]>>({})

  const [taskTitle, setTaskTitle] = useState('')
  const [taskSchoolId, setTaskSchoolId] = useState(defaultSchoolId)
  const [taskAssigneeId, setTaskAssigneeId] = useState('')
  const [taskAssignees, setTaskAssignees] = useState<AssigneeOption[]>([])

  useEffect(() => {
    setSchoolId(defaultSchoolId)
    setTaskSchoolId(defaultSchoolId)
  }, [defaultSchoolId])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setErr(null)
    try {
      const q: { school_id?: string } = {}
      if (schoolId && (user.role === 'principal' || user.role === 'enumerator')) {
        q.school_id = schoolId
      }
      const [i, t, a] = await Promise.all([
        listIssues(Object.keys(q).length ? q : {}),
        listTasks(Object.keys(q).length ? q : {}),
        listAnnouncements(),
      ])
      setIssues(i.items)
      setTasks(t.items)
      setAnnouncements(a.items)
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Failed to load'))
    } finally {
      setLoading(false)
    }
  }, [user, schoolId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!user || !canAssignIssue(user.role)) {
      setIssueAssigneesBySchool({})
      return
    }
    const schoolIds = [...new Set(issues.map((i) => i.school_id))]
    if (schoolIds.length === 0) {
      setIssueAssigneesBySchool({})
      return
    }
    let cancelled = false
    void Promise.all(
      schoolIds.map((sid) =>
        listSchoolAssignees(sid, 'issue')
          .then((opts) => [sid, opts] as const)
          .catch(() => [sid, []] as const),
      ),
    )
      .then((pairs) => {
        if (cancelled) return
        const next: Record<string, AssigneeOption[]> = {}
        for (const [sid, opts] of pairs) next[sid] = opts
        setIssueAssigneesBySchool(next)
      })
      .catch(() => {
        if (!cancelled) setIssueAssigneesBySchool({})
      })
    return () => {
      cancelled = true
    }
  }, [issues, user])

  useEffect(() => {
    if (!user || !canCreateTask(user.role)) {
      setTaskAssignees([])
      setTaskAssigneeId('')
      return
    }
    const sid = taskSchoolId.trim()
    if (!/^[0-9a-f-]{36}$/i.test(sid)) {
      setTaskAssignees([])
      setTaskAssigneeId('')
      return
    }
    let cancelled = false
    void listSchoolAssignees(sid, 'task')
      .then((rows) => {
        if (!cancelled) {
          setTaskAssignees(rows)
          setTaskAssigneeId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : ''))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTaskAssignees([])
          setTaskAssigneeId('')
        }
      })
    return () => {
      cancelled = true
    }
  }, [taskSchoolId, user])

  const submitIssue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !canCreateIssue(user.role)) return
    setMsg(null)
    setErr(null)
    try {
      const sid = schoolId.trim()
      if (!sid) throw new Error('Choose a school from the search results')
      await createIssue({ school_id: sid, category, severity, details: details.trim() })
      setDetails('')
      setMsg('Issue reported.')
      await load()
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Failed'))
    }
  }

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !canCreateTask(user.role)) return
    setMsg(null)
    setErr(null)
    try {
      const sid = taskSchoolId.trim()
      if (!sid || !taskTitle.trim() || !taskAssigneeId.trim()) {
        throw new Error('Choose a school, a title, and an assignee from the lists')
      }
      await createTask({ school_id: sid, title: taskTitle.trim(), assignee_user_id: taskAssigneeId.trim() })
      setTaskTitle('')
      setTaskAssigneeId('')
      setMsg('Task assigned.')
      await load()
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Failed'))
    }
  }

  const resolveIssue = async (row: IssueRow, status: 'resolved' | 'closed') => {
    setErr(null)
    try {
      await patchIssue(row.id, { status })
      await load()
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Failed'))
    }
  }

  const assignIssue = async (row: IssueRow) => {
    const pick = issueAssigneePick[row.id]?.trim()
    if (!pick) return
    setErr(null)
    try {
      await patchIssue(row.id, { assigned_to_user_id: pick })
      setIssueAssigneePick((m) => ({ ...m, [row.id]: '' }))
      await load()
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Failed'))
    }
  }

  const toggleTask = async (row: TaskRow) => {
    setErr(null)
    try {
      await patchTask(row.id, { is_completed: !row.is_completed })
      await load()
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Failed'))
    }
  }

  const title = useMemo(() => 'Issues, tasks & announcements', [])

  const assigneeOptionLabel = (o: AssigneeOption) => {
    const rl = roleLabels[o.role as UserRole] ?? o.role
    return `${o.full_name} — ${o.email} (${rl})`
  }

  if (!user) return null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
        <p className="mt-1 text-sm text-text-muted">Operational follow-up from Iteration 9.</p>
      </div>

      {msg ? <p className="rounded-lg bg-[var(--color-success)]/15 px-3 py-2 text-sm text-text-primary">{msg}</p> : null}
      {err ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p> : null}

      <section className="rounded-xl border border-muted-surface bg-surface p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-text-primary">Announcements</h2>
        {loading ? <p className="mt-2 text-sm text-text-muted">Loading…</p> : null}
        <ul className="mt-3 space-y-3">
          {announcements.map((a) => (
            <li key={a.id} className="rounded-lg border border-muted-surface bg-section px-3 py-2">
              <p className="font-medium text-text-primary">{a.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{a.body}</p>
              {a.attachment_url ? (
                <a href={a.attachment_url} className="mt-1 inline-block text-sm text-secondary hover:underline" target="_blank" rel="noreferrer">
                  Attachment
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {canCreateIssue(user.role) ? (
        <section className="rounded-xl border border-muted-surface bg-surface p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary">Report an issue</h2>
          <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={submitIssue}>
            <div className="md:col-span-2">
              <SchoolQuickPicker value={schoolId} onChange={setSchoolId} label="School" />
            </div>
            <label className="block">
              <span className="text-sm text-text-secondary">Category</span>
              <select
                className="mt-1 w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
                value={category}
                onChange={(ev) => setCategory(ev.target.value)}
              >
                <option value="infrastructure">Infrastructure</option>
                <option value="teachers">Teachers</option>
                <option value="students">Students</option>
                <option value="facility">Facility</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-text-secondary">Severity</span>
              <select
                className="mt-1 w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
                value={severity}
                onChange={(ev) => setSeverity(ev.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm text-text-secondary">Details</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
                rows={3}
                value={details}
                onChange={(ev) => setDetails(ev.target.value)}
                required
              />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-secondary">
                Submit issue
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-xl border border-muted-surface bg-surface p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-text-primary">Issues</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-muted-surface text-text-muted">
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Severity</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Details</th>
                <th className="py-2 pr-3">School</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((r) => (
                <tr key={r.id} className="border-b border-muted-surface/80">
                  <td className="py-2 pr-3 capitalize">{r.status}</td>
                  <td className="py-2 pr-3">{r.severity}</td>
                  <td className="py-2 pr-3 capitalize">{r.category}</td>
                  <td className="max-w-md py-2 pr-3 text-text-secondary">{r.details}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-text-muted">{r.school_id.slice(0, 8)}…</td>
                  <td className="py-2 pr-3 space-y-2">
                    {canAssignIssue(user.role) ? (
                      <div className="flex min-w-[14rem] flex-col gap-1 sm:flex-row sm:items-center">
                        <select
                          className="min-w-0 flex-1 rounded border border-muted-surface px-2 py-1.5 text-xs text-text-primary"
                          value={issueAssigneePick[r.id] ?? ''}
                          onChange={(ev) => setIssueAssigneePick((m) => ({ ...m, [r.id]: ev.target.value }))}
                        >
                          <option value="">Select assignee…</option>
                          {(issueAssigneesBySchool[r.school_id] ?? []).map((o) => (
                            <option key={o.id} value={o.id}>
                              {assigneeOptionLabel(o)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="shrink-0 rounded bg-secondary px-2 py-1.5 text-xs text-white"
                          onClick={() => void assignIssue(r)}
                        >
                          Assign
                        </button>
                      </div>
                    ) : null}
                    {user.role !== 'government' && user.role !== 'teacher' ? (
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="rounded border border-muted-surface px-2 py-1 text-xs"
                          onClick={() => void resolveIssue(r, 'resolved')}
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          className="rounded border border-muted-surface px-2 py-1 text-xs"
                          onClick={() => void resolveIssue(r, 'closed')}
                        >
                          Close
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && issues.length === 0 ? <p className="mt-3 text-sm text-text-muted">No issues in your scope.</p> : null}
        </div>
      </section>

      {canCreateTask(user.role) ? (
        <section className="rounded-xl border border-muted-surface bg-surface p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary">Assign improvement task</h2>
          <form className="mt-3 grid gap-4 md:grid-cols-2" onSubmit={submitTask}>
            <div className="md:col-span-2">
              <SchoolQuickPicker value={taskSchoolId} onChange={setTaskSchoolId} label="School" />
            </div>
            <label className="block md:col-span-2">
              <span className="text-sm text-text-secondary">Assignee</span>
              <select
                className="mt-1 w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
                value={taskAssigneeId}
                onChange={(ev) => setTaskAssigneeId(ev.target.value)}
                required
              >
                <option value="">Select principal or teacher…</option>
                {taskAssignees.map((o) => (
                  <option key={o.id} value={o.id}>
                    {assigneeOptionLabel(o)}
                  </option>
                ))}
              </select>
              {taskSchoolId.trim() && taskAssignees.length === 0 ? (
                <p className="mt-1 text-xs text-text-muted">No assignable users for this school in your scope.</p>
              ) : null}
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm text-text-secondary">Title</span>
              <input
                className="mt-1 w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
                value={taskTitle}
                onChange={(ev) => setTaskTitle(ev.target.value)}
                required
              />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-secondary">
                Create task
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-xl border border-muted-surface bg-surface p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-text-primary">Tasks</h2>
        <ul className="mt-3 space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-muted-surface px-3 py-2">
              <div>
                <p className={`font-medium ${t.is_completed ? 'text-text-muted line-through' : 'text-text-primary'}`}>{t.title}</p>
                <p className="text-xs text-text-muted">School {t.school_id.slice(0, 8)}…</p>
              </div>
              <button
                type="button"
                onClick={() => void toggleTask(t)}
                className="rounded-lg border border-muted-surface px-3 py-1 text-xs font-medium hover:bg-section"
              >
                {t.is_completed ? 'Reopen' : 'Mark done'}
              </button>
            </li>
          ))}
        </ul>
        {!loading && tasks.length === 0 ? <p className="mt-3 text-sm text-text-muted">No tasks in your scope.</p> : null}
      </section>
    </div>
  )
}
