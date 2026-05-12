import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { roleLabels } from '../config/navigation'
import { useAuth } from '../context/AuthContext'
import { deleteUser, listUsers } from '../services/usersApi'
import { getDistricts, getPartnerOrgs } from '../services/schoolsApi'
import type { UserRole } from '../types/auth'
import type { District, PartnerOrg } from '../types/school'
import type { UserAdminRow } from '../types/user'

const ROLE_OPTIONS: UserRole[] = [
  'super_admin',
  'government',
  'deo',
  'enumerator',
  'principal',
  'teacher',
]

export function UsersListPage() {
  const { user } = useAuth()
  const [districts, setDistricts] = useState<District[]>([])
  const [partners, setPartners] = useState<PartnerOrg[]>([])
  const [items, setItems] = useState<UserAdminRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [districtFilter, setDistrictFilter] = useState('')
  const [partnerFilter, setPartnerFilter] = useState('')
  const [search, setSearch] = useState('')

  const refresh = () =>
    listUsers({
      limit: 100,
      role: roleFilter || undefined,
      status: statusFilter || undefined,
      district_id: districtFilter || undefined,
      partner_org_id: partnerFilter || undefined,
      q: search.trim() || undefined,
    })
      .then((res) => {
        setItems(res.items)
        setTotal(res.total)
      })
      .catch((err: Error) => setError(err.message))

  useEffect(() => {
    if (user?.role !== 'super_admin') return
    void getDistricts()
      .then(setDistricts)
      .catch(() => setError('Failed to load districts'))
    void getPartnerOrgs()
      .then(setPartners)
      .catch(() => setError('Failed to load partner organizations'))
  }, [user?.role])

  useEffect(() => {
    if (user?.role !== 'super_admin') return
    setLoading(true)
    setError(null)
    void refresh().finally(() => setLoading(false))
  }, [user?.role, roleFilter, statusFilter, districtFilter, partnerFilter, search])

  const handleDelete = async (row: UserAdminRow) => {
    if (!window.confirm(`Delete user ${row.email}? This cannot be undone.`)) return
    try {
      await deleteUser(row.id)
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  if (user?.role !== 'super_admin') {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">User administration is restricted to Super Admin.</p>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Administration</p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">Users</h1>
          <p className="mt-1 text-sm text-text-muted">
            Create accounts, assign roles, districts, partner scope, and school access.
          </p>
        </div>
        <Link
          to="/dashboard/users/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary"
        >
          Add user
        </Link>
      </header>

      <section className="grid gap-4 rounded-2xl border border-muted-surface bg-surface p-4 shadow-sm md:grid-cols-3 lg:grid-cols-6">
        <label className="block text-sm lg:col-span-2">
          <span className="mb-1 block font-medium text-text-secondary">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or email"
            className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-secondary">Role</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
          >
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {roleLabels[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-secondary">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-secondary">District</span>
          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
          >
            <option value="">Any</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-secondary">Partner</span>
          <select
            value={partnerFilter}
            onChange={(e) => setPartnerFilter(e.target.value)}
            className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
          >
            <option value="">Any</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-muted-surface bg-surface shadow-sm">
        <div className="border-b border-muted-surface px-4 py-3 text-sm text-text-muted">
          {loading ? 'Loading…' : `${total} user${total === 1 ? '' : 's'} match filters`}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-muted-surface text-sm">
            <thead className="bg-section">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Scope</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted-surface">
              {items.map((u) => (
                <tr key={u.id} className="hover:bg-section/80">
                  <td className="px-4 py-3 text-text-primary">{u.full_name}</td>
                  <td className="px-4 py-3 font-mono text-text-secondary">{u.email}</td>
                  <td className="px-4 py-3 text-text-secondary">{roleLabels[u.role]}</td>
                  <td className="max-w-[220px] px-4 py-3 text-xs text-text-muted">
                    {[
                      u.role === 'deo' ? (u.district_id ? 'District assigned' : 'No district') : null,
                      ['enumerator', 'principal', 'teacher'].includes(u.role)
                        ? `${u.assigned_schools.length} school(s)`
                        : null,
                      u.partner_org_id ? 'Partner org' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        u.status === 'active'
                          ? 'rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success'
                          : 'rounded-full bg-muted-surface px-2 py-0.5 text-xs font-medium text-text-muted'
                      }
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      to={`/dashboard/users/${u.id}/edit`}
                      className="font-medium text-secondary hover:text-primary"
                    >
                      Edit
                    </Link>
                    {' · '}
                    <button
                      type="button"
                      className="font-medium text-danger hover:underline"
                      onClick={() => void handleDelete(u)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    No users found.
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
