import { useCallback, useEffect, useState } from 'react'

import { roleLabels } from '../config/navigation'
import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import { getSchools } from '../services/schoolsApi'
import { listAssignmentCandidates, patchUserAssignedSchools } from '../services/usersApi'
import type { SchoolSummary } from '../types/school'
import type { UserAdminRow } from '../types/user'

export function FieldStaffAssignmentsPage() {
  const { user } = useAuth()
  const [candidates, setCandidates] = useState<UserAdminRow[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [selected, setSelected] = useState<UserAdminRow | null>(null)
  const [districtSchools, setDistrictSchools] = useState<SchoolSummary[]>([])
  const [loadingSchools, setLoadingSchools] = useState(false)
  const [districtSelection, setDistrictSelection] = useState<Set<string>>(() => new Set())
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState<string | null>(null)

  const districtId = user?.district_id ?? ''

  const reloadCandidates = useCallback(() => {
    if (user?.role !== 'deo' || !districtId) return
    setLoadingList(true)
    setListError(null)
    void listAssignmentCandidates({ q: search.trim() || undefined })
      .then((r) => setCandidates(r.items))
      .catch((e: unknown) => setListError(getApiErrorMessage(e, 'Could not load staff')))
      .finally(() => setLoadingList(false))
  }, [user?.role, districtId, search])

  useEffect(() => {
    if (user?.role !== 'deo') return
    const t = window.setTimeout(() => void reloadCandidates(), 280)
    return () => window.clearTimeout(t)
  }, [user?.role, reloadCandidates])

  useEffect(() => {
    if (!selected || user?.role !== 'deo' || !districtId) {
      setDistrictSchools([])
      setDistrictSelection(new Set())
      return
    }
    setLoadingSchools(true)
    setSaveError(null)
    setSaveOk(null)
    void getSchools({ district_id: districtId, limit: 500 })
      .then((res) => {
        setDistrictSchools(res.items)
        const next = new Set<string>()
        for (const id of selected.assigned_schools) {
          if (res.items.some((s) => s.id === id)) next.add(id)
        }
        setDistrictSelection(next)
      })
      .catch((e: unknown) => setListError(getApiErrorMessage(e, 'Could not load district schools')))
      .finally(() => setLoadingSchools(false))
  }, [selected, user?.role, districtId])

  const toggleSchool = (id: string) => {
    setDistrictSelection((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const handleSave = async () => {
    if (!selected) return
    setSaveBusy(true)
    setSaveError(null)
    setSaveOk(null)
    try {
      const updated = await patchUserAssignedSchools(selected.id, [...districtSelection])
      setSaveOk('Assignments saved.')
      setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setSelected(updated)
    } catch (e: unknown) {
      setSaveError(getApiErrorMessage(e, 'Save failed'))
    } finally {
      setSaveBusy(false)
    }
  }

  if (!user || user.role !== 'deo') {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">Field staff assignments are available to district officers.</p>
      </section>
    )
  }

  if (!districtId) {
    return (
      <section className="rounded-2xl border border-amber-200/90 bg-amber-50/90 p-6 text-sm text-amber-950">
        Your account has no <span className="font-mono">district_id</span>. Ask a Super Admin to set your district on
        the user record before assigning schools.
      </section>
    )
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">District operations</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Field staff · school access</h1>
        <p className="mt-1 max-w-3xl text-sm text-text-muted">
          Choose an enumerator, principal, or teacher, then tick the schools in <strong>your district</strong> they may
          access. Assignments outside your district are left unchanged on save (server merge).
        </p>
      </header>

      {listError ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {listError}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-muted-surface bg-surface p-5 shadow-sm">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Search staff</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or email"
              className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
            />
          </label>
          <p className="mt-2 text-xs text-text-muted">
            {loadingList ? 'Loading…' : `${candidates.length} staff in scope (max 500 scanned).`}
          </p>
          <ul className="mt-4 max-h-[28rem] divide-y divide-muted-surface overflow-y-auto rounded-lg border border-muted-surface">
            {candidates.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelected(c)}
                  className={`flex w-full flex-col items-start gap-0.5 px-3 py-3 text-left text-sm transition-colors hover:bg-section ${
                    selected?.id === c.id ? 'bg-section/80' : ''
                  }`}
                >
                  <span className="font-medium text-text-primary">{c.full_name}</span>
                  <span className="text-xs text-text-muted">{c.email}</span>
                  <span className="text-xs font-medium text-secondary">{roleLabels[c.role as keyof typeof roleLabels]}</span>
                  <span className="text-[11px] text-text-muted">
                    {c.assigned_schools.length} school{c.assigned_schools.length === 1 ? '' : 's'} total
                  </span>
                </button>
              </li>
            ))}
            {!loadingList && candidates.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-text-muted">No matching staff.</li>
            ) : null}
          </ul>
        </section>

        <section className="rounded-2xl border border-muted-surface bg-surface p-5 shadow-sm">
          {!selected ? (
            <p className="text-sm text-text-muted">Select a staff member to edit in-district school access.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{selected.full_name}</h2>
                <p className="text-xs text-text-muted">{selected.email}</p>
              </div>
              {saveOk ? <p className="text-sm text-emerald-800">{saveOk}</p> : null}
              {saveError ? (
                <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
                  {saveError}
                </p>
              ) : null}
              {loadingSchools ? (
                <p className="text-sm text-text-muted">Loading schools in your district…</p>
              ) : (
                <>
                  <p className="text-xs text-text-muted">
                    {districtSchools.length} schools in district. Checked rows are sent on save; other districts stay as
                    they are.
                  </p>
                  <div className="max-h-[22rem] space-y-1 overflow-y-auto rounded-lg border border-muted-surface bg-section/30 p-2">
                    {districtSchools.map((s) => (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 hover:bg-surface"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={districtSelection.has(s.id)}
                          onChange={() => toggleSchool(s.id)}
                        />
                        <span className="text-sm text-text-primary">
                          <span className="font-mono text-xs text-text-muted">{s.emis_code}</span> · {s.name}
                        </span>
                      </label>
                    ))}
                    {districtSchools.length === 0 ? (
                      <p className="px-2 py-6 text-center text-xs text-text-muted">No schools in this district.</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={saveBusy}
                    onClick={() => void handleSave()}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-60"
                  >
                    {saveBusy ? 'Saving…' : 'Save district assignments'}
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
