import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { roleLabels } from '../config/navigation'
import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import { getPartnerOrgs, getSchool, getSchools } from '../services/schoolsApi'
import { createUser, getUser, updateUser } from '../services/usersApi'
import type { UserRole } from '../types/auth'
import type { PartnerOrg, SchoolDetail, SchoolSummary } from '../types/school'

const ROLE_OPTIONS: UserRole[] = ['super_admin', 'government', 'ie', 'partner']

const IE_ROLE: UserRole = 'ie'

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
  const location = useLocation()
  const schoolAnchorRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const isEdit = Boolean(userId)

  const [partners, setPartners] = useState<PartnerOrg[]>([])
  const [schoolSearch, setSchoolSearch] = useState('')
  const [schoolChoices, setSchoolChoices] = useState<SchoolSummary[]>([])

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('ie')
  const [status, setStatus] = useState('active')
  const [partnerOrgId, setPartnerOrgId] = useState('')
  const [assignedSchoolIds, setAssignedSchoolIds] = useState<Set<string>>(() => new Set())
  const assignedSchoolIdsRef = useRef(assignedSchoolIds)
  assignedSchoolIdsRef.current = assignedSchoolIds

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [partnersError, setPartnersError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role !== 'super_admin') return
    setPartnersError(null)
    void getPartnerOrgs()
      .then(setPartners)
      .catch((e: unknown) => setPartnersError(getApiErrorMessage(e, 'Failed to load partner organizations')))
  }, [user?.role])

  useEffect(() => {
    if (user?.role !== 'super_admin') return
    if (role !== IE_ROLE) return
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
        setRole(u.role as UserRole)
        setStatus(u.status)
        setPartnerOrgId(u.partner_org_id ?? '')
        setAssignedSchoolIds(new Set(u.assigned_schools))

        const needsHydration = u.assigned_schools.length > 0 && u.role === 'ie'
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

  const showSchoolPicker = role === IE_ROLE
  const showPartnerOrgPicker = role === 'partner'

  useEffect(() => {
    if (loading || location.hash !== '#ie-schools' || !showSchoolPicker) return
    const frame = window.requestAnimationFrame(() => {
      schoolAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [loading, location.hash, showSchoolPicker])

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
    if (role === 'partner' && !partnerOrgId.trim()) {
      setError('Partner accounts must have a partner organization selected.')
      return
    }

    const body: Record<string, unknown> = {
      full_name: fullName.trim(),
      email: email.trim(),
      role,
      status,
      partner_org_id: showPartnerOrgPicker ? partnerOrgId.trim() || null : null,
      assigned_schools: showSchoolPicker ? [...assignedSchoolIds] : [],
    }

    if (!isEdit) {
      body.password = password
    } else if (password.trim()) {
      body.password = password.trim()
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
          SMCOP roles: Super Admin, PPP Node (Government), Independent Evaluator (school assignments), Partner organization
          (oversight on schools tied to their org).
        </p>
      </header>

      {error || partnersError ? (
        <div className="space-y-2" role="alert">
          {error ? <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
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

          {showPartnerOrgPicker ? (
            <label className="block text-sm md:col-span-2">
              <span className="mb-1 block font-medium text-text-secondary">Partner organization (required)</span>
              <select
                required
                value={partnerOrgId}
                onChange={(e) => setPartnerOrgId(e.target.value)}
                className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
              >
                <option value="">Select partner organization…</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {showSchoolPicker ? (
            <div
              id="ie-schools"
              ref={schoolAnchorRef}
              className="md:col-span-2 space-y-3 rounded-xl border border-muted-surface bg-section/40 p-4"
            >
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Assigned schools (IE)</h3>
                <p className="mt-1 text-xs text-text-muted">
                  Independent Evaluators may only access visits and reporting for schools listed here.
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
