import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import { getDistricts, getTalukas, getUnionCouncils } from '../services/schoolsApi'
import type { District, Taluka, UnionCouncil } from '../types/school'

export function DistrictsBrowsePage() {
  const { user } = useAuth()
  const [districts, setDistricts] = useState<District[]>([])
  const [districtId, setDistrictId] = useState('')
  const [talukas, setTalukas] = useState<Taluka[]>([])
  const [talukaId, setTalukaId] = useState('')
  const [ucs, setUcs] = useState<UnionCouncil[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    setError(null)
    void getDistricts()
      .then((rows) => {
        setDistricts(rows)
        setDistrictId((prev) => prev || rows[0]?.id || '')
      })
      .catch((e: unknown) => setError(getApiErrorMessage(e, 'Failed to load districts')))
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (!districtId) {
      setTalukas([])
      setTalukaId('')
      return
    }
    void getTalukas(districtId)
      .then((rows) => {
        setTalukas(rows)
        setTalukaId((prev) => (prev && rows.some((t) => t.id === prev) ? prev : rows[0]?.id || ''))
      })
      .catch((e: unknown) => setError(getApiErrorMessage(e, 'Failed to load talukas')))
  }, [districtId])

  useEffect(() => {
    if (!talukaId) {
      setUcs([])
      return
    }
    void getUnionCouncils(talukaId)
      .then(setUcs)
      .catch((e: unknown) => setError(getApiErrorMessage(e, 'Failed to load union councils')))
  }, [talukaId])

  if (!user) return null

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Geography</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Districts directory</h1>
        <p className="mt-1 text-sm text-text-muted">
          Read-only reference for districts, talukas, and union councils.
          {user.role === 'super_admin' ? (
            <>
              {' '}
              Edit master data under{' '}
              <Link className="font-semibold text-secondary underline" to="/dashboard/geography">
                Geography
              </Link>
              .
            </>
          ) : (
            <span> Geography changes are limited to programme administrators.</span>
          )}
        </p>
      </header>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-muted-surface bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <label className="block min-w-[200px] flex-1 text-sm">
            <span className="mb-1 block font-medium text-text-secondary">District</span>
            <select
              disabled={loading}
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary disabled:opacity-50"
            >
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.code ? ` (${d.code})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-[200px] flex-1 text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Taluka</span>
            <select
              disabled={loading || !talukas.length}
              value={talukaId}
              onChange={(e) => setTalukaId(e.target.value)}
              className="w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary disabled:opacity-50"
            >
              {talukas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 border-t border-muted-surface pt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Union councils ({ucs.length})
          </h2>
          {ucs.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">{loading ? 'Loading…' : 'No union councils in this taluka.'}</p>
          ) : (
            <ul className="mt-2 max-h-[360px] space-y-1 overflow-y-auto text-sm">
              {ucs.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-muted-surface px-3 py-2 hover:bg-muted-surface/40"
                >
                  <span className="font-medium text-text-primary">{u.name}</span>
                  <span className="font-mono text-xs text-text-muted">{u.id.slice(0, 8)}…</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
