import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useMatch, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import {
  createVisit,
  downloadDocument,
  getKpis,
  getVisit,
  patchVisit,
  submitVisitKpis,
  uploadVisitEvidence,
} from '../services/visitsApi'
import type { KPIRow, VisitDetail } from '../types/visit'

const INFRA_PRESETS = [
  'Boundary wall / perimeter security',
  'Drinking water supply',
  'Electricity availability',
  'Functional toilets',
  'Classroom furniture & seating',
]

export function VisitFormPage() {
  const { visitId } = useParams<{ visitId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isNew = Boolean(useMatch('/dashboard/monitoring/new'))
  const { user } = useAuth()

  const [kpis, setKpis] = useState<KPIRow[]>([])
  const [visit, setVisit] = useState<VisitDetail | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [infraLines, setInfraLines] = useState<Array<{ item_name: string; status: string; remarks: string }>>([])
  const [visitDate, setVisitDate] = useState('')
  const [remarks, setRemarks] = useState('')
  const [gpsLat, setGpsLat] = useState('')
  const [gpsLng, setGpsLng] = useState('')
  const [quarter, setQuarter] = useState('Q2-2026')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const schoolIdParam = searchParams.get('schoolId') ?? ''

  const canEdit = useMemo(() => {
    if (!user || !visit) return isNew
    if (user.role === 'super_admin') return true
    if (user.role !== 'enumerator') return false
    return visit.status === 'draft'
  }, [user, visit, isNew])

  useEffect(() => {
    void getKpis()
      .then(setKpis)
      .catch(() => setError('Failed to load KPI catalog'))
  }, [])

  useEffect(() => {
    if (!isNew && visitId) {
      setLoading(true)
      void getVisit(visitId)
        .then((v) => {
          setVisit(v)
          const next: Record<string, number> = {}
          for (const s of v.kpi_scores) next[s.kpi_id] = s.score
          setScores(next)
          if (v.infrastructure.length > 0) {
            setInfraLines(
              v.infrastructure.map((i) => ({
                item_name: i.item_name,
                status: i.status,
                remarks: i.remarks ?? '',
              })),
            )
          } else {
            setInfraLines(
              INFRA_PRESETS.map((name) => ({
                item_name: name,
                status: 'available',
                remarks: '',
              })),
            )
          }
          setVisitDate(v.visit_date ?? '')
          setRemarks(v.remarks ?? '')
          setGpsLat(v.gps_latitude != null ? String(v.gps_latitude) : '')
          setGpsLng(v.gps_longitude != null ? String(v.gps_longitude) : '')
        })
        .catch(() => setError('Could not load visit'))
        .finally(() => setLoading(false))
    } else {
      setInfraLines(
        INFRA_PRESETS.map((name) => ({
          item_name: name,
          status: 'available',
          remarks: '',
        })),
      )
      setLoading(false)
    }
  }, [isNew, visitId])

  const handleCreate = async () => {
    if (!schoolIdParam) {
      setError('Missing schoolId — open from Assigned schools.')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const v = await createVisit({
        school_id: schoolIdParam,
        quarter: quarter.trim(),
        visit_date: visitDate || null,
      })
      navigate(`/dashboard/monitoring/${v.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  const saveMeta = async () => {
    if (!visit || isNew) return
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        visit_date: visitDate || null,
        remarks: remarks || null,
        gps_latitude: gpsLat ? Number.parseFloat(gpsLat) : null,
        gps_longitude: gpsLng ? Number.parseFloat(gpsLng) : null,
        infrastructure: infraLines.map((r) => ({
          item_name: r.item_name,
          status: r.status,
          remarks: r.remarks || null,
        })),
      }
      const v = await patchVisit(visit.id, body)
      setVisit(v)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const saveKpis = async () => {
    if (!visit || isNew) return
    setSaving(true)
    setError(null)
    try {
      const payloadScores = kpis.map((k) => ({
        kpi_id: k.id,
        score: scores[k.id] ?? 0,
        remarks: null as string | null,
      }))
      const v = await submitVisitKpis(visit.id, { scores: payloadScores, remarks })
      setVisit(v)
      const next: Record<string, number> = {}
      for (const s of v.kpi_scores) next[s.kpi_id] = s.score
      setScores(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save KPIs failed')
    } finally {
      setSaving(false)
    }
  }

  const finalize = async () => {
    if (!visit || isNew) return
    setSaving(true)
    setError(null)
    try {
      await submitVisitKpis(visit.id, {
        scores: kpis.map((k) => ({ kpi_id: k.id, score: scores[k.id] ?? 0 })),
        remarks,
      })
      const v = await patchVisit(visit.id, {
        status: 'finalized',
        visit_date: visitDate || null,
        remarks: remarks || null,
        gps_latitude: gpsLat ? Number.parseFloat(gpsLat) : null,
        gps_longitude: gpsLng ? Number.parseFloat(gpsLng) : null,
        infrastructure: infraLines.map((r) => ({
          item_name: r.item_name,
          status: r.status,
          remarks: r.remarks || null,
        })),
      })
      setVisit(v)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Finalize failed — ensure date set & KPI saved.')
    } finally {
      setSaving(false)
    }
  }

  const onUpload = async (e: FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    const file = input.files?.[0]
    if (!file || !visit || isNew) return
    setSaving(true)
    setError(null)
    try {
      await uploadVisitEvidence(visit.id, file, {
        latitude: gpsLat ? Number.parseFloat(gpsLat) : undefined,
        longitude: gpsLng ? Number.parseFloat(gpsLng) : undefined,
      })
      const v = await getVisit(visit.id)
      setVisit(v)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSaving(false)
      input.value = ''
    }
  }

  const handleDownload = async (docId: string, filename: string) => {
    try {
      const blob = await downloadDocument(docId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Download failed')
    }
  }

  if (!user) return null

  if (loading) {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-muted">Loading visit…</p>
      </section>
    )
  }

  if (!isNew && !visit) {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-muted">Visit not found or inaccessible.</p>
        <Link to="/dashboard/monitoring" className="mt-4 inline-block text-secondary hover:text-primary">
          ← Back to list
        </Link>
      </section>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Monitoring visit</p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">{isNew ? 'New visit' : `Visit ${visit?.quarter ?? ''}`}</h1>
          <p className="mt-1 text-sm text-text-muted">
            Draft saves KPI scores, checklist, GPS, and evidence; finalize locks the record for auditors.
          </p>
        </div>
        <Link to="/dashboard/monitoring" className="text-sm font-medium text-secondary hover:text-primary">
          ← Back to list
        </Link>
      </header>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {isNew ? (
        <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Start visit</h2>
          <p className="text-sm text-text-muted">
            School: <span className="font-mono text-text-secondary">{schoolIdParam || '— pick from Assigned schools'}</span>
          </p>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Quarter</span>
            <input
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Visit date</span>
            <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </label>
          <button
            type="button"
            disabled={creating || !schoolIdParam || user.role !== 'enumerator'}
            onClick={() => void handleCreate()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create draft visit'}
          </button>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="text-lg font-semibold text-text-primary">Visit details</h2>
              <span
                className={
                  visit?.status === 'finalized'
                    ? 'rounded-full bg-success/15 px-3 py-0.5 text-xs font-semibold text-success'
                    : 'rounded-full bg-muted-surface px-3 py-0.5 text-xs font-semibold text-text-muted'
                }
              >
                {visit?.status}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm md:col-span-2">
                <span className="mb-1 block font-medium text-text-secondary">Visit date</span>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 disabled:opacity-60"
                />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="mb-1 block font-medium text-text-secondary">Enumerator remarks</span>
                <textarea
                  disabled={!canEdit}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2 disabled:opacity-60"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-text-secondary">GPS latitude</span>
                <input
                  disabled={!canEdit}
                  value={gpsLat}
                  onChange={(e) => setGpsLat(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 disabled:opacity-60"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-text-secondary">GPS longitude</span>
                <input
                  disabled={!canEdit}
                  value={gpsLng}
                  onChange={(e) => setGpsLng(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 disabled:opacity-60"
                />
              </label>
            </div>
            {canEdit ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveMeta()}
                className="rounded-lg border border-muted-surface px-4 py-2 text-sm font-semibold text-text-primary hover:bg-section"
              >
                Save details & checklist
              </button>
            ) : null}
          </section>

          <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-text-primary">Infrastructure checklist</h2>
            <div className="space-y-3">
              {infraLines.map((line, idx) => (
                <div key={`${line.item_name}-${idx}`} className="grid gap-2 rounded-lg border border-muted-surface p-3 md:grid-cols-12">
                  <p className="text-sm font-medium text-text-primary md:col-span-5">{line.item_name}</p>
                  <select
                    disabled={!canEdit}
                    value={line.status}
                    onChange={(e) => {
                      const next = [...infraLines]
                      next[idx] = { ...next[idx], status: e.target.value }
                      setInfraLines(next)
                    }}
                    className="rounded-lg border px-2 py-1 text-sm md:col-span-3 disabled:opacity-60"
                  >
                    <option value="available">Available</option>
                    <option value="not_available">Not available</option>
                    <option value="needs_repair">Needs repair</option>
                  </select>
                  <input
                    disabled={!canEdit}
                    placeholder="Notes"
                    value={line.remarks}
                    onChange={(e) => {
                      const next = [...infraLines]
                      next[idx] = { ...next[idx], remarks: e.target.value }
                      setInfraLines(next)
                    }}
                    className="rounded-lg border px-2 py-1 text-sm md:col-span-4 disabled:opacity-60"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="text-lg font-semibold text-text-primary">KPI scores (0–max)</h2>
              {visit?.aggregate_score != null ? (
                <p className="text-sm text-secondary">
                  Aggregate: <span className="font-semibold">{visit.aggregate_score}%</span>
                </p>
              ) : null}
            </div>
            <div className="space-y-4">
              {kpis.map((k) => (
                <div key={k.id} className="flex flex-wrap items-center gap-4">
                  <div className="min-w-[220px] flex-1">
                    <p className="text-sm font-medium text-text-primary">{k.name}</p>
                    <p className="text-xs text-text-muted">Max {k.max_score}</p>
                  </div>
                  <input
                    type="range"
                    disabled={!canEdit}
                    min={0}
                    max={k.max_score}
                    value={scores[k.id] ?? 0}
                    onChange={(e) => setScores((s) => ({ ...s, [k.id]: Number(e.target.value) }))}
                    className="w-40 disabled:opacity-60"
                  />
                  <span className="w-8 font-mono text-sm">{scores[k.id] ?? 0}</span>
                </div>
              ))}
            </div>
            {canEdit ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveKpis()}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-primary"
              >
                Save KPI scores
              </button>
            ) : null}
          </section>

          <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-text-primary">Evidence photos</h2>
            {canEdit ? (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-section">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => void onUpload(e)} />
                Upload image
              </label>
            ) : (
              <p className="text-sm text-text-muted">Read-only — downloads available below.</p>
            )}
            <ul className="space-y-2 text-sm">
              {visit?.documents.map((d) => (
                <li key={d.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-section/60 px-3 py-2">
                  <span>{d.file_name}</span>
                  <button
                    type="button"
                    className="font-medium text-secondary hover:text-primary"
                    onClick={() => void handleDownload(d.id, d.file_name)}
                  >
                    Download
                  </button>
                </li>
              ))}
              {visit?.documents.length === 0 ? <li className="text-text-muted">No photos yet.</li> : null}
            </ul>
          </section>

          {canEdit && visit?.status === 'draft' ? (
            <section className="rounded-2xl border border-danger/30 bg-danger/5 p-6">
              <h2 className="text-lg font-semibold text-text-primary">Finalize</h2>
              <p className="mt-1 text-sm text-text-muted">
                Requires visit date and all seven KPI scores saved. After finalize, only Super Admin can edit.
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={() => void finalize()}
                className="mt-4 rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Submit / finalize visit
              </button>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
