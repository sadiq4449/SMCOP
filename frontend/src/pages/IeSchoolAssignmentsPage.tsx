import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { roleLabels } from '../config/navigation'
import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import { getSchool, getSchools } from '../services/schoolsApi'
import { listUsers, patchUserAssignedSchools } from '../services/usersApi'
import type { SchoolSummary } from '../types/school'
import type { UserAdminRow } from '../types/user'

function schoolIdsEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

export function IeSchoolAssignmentsPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const paramUserId = searchParams.get('user')?.trim() ?? ''

  const [ieUsers, setIeUsers] = useState<UserAdminRow[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [selectedIeId, setSelectedIeId] = useState('')
  const [assignedSchoolIds, setAssignedSchoolIds] = useState<Set<string>>(() => new Set())
  const assignedRef = useRef(assignedSchoolIds)
  assignedRef.current = assignedSchoolIds

  const [schoolSearch, setSchoolSearch] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [schoolChoices, setSchoolChoices] = useState<SchoolSummary[]>([])
  const [schoolPickerLoading, setSchoolPickerLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(schoolSearch.trim()), 280)
    return () => window.clearTimeout(t)
  }, [schoolSearch])

  const reloadIeList = useCallback(async () => {
    setLoadingList(true)
    setError(null)
    try {
      const res = await listUsers({ role: 'ie', limit: 200 })
      setIeUsers(res.items)
      setSelectedIeId((prev) => {
        if (prev && res.items.some((u) => u.id === prev)) return prev
        if (paramUserId && res.items.some((u) => u.id === paramUserId)) return paramUserId
        return res.items[0]?.id ?? ''
      })
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Could not load evaluators'))
    } finally {
      setLoadingList(false)
    }
  }, [paramUserId])

  useEffect(() => {
    if (user?.role !== 'super_admin') return
    void reloadIeList()
  }, [user?.role, reloadIeList])

  const selectedIe = useMemo(
    () => ieUsers.find((u) => u.id === selectedIeId) ?? null,
    [ieUsers, selectedIeId],
  )

  useEffect(() => {
    if (!selectedIe) {
      setAssignedSchoolIds(new Set())
      return
    }
    setAssignedSchoolIds(new Set(selectedIe.assigned_schools))
  }, [selectedIe])

  useEffect(() => {
    if (user?.role !== 'super_admin' || !selectedIeId) return
    let cancelled = false
    setSchoolPickerLoading(true)
    void getSchools({
      limit: 120,
      ...(debouncedQ.length >= 1 ? { q: debouncedQ } : {}),
    })
      .then((res) => {
        if (cancelled) return
        const mapped = new Map(res.items.map((s) => [s.id, s]))
        const assigned = assignedRef.current
        for (const id of assigned) {
          if (!mapped.has(id)) {
            void getSchool(id)
              .then((detail) => {
                if (cancelled) return
                const sum: SchoolSummary = {
                  id: detail.id,
                  emis_code: detail.emis_code,
                  name: detail.name,
                  uc_id: detail.uc_id,
                  district_name: detail.district_name,
                  taluka_name: detail.taluka_name,
                  uc_name: detail.uc_name,
                  level: detail.level,
                  gender: detail.gender,
                  partner_org_id: detail.partner_org_id,
                  partner_org_name: detail.partner_org_name,
                  principal_name: detail.principal_name,
                  principal_phone: detail.principal_phone,
                  status: detail.status,
                }
                setSchoolChoices((prev) => {
                  const m = new Map(prev.map((x) => [x.id, x]))
                  m.set(sum.id, sum)
                  return [...m.values()]
                })
              })
              .catch(() => {})
          }
        }
        setSchoolChoices([...mapped.values()])
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(getApiErrorMessage(e, 'Could not load schools'))
      })
      .finally(() => {
        if (!cancelled) setSchoolPickerLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.role, selectedIeId, debouncedQ])

  const toggleSchool = (id: string) => {
    setAssignedSchoolIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onSave = async () => {
    if (!selectedIeId) return
    setSaveBusy(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const nextIds = [...assignedSchoolIds]
      await patchUserAssignedSchools(selectedIeId, nextIds)
      setSuccessMsg(`Saved ${nextIds.length} school assignment(s) for ${selectedIe?.full_name ?? 'evaluator'}.`)
      await reloadIeList()
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Save failed'))
    } finally {
      setSaveBusy(false)
    }
  }

  const dirty = selectedIe && !schoolIdsEqual([...assignedSchoolIds], selectedIe.assigned_schools)

  if (user?.role !== 'super_admin') {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">Only Super Admin can assign schools to Independent Evaluators.</p>
      </section>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Field operations</p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">IE school assignments</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Choose an Independent Evaluator, tick the schools they inspect, and save. This replaces scrolling through the full
            user editor—it updates the same backend assignment used for visits and quarterly reports.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            to="/dashboard/users"
            className="rounded-lg border border-muted-surface px-4 py-2 text-center text-sm font-semibold text-secondary hover:bg-muted-surface/40"
          >
            ← All users
          </Link>
          <Link
            to="/dashboard/users/new"
            className="rounded-lg bg-primary px-4 py-2 text-center text-sm font-semibold text-white hover:bg-secondary"
          >
            Add IE account
          </Link>
        </div>
      </header>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {successMsg ? (
        <p className="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800">{successMsg}</p>
      ) : null}

      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm">
        <label className="block text-sm font-medium text-text-secondary">
          Independent Evaluator
          <select
            value={selectedIeId}
            onChange={(e) => setSelectedIeId(e.target.value)}
            disabled={loadingList}
            className="mt-2 w-full max-w-xl rounded-lg border border-muted-surface px-3 py-2 text-text-primary disabled:opacity-60"
          >
            <option value="">{loadingList ? 'Loading…' : 'Select an IE…'}</option>
            {ieUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} · {u.email} ({u.assigned_schools.length} schools)
              </option>
            ))}
          </select>
        </label>

        {selectedIe ? (
          <div className="mt-6 space-y-4 rounded-xl border border-muted-surface bg-section/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-text-secondary">
                Signed-in IE scope ·{' '}
                <span className="font-semibold text-text-primary">{roleLabels.ie}</span>
              </p>
              <Link
                to={`/dashboard/users/${selectedIe.id}/edit#ie-schools`}
                className="text-xs font-semibold text-secondary hover:text-primary"
              >
                Open full profile editor →
              </Link>
            </div>

            <label className="block text-sm">
              <span className="font-medium text-text-secondary">Search schools (EMIS or name)</span>
              <input
                type="search"
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
                placeholder="Type to filter…"
                className="mt-1 w-full rounded-lg border border-muted-surface px-3 py-2 text-sm text-text-primary"
              />
            </label>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-muted-surface bg-surface p-2">
              {schoolPickerLoading ? (
                <p className="py-6 text-center text-sm text-text-muted">Loading schools…</p>
              ) : (
                schoolChoices.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 hover:bg-section"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={assignedSchoolIds.has(s.id)}
                      onChange={() => toggleSchool(s.id)}
                    />
                    <span className="text-sm text-text-primary">
                      <span className="font-mono text-xs text-text-muted">{s.emis_code}</span> · {s.name}{' '}
                      <span className="text-xs text-text-muted">({s.district_name})</span>
                    </span>
                  </label>
                ))
              )}
              {!schoolPickerLoading && schoolChoices.length === 0 ? (
                <p className="py-6 text-center text-xs text-text-muted">No schools match.</p>
              ) : null}
            </div>

            <p className="text-xs text-text-muted">
              Selected: <span className="font-semibold text-text-secondary">{assignedSchoolIds.size}</span> school(s)
            </p>

            <div className="flex flex-wrap gap-2 border-t border-muted-surface pt-4">
              <button
                type="button"
                disabled={saveBusy || !dirty}
                onClick={() => void onSave()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-50"
              >
                {saveBusy ? 'Saving…' : 'Save assignments'}
              </button>
              {!dirty ? (
                <span className="self-center text-xs text-text-muted">No unsaved changes.</span>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-text-muted">
            {loadingList ? 'Loading evaluators…' : 'Create an Independent Evaluator user first, then assign schools here.'}
          </p>
        )}
      </section>
    </div>
  )
}
