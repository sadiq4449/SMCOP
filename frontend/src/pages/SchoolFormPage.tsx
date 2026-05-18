import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import {
  createSchool,
  getDistricts,
  getPartnerOrgs,
  getSchool,
  getTalukas,
  getUnionCouncils,
  updateSchool,
} from '../services/schoolsApi'
import type { District, PartnerOrg, Taluka, UnionCouncil } from '../types/school'

const LEVELS = ['primary', 'middle', 'high', 'higher_secondary'] as const
const GENDERS = ['boys', 'girls', 'mixed'] as const
const STATUSES = ['active', 'inactive'] as const

export function SchoolFormPage() {
  const { user } = useAuth()
  const { schoolId } = useParams<{ schoolId?: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(schoolId)

  const [districts, setDistricts] = useState<District[]>([])
  const [talukas, setTalukas] = useState<Taluka[]>([])
  const [ucs, setUcs] = useState<UnionCouncil[]>([])
  const [partners, setPartners] = useState<PartnerOrg[]>([])

  const [districtId, setDistrictId] = useState('')
  const [talukaId, setTalukaId] = useState('')
  const [ucId, setUcId] = useState('')

  const [emisCode, setEmisCode] = useState('')
  const [name, setName] = useState('')
  const [level, setLevel] = useState<string>('primary')
  const [gender, setGender] = useState<string>('mixed')
  const [partnerOrgId, setPartnerOrgId] = useState('')
  const [principalName, setPrincipalName] = useState('')
  const [principalPhone, setPrincipalPhone] = useState('')
  const [gpsLat, setGpsLat] = useState('')
  const [gpsLng, setGpsLng] = useState('')
  const [status, setStatus] = useState<string>('active')

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
    if (!districtId) {
      setTalukas([])
      setTalukaId('')
      return
    }
    void getTalukas(districtId).then(setTalukas)
  }, [districtId])

  useEffect(() => {
    if (!talukaId) {
      setUcs([])
      setUcId('')
      return
    }
    void getUnionCouncils(talukaId).then(setUcs)
  }, [talukaId])

  useEffect(() => {
    if (!isEdit || !schoolId) return
    if (user?.role !== 'super_admin') {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const s = await getSchool(schoolId)
        if (cancelled) return
        const tls = await getTalukas(s.district_id)
        if (cancelled) return
        const ucsData = await getUnionCouncils(s.taluka_id)
        if (cancelled) return

        setTalukas(tls)
        setUcs(ucsData)
        setDistrictId(s.district_id)
        setTalukaId(s.taluka_id)
        setUcId(s.uc_id)
        setEmisCode(s.emis_code)
        setName(s.name)
        setLevel(s.level)
        setGender(s.gender)
        setPartnerOrgId(s.partner_org_id ?? '')
        setPrincipalName(s.principal_name ?? '')
        setPrincipalPhone(s.principal_phone ?? '')
        setGpsLat(s.gps_latitude != null ? String(s.gps_latitude) : '')
        setGpsLng(s.gps_longitude != null ? String(s.gps_longitude) : '')
        setStatus(s.status)
      } catch {
        setError('Could not load school')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isEdit, schoolId, user?.role])

  if (user?.role !== 'super_admin') {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">Creating and editing schools is restricted to programme administrators.</p>
        <Link to="/dashboard/schools" className="mt-4 inline-block text-sm font-medium text-secondary hover:text-primary">
          ← Back to schools
        </Link>
      </section>
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ucId) {
      setError('Select district, taluka, and union council in order.')
      return
    }

    const body: Record<string, unknown> = {
      emis_code: emisCode.trim(),
      name: name.trim(),
      uc_id: ucId,
      level,
      gender,
      principal_name: principalName.trim() || null,
      principal_phone: principalPhone.trim() || null,
      status,
      partner_org_id: partnerOrgId || null,
      gps_latitude: gpsLat === '' ? null : Number(gpsLat),
      gps_longitude: gpsLng === '' ? null : Number(gpsLng),
    }

    setSaving(true)
    setError(null)
    try {
      if (isEdit && schoolId) {
        await updateSchool(schoolId, body)
        navigate(`/dashboard/schools/${schoolId}`)
      } else {
        const created = await createSchool(body)
        navigate(`/dashboard/schools/${created.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-text-muted">Loading form…</p>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to="/dashboard/schools" className="text-sm font-medium text-secondary hover:text-primary">
          ← Schools
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-text-primary">{isEdit ? 'Edit school' : 'Add school'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm">
        {error || districtsError || partnersError ? (
          <div className="space-y-2" role="alert">
            {error ? (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
            ) : null}
            {districtsError ? (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{districtsError}</p>
            ) : null}
            {partnersError ? (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{partnersError}</p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm md:col-span-3">
            <span className="mb-1 block font-medium text-text-secondary">District</span>
            <select
              required={!isEdit}
              value={districtId}
              onChange={(e) => {
                const v = e.target.value
                setDistrictId(v)
                setTalukaId('')
                setUcId('')
              }}
              className="w-full rounded-lg border border-muted-surface px-3 py-2"
            >
              <option value="">Select district</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm md:col-span-3">
            <span className="mb-1 block font-medium text-text-secondary">Taluka</span>
            <select
              required={!isEdit}
              value={talukaId}
              onChange={(e) => {
                const v = e.target.value
                setTalukaId(v)
                setUcId('')
              }}
              className="w-full rounded-lg border border-muted-surface px-3 py-2"
              disabled={!districtId}
            >
              <option value="">Select taluka</option>
              {talukas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm md:col-span-3">
            <span className="mb-1 block font-medium text-text-secondary">Union council</span>
            <select
              required
              value={ucId}
              onChange={(e) => setUcId(e.target.value)}
              className="w-full rounded-lg border border-muted-surface px-3 py-2"
              disabled={!talukaId}
            >
              <option value="">Select UC</option>
              {ucs.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-secondary">EMIS code</span>
          <input
            required
            value={emisCode}
            onChange={(e) => setEmisCode(e.target.value)}
            className="w-full rounded-lg border border-muted-surface px-3 py-2 font-mono"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-secondary">School name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-muted-surface px-3 py-2"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Level</span>
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="w-full rounded-lg border px-3 py-2">
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Gender</span>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full rounded-lg border px-3 py-2">
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-lg border px-3 py-2">
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text-secondary">Partner organization</span>
          <select value={partnerOrgId} onChange={(e) => setPartnerOrgId(e.target.value)} className="w-full rounded-lg border px-3 py-2">
            <option value="">None</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Principal name</span>
            <input value={principalName} onChange={(e) => setPrincipalName(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Principal phone</span>
            <input value={principalPhone} onChange={(e) => setPrincipalPhone(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">GPS latitude</span>
            <input value={gpsLat} onChange={(e) => setGpsLat(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="Optional" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">GPS longitude</span>
            <input value={gpsLng} onChange={(e) => setGpsLng(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="Optional" />
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-70"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create school'}
          </button>
          <Link to="/dashboard/schools" className="rounded-lg border border-muted-surface px-5 py-2.5 text-sm font-medium text-text-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
