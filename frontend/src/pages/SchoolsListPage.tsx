import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import { getDistricts, getSchools, getTalukas, getUnionCouncils } from '../services/schoolsApi'
import type { UserRole } from '../types/auth'
import type { District, PaginatedSchools, SchoolSummary, Taluka, UnionCouncil } from '../types/school'

const schoolRoles: UserRole[] = ['super_admin', 'government', 'deo', 'enumerator', 'principal']

export function SchoolsListPage() {
  const { user } = useAuth()
  const [districts, setDistricts] = useState<District[]>([])
  const [talukas, setTalukas] = useState<Taluka[]>([])
  const [ucs, setUcs] = useState<UnionCouncil[]>([])
  const [districtId, setDistrictId] = useState('')
  const [talukaId, setTalukaId] = useState('')
  const [ucId, setUcId] = useState('')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<SchoolSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isSuperAdmin = user?.role === 'super_admin'
  const canAccess = user && schoolRoles.includes(user.role)

  useEffect(() => {
    if (!canAccess) return
    void getDistricts()
      .then(setDistricts)
      .catch((e: unknown) => setError(getApiErrorMessage(e, 'Failed to load districts')))
  }, [canAccess])

  useEffect(() => {
    if (!districtId) {
      setTalukas([])
      setTalukaId('')
      setUcId('')
      return
    }
    setTalukaId('')
    setUcId('')
    void getTalukas(districtId)
      .then(setTalukas)
      .catch((e: unknown) => setError(getApiErrorMessage(e, 'Failed to load talukas')))
  }, [districtId])

  useEffect(() => {
    if (!talukaId) {
      setUcs([])
      setUcId('')
      return
    }
    setUcId('')
    void getUnionCouncils(talukaId)
      .then(setUcs)
      .catch((e: unknown) => setError(getApiErrorMessage(e, 'Failed to load union councils')))
  }, [talukaId])

  useEffect(() => {
    if (!canAccess) return
    setLoading(true)
    setError(null)
    void getSchools({
      district_id: districtId || undefined,
      taluka_id: talukaId || undefined,
      uc_id: ucId || undefined,
      q: search.trim() || undefined,
      limit: 100,
    })
      .then((res: PaginatedSchools) => {
        setItems(res.items)
        setTotal(res.total)
      })
      .catch((e: unknown) => setError(getApiErrorMessage(e, 'Failed to load schools')))
      .finally(() => setLoading(false))
  }, [canAccess, districtId, talukaId, ucId, search])

  if (!user || !canAccess) {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">Your role cannot access the school registry.</p>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">School registry</p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">Schools</h1>
          <p className="mt-1 text-sm text-text-muted">
            Filter by district hierarchy or search by EMIS / school name.
          </p>
        </div>
        {isSuperAdmin ? (
          <Link
            to="/dashboard/schools/new"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary"
          >
            Add school
          </Link>
        ) : null}
      </header>

      <section className="grid gap-4 rounded-2xl border border-muted-surface bg-surface p-4 shadow-sm md:grid-cols-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-secondary">District</span>
          <select
            value={districtId}
            onChange={(e) => setDistrictId(e.target.value)}
            className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
          >
            <option value="">All districts</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-secondary">Taluka</span>
          <select
            value={talukaId}
            onChange={(e) => setTalukaId(e.target.value)}
            className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
            disabled={!districtId}
          >
            <option value="">All talukas</option>
            {talukas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-secondary">Union council</span>
          <select
            value={ucId}
            onChange={(e) => setUcId(e.target.value)}
            className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
            disabled={!talukaId}
          >
            <option value="">All UCs</option>
            {ucs.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm md:col-span-1">
          <span className="mb-1 block font-medium text-text-secondary">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="EMIS or school name"
            className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
          />
        </label>
      </section>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-muted-surface bg-surface shadow-sm">
        <div className="border-b border-muted-surface px-4 py-3 text-sm text-text-muted">
          {loading ? 'Loading…' : `${total} school${total === 1 ? '' : 's'} match filters`}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-muted-surface text-sm">
            <thead className="bg-section">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">EMIS</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">School</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Location</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Partner</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted-surface">
              {items.map((s) => (
                <tr key={s.id} className="hover:bg-section/80">
                  <td className="px-4 py-3 font-mono text-text-primary">{s.emis_code}</td>
                  <td className="px-4 py-3 text-text-primary">{s.name}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {s.district_name} → {s.taluka_name} → {s.uc_name}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{s.partner_org_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        s.status === 'active'
                          ? 'rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success'
                          : 'rounded-full bg-muted-surface px-2 py-0.5 text-xs font-medium text-text-muted'
                      }
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/dashboard/schools/${s.id}`} className="font-medium text-secondary hover:text-primary">
                      View
                    </Link>
                    {isSuperAdmin ? (
                      <>
                        {' · '}
                        <Link
                          to={`/dashboard/schools/${s.id}/edit`}
                          className="font-medium text-secondary hover:text-primary"
                        >
                          Edit
                        </Link>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    No schools found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
