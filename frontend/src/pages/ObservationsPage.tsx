import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { listObservations, patchObservation } from '../services/observationsApi'
import { downloadDocument } from '../services/visitsApi'
import type { ClassroomObservation } from '../types/observation'

export function ObservationsPage() {
  const { user } = useAuth()
  const [schoolId, setSchoolId] = useState('')
  const [quarter, setQuarter] = useState('')
  const [items, setItems] = useState<ClassroomObservation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const assigned = useMemo(() => user?.assigned_schools ?? [], [user?.assigned_schools])
  const isDeo = user?.role === 'deo'

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listObservations({
        school_id: schoolId.trim() || undefined,
        quarter: quarter.trim() || undefined,
        limit: 100,
      })
      setItems(res.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load observations')
    } finally {
      setLoading(false)
    }
  }

  const saveReviewerComments = async (observationId: string) => {
    const obs = items.find((i) => i.id === observationId)
    const raw =
      reviewDrafts[observationId] !== undefined ? reviewDrafts[observationId] : (obs?.reviewer_comments ?? '')
    setSavingId(observationId)
    setError(null)
    try {
      await patchObservation(observationId, { reviewer_comments: raw.trim() ? raw.trim() : null })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save reviewer comments')
    } finally {
      setSavingId(null)
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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Monitoring</p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">Classroom observations</h1>
          <p className="mt-1 text-sm text-text-muted">Filtered by your monitoring scope.</p>
        </div>
        <Link to="/dashboard/monitoring" className="text-sm font-medium text-secondary hover:text-primary">
          ← Visits
        </Link>
      </header>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm md:col-span-1">
            <span className="mb-1 block font-medium text-text-secondary">School filter</span>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
            >
              <option value="">All visible schools</option>
              {assigned.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm md:col-span-1">
            <span className="mb-1 block font-medium text-text-secondary">Quarter (optional)</span>
            <input
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              placeholder="Q2-2026"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              disabled={loading}
              onClick={() => void load()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-60"
            >
              {loading ? 'Loading…' : 'Apply filters'}
            </button>
          </div>
        </div>
        <p className="text-xs text-text-muted">
          Paste any accessible school UUID into your browser URL bar from Schools, then enter it here if it is not in assigned schools.
        </p>
      </section>

      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Results ({items.length})</h2>
        <div className="space-y-4">
          {items.map((o) => (
            <article key={o.id} className="rounded-xl border border-muted-surface bg-section/40 p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {o.subject} · Grade {o.grade}
                  </p>
                  <p className="text-xs text-text-muted">
                    Teacher {o.teacher_name ?? o.teacher_id ?? '—'} · Quarter {o.quarter}
                    {o.visit_status ? ` · Visit ${o.visit_status}` : ''}
                  </p>
                </div>
                <Link
                  to={`/dashboard/monitoring/${o.visit_id}`}
                  className="text-xs font-semibold text-secondary hover:text-primary"
                >
                  Open visit
                </Link>
              </div>
              <p className="mt-2 text-xs text-text-secondary">
                Engagement {o.score_engagement} · Pedagogy {o.score_pedagogy} · Environment {o.score_environment}
              </p>
              {o.reviewer_comments && !isDeo ? (
                <p className="mt-2 text-xs text-secondary">DEO notes: {o.reviewer_comments}</p>
              ) : null}
              {isDeo && (o.visit_status ?? 'draft') === 'finalized' ? (
                <div className="mt-3 space-y-2 rounded-lg border border-muted-surface bg-surface px-3 py-2">
                  <label className="block text-xs font-medium text-text-secondary">District review (DEO)</label>
                  <textarea
                    value={reviewDrafts[o.id] ?? o.reviewer_comments ?? ''}
                    onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [o.id]: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-muted-surface px-3 py-2 text-sm text-text-primary"
                    placeholder="Add or update reviewer comments for this observation…"
                  />
                  <button
                    type="button"
                    disabled={loading || savingId === o.id}
                    onClick={() => void saveReviewerComments(o.id)}
                    className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {savingId === o.id ? 'Saving…' : 'Save review notes'}
                  </button>
                </div>
              ) : null}
              {isDeo && (o.visit_status ?? 'draft') !== 'finalized' ? (
                <p className="mt-2 text-xs text-text-muted">District review notes can be saved after this visit is finalized.</p>
              ) : null}
              <ul className="mt-3 space-y-1 text-xs">
                {o.documents.map((d) => (
                  <li key={d.id} className="flex justify-between gap-2">
                    <span>{d.file_name}</span>
                    <button
                      type="button"
                      className="font-semibold text-secondary hover:text-primary"
                      onClick={() => void handleDownload(d.id, d.file_name)}
                    >
                      Download
                    </button>
                  </li>
                ))}
              </ul>
            </article>
          ))}
          {items.length === 0 ? <p className="text-sm text-text-muted">No observations loaded yet.</p> : null}
        </div>
      </section>
    </div>
  )
}
