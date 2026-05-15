import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { roleLabels } from '../config/navigation'
import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import { getDistricts, getPartnerOrgs, getSchool, getSchools } from '../services/schoolsApi'
import { createUser, getUser, updateUser } from '../services/usersApi'
import type { UserRole } from '../types/auth'
import type { District, PartnerOrg, SchoolDetail, SchoolSummary } from '../types/school'

const ROLE_OPTIONS: UserRole[] = [
  'super_admin',
  'government',
  'deo',
  'enumerator',
  'principal',
  'teacher',
]

const SCHOOL_ROLES: UserRole[] = ['enumerator', 'principal', 'teacher']

function schoolDetailToSummary(s: SchoolDetail): SchoolSummary {
  return {
    id: s.id,
    emis_code: s.emis_code,
    name: s.name,
    uc_id: s.uc_id,
    district_name: s.district_name,
    taluka_name: s.taluka_name,
    uc_name: s.uc_name,
    level: s.level,
    gender: s.gender,
    partner_org_id: s.partner_org_id,
    partner_org_name: s.partner_org_name,
    principal_name: s.principal_name,
    principal_phone: s.principal_phone,
    status: s.status,
  }
}

export function UserFormPage() {
  const { userId } = useParams<{ userId?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEdit = Boolean(userId)

  const [districts, setDistricts] = useState<District[]>([])
  const [partners, setPartners] = useState<PartnerOrg[]>([])
  const [schoolSearch, setSchoolSearch] = useState('')
  const [schoolChoices, setSchoolChoices] = useState<SchoolSummary[]>([])

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('enumerator')
  const [status, setStatus] = useState('active')
  const [partnerOrgId, setPartnerOrgId] = useState('')
  const [districtId, setDistrictId] = useState('')
  const [linkedTeacherId, setLinkedTeacherId] = useState('')
  const [assignedSchoolIds, setAssignedSchoolIds] = useState<Set<string>>(() => new Set())
  const assignedSchoolIdsRef = useRef(assignedSchoolIds)
  assignedSchoolIdsRef.current = assignedSchoolIds

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [districtsError, setDistrictsError] = useState<string | null>(null)
  const [partnersError, setPartnersError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role !== 'super_admin') return
    setDistrictsError(null)
    void getDistricts()
      .then(setDistricts)
      .catch((e: unknown) => setDistrictsError(getApiErrorMessage(e, 'Failed to load districts')))
  }, [user?.role])

  useEffect(() => {
    if (user?.role !== 'super_admin') return
    setPartnersError(null)
    void getPartnerOrgs()
      .then(setPartners)
      .catch((e: unknown) => setPartnersError(getApiErrorMessage(e, 'Failed to load partner organizations')))
  }, [user?.role])

  useEffect(() => {
    if (user?.role !== 'super_admin') return
    if (!SCHOOL_ROLES.includes(role)) return
    let cancelled = false
    const h = window.setTimeout(() => {
      void getSchools({ q: schoolSearch.trim() || undefined, limit: 100 })
        .then((res) => {
          if (!cancelled) {
            setSchoolChoices((prev) => {
              const fromSearch = new Map(res.items.map((s) => [s.id, s]))
              const assigned = assignedSchoolIdsRef.current
              for (const s of prev) {
                if (assigned.has(s.id)) {
                  fromSearch.set(s.id, s)
                }
              }
              return [...fromSearch.values()]
            })
          }
        })
        .catch(() => {
          if (!cancelled) setError('Could not load schools')
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(h)
    }
  }, [user?.role, role, schoolSearch])

  useEffect(() => {
    if (!isEdit || !userId || user?.role !== 'super_admin') return
    let cancelled = false
    setLoading(true)
    setError(null)
    void getUser(userId)
      .then(async (u) => {
        if (cancelled) return
        setFullName(u.full_name)
        setEmail(u.email)
        setRole(u.role)
        setStatus(u.status)
        setPartnerOrgId(u.partner_org_id ?? '')
        setDistrictId(u.district_id ?? '')
        setLinkedTeacherId(u.linked_teacher_id ?? '')
        setAssignedSchoolIds(new Set(u.assigned_schools))

        const needsHydration = u.assigned_schools.length > 0 && SCHOOL_ROLES.includes(u.role)
        if (!needsHydration) return

        const summaries = (
          await Promise.all(
            u.assigned_schools.map((id) =>
              getSchool(id)
                .then(schoolDetailToSummary)
                .catch(() => null),
            ),
          )
        ).filter((x): x is SchoolSummary => x != null)
        if (cancelled) return
        setSchoolChoices((prev) => {
          const merged = new Map(prev.map((s) => [s.id, s]))
          for (const s of summaries) merged.set(s.id, s)
          return [...merged.values()]
        })
      })
      .catch(() => setError('Could not load user'))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isEdit, userId, user?.role])

  const toggleSchool = (id: string) => {
    setAssignedSchoolIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const showDistrict = role === 'deo'
  const showSchoolPicker = SCHOOL_ROLES.includes(role)
  const showDistrictPicker = showDistrict || showSchoolPicker

  const selectedSchoolLabels = useMemo(() => {
    const map = new Map(schoolChoices.map((s) => [s.id, s.name]))
    return [...assignedSchoolIds].map((id) => ({ id, name: map.get(id) ?? id }))
  }, [assignedSchoolIds, schoolChoices])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !email.trim()) return
    if (!isEdit && password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    const body: Record<string, unknown> = {
      full_name: fullName.trim(),
      email: email.trim(),
      role,
      status,
      partner_org_id: partnerOrgId || null,
    }

    if (!isEdit) {
      body.password = password
      if (role === 'deo') {
        body.district_id = districtId.trim() || null
      } else if (SCHOOL_ROLES.includes(role)) {
        body.district_id = districtId.trim() || null
      } else {
        body.district_id = null
      }
      body.assigned_schools = showSchoolPicker ? [...assignedSchoolIds] : []
      if (role === 'teacher') {
        body.linked_teacher_id = linkedTeacherId.trim() || null
      }
    } else {
      if (showDistrictPicker) {
        body.district_id = districtId.trim() || null
      }
      if (showSchoolPicker) {
        body.assigned_schools = [...assignedSchoolIds]
      }
      if (role === 'teacher') {
        body.linked_teacher_id = linkedTeacherId.trim() || null
      }
      if (password.trim()) {
        body.password = password.trim()
      }
    }

    setSaving(true)
    setError(null)
    try {
      if (isEdit && userId) {
        await updateUser(userId, body)
      } else {
        await createUser(body)
      }
      navigate('/dashboard/users')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (user?.role !== 'super_admin') {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">Only Super Admin can manage users.</p>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-muted">Loading user…</p>
      </section>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Administration</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">{isEdit ? 'Edit user' : 'New user'}</h1>
        <p className="mt-1 text-sm text-text-muted">
          Credentials, role, district scope for DEO accounts, partner linkage, and assigned schools for field roles.
        </p>
      </header>

      {error || districtsError || partnersError ? (
        <div className="space-y-2" role="alert">
          {error ? (
            <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
          ) : null}
          {districtsError ? (
            <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">{districtsError}</p>
          ) : null}
          {partnersError ? (
            <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">{partnersError}</p>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6 rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-text-secondary">Full name</span>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-text-secondary">Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-text-secondary">
              Password {isEdit ? '(leave blank to keep current)' : ''}
            </span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
              minLength={isEdit ? 0 : 6}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
            >
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
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive (cannot sign in)</option>
            </select>
          </label>

          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-text-secondary">Partner organization (optional)</span>
            <select
              value={partnerOrgId}
              onChange={(e) => setPartnerOrgId(e.target.value)}
              className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
            >
              <option value="">None</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          {showDistrictPicker ? (
            <label className="block text-sm md:col-span-2">
              <span className="mb-1 block font-medium text-text-secondary">
                {showDistrict ? 'District scope (required for DEO)' : 'Primary district (optional)'}
              </span>
              <p className="mb-2 text-xs text-text-muted">
                {showDistrict
                  ? 'DEO dashboards and approvals are limited to this district.'
                  : 'If set before any school is assigned, DEOs in that district can attach in-district schools without Super Admin.'}
              </p>
              <select
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
                required={showDistrict}
                className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
              >
                <option value="">{showDistrict ? 'Select district…' : 'None / not tied to one district'}</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {role === 'teacher' ? (
            <label className="block text-sm md:col-span-2">
              <span className="mb-1 block font-medium text-text-secondary">
                Linked teacher profile UUID (optional — required for self-service attendance)
              </span>
              <input
                value={linkedTeacherId}
                onChange={(e) => setLinkedTeacherId(e.target.value)}
                placeholder="Teacher row UUID from the school profile"
                className="w-full rounded-lg border border-muted-surface px-3 py-2 font-mono text-sm text-text-primary"
              />
            </label>
          ) : null}

          {showSchoolPicker ? (
            <div className="md:col-span-2 space-y-3 rounded-xl border border-muted-surface bg-section/40 p-4">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Assigned schools</h3>
                <p className="mt-1 text-xs text-text-muted">
                  Search and tick schools this account may access. Lists are enforced on school APIs.
                </p>
              </div>
              <input
                type="search"
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
                placeholder="Search EMIS or school name"
                className="w-full rounded-lg border border-muted-surface px-3 py-2 text-sm text-text-primary"
              />
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-muted-surface bg-surface p-2">
                {schoolChoices.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 hover:bg-section">
                    <input
                      type="checkbox"
                      checked={assignedSchoolIds.has(s.id)}
                      onChange={() => toggleSchool(s.id)}
                      className="mt-1"
                    />
                    <span className="text-sm text-text-primary">
                      <span className="font-mono text-text-muted">{s.emis_code}</span> · {s.name}
                    </span>
                  </label>
                ))}
                {schoolChoices.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-text-muted">No schools match this search.</p>
                ) : null}
              </div>
              {selectedSchoolLabels.length > 0 ? (
                <p className="text-xs text-text-secondary">
                  Selected ({selectedSchoolLabels.length}):{' '}
                  {selectedSchoolLabels.map((s) => s.name).join(', ')}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3 border-t border-muted-surface pt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-60"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}
          </button>
          <Link
            to="/dashboard/users"
            className="rounded-lg border border-muted-surface px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-section"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
