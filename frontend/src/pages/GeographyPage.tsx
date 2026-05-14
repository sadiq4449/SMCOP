import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import {
  adminCreateDistrict,
  adminCreateTaluka,
  adminCreateUnionCouncil,
  adminDeleteDistrict,
  adminDeleteTaluka,
  adminDeleteUnionCouncil,
  adminUpdateDistrict,
  adminUpdateTaluka,
  adminUpdateUnionCouncil,
} from '../services/geographyAdminApi'
import { getDistricts, getTalukas, getUnionCouncils } from '../services/schoolsApi'
import type { District, Taluka, UnionCouncil } from '../types/school'

export function GeographyPage() {
  const { user } = useAuth()
  const [districts, setDistricts] = useState<District[]>([])
  const [talukas, setTalukas] = useState<Taluka[]>([])
  const [ucs, setUcs] = useState<UnionCouncil[]>([])
  const [districtId, setDistrictId] = useState('')
  const [talukaId, setTalukaId] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dName, setDName] = useState('')
  const [dCode, setDCode] = useState('')
  const [tName, setTName] = useState('')
  const [ucName, setUcName] = useState('')

  const loadDistricts = () =>
    getDistricts()
      .then(setDistricts)
      .catch((e: unknown) => setError(getApiErrorMessage(e, 'Failed to load districts')))

  useEffect(() => {
    if (user?.role !== 'super_admin') return
    setLoading(true)
    setError(null)
    void loadDistricts().finally(() => setLoading(false))
  }, [user?.role])

  useEffect(() => {
    if (!districtId) {
      setTalukas([])
      setTalukaId('')
      return
    }
    void getTalukas(districtId)
      .then(setTalukas)
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

  const refreshAll = async () => {
    await loadDistricts()
    if (districtId) {
      const t = await getTalukas(districtId).catch(() => [] as Taluka[])
      setTalukas(t)
    }
    if (talukaId) {
      const u = await getUnionCouncils(talukaId).catch(() => [] as UnionCouncil[])
      setUcs(u)
    }
  }

  const addDistrict = async (e: FormEvent) => {
    e.preventDefault()
    if (!dName.trim()) return
    try {
      await adminCreateDistrict({
        name: dName.trim(),
        code: dCode.trim() || null,
      })
      setDName('')
      setDCode('')
      await loadDistricts()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Create failed')
    }
  }

  const addTaluka = async (e: FormEvent) => {
    e.preventDefault()
    if (!districtId || !tName.trim()) return
    try {
      await adminCreateTaluka(districtId, { name: tName.trim() })
      setTName('')
      setTalukas(await getTalukas(districtId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Create failed')
    }
  }

  const addUc = async (e: FormEvent) => {
    e.preventDefault()
    if (!talukaId || !ucName.trim()) return
    try {
      await adminCreateUnionCouncil(talukaId, { name: ucName.trim() })
      setUcName('')
      setUcs(await getUnionCouncils(talukaId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Create failed')
    }
  }

  if (user?.role !== 'super_admin') {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">Geography is managed by Super Admin only.</p>
      </section>
    )
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Master data</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Geography</h1>
        <p className="mt-1 text-sm text-text-muted">
          Districts, talukas, and union councils. Schools reference a union council. Deletes are blocked while schools
          still point at any UC in that area.
        </p>
      </header>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          <section className="rounded-2xl border border-muted-surface bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-text-primary">Districts</h2>
            <form onSubmit={addDistrict} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-text-secondary">New district name</span>
                <input
                  value={dName}
                  onChange={(e) => setDName(e.target.value)}
                  className="w-full rounded-lg border border-muted-surface px-3 py-2"
                  placeholder="e.g. District Alpha"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-text-secondary">Code (optional, unique)</span>
                <input
                  value={dCode}
                  onChange={(e) => setDCode(e.target.value)}
                  className="w-full rounded-lg border border-muted-surface px-3 py-2 font-mono text-sm"
                  placeholder="DA-001"
                />
              </label>
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary"
              >
                Add district
              </button>
            </form>
            <ul className="mt-6 max-h-72 space-y-1 overflow-y-auto border-t border-muted-surface pt-4">
              {districts.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setDistrictId(d.id)}
                    className={`flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      districtId === d.id ? 'bg-section font-medium text-text-primary' : 'hover:bg-section/60 text-text-secondary'
                    }`}
                  >
                    <span>{d.name}</span>
                    {d.code ? <span className="font-mono text-xs text-text-muted">{d.code}</span> : null}
                  </button>
                  <div className="mt-1 flex flex-wrap gap-2 px-2 pb-2">
                    <button
                      type="button"
                      className="text-xs font-medium text-secondary hover:text-primary"
                      onClick={() => {
                        const n = window.prompt('District name', d.name)
                        if (!n?.trim()) return
                        void adminUpdateDistrict(d.id, { name: n.trim() }).then(() => void refreshAll())
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-secondary hover:text-primary"
                      onClick={() => {
                        const c = window.prompt('District code (empty to clear)', d.code ?? '')
                        if (c === null) return
                        void adminUpdateDistrict(d.id, { code: c.trim() || null }).then(() => void refreshAll())
                      }}
                    >
                      Code
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-danger hover:underline"
                      onClick={() => {
                        if (!window.confirm(`Delete district “${d.name}” and all talukas/UCs under it (no schools)?`)) return
                        void adminDeleteDistrict(d.id)
                          .then(() => {
                            if (districtId === d.id) setDistrictId('')
                            void refreshAll()
                          })
                          .catch((err: unknown) => alert(err instanceof Error ? err.message : 'Delete failed'))
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section
            className={`rounded-2xl border border-muted-surface bg-surface p-5 shadow-sm ${!districtId ? 'opacity-60' : ''}`}
          >
            <h2 className="text-lg font-semibold text-text-primary">Talukas</h2>
            {!districtId ? (
              <p className="mt-4 text-sm text-text-muted">Select a district to manage talukas.</p>
            ) : (
              <>
                <form onSubmit={addTaluka} className="mt-4 space-y-3">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-text-secondary">New taluka name</span>
                    <input
                      value={tName}
                      onChange={(e) => setTName(e.target.value)}
                      className="w-full rounded-lg border border-muted-surface px-3 py-2"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary"
                  >
                    Add taluka
                  </button>
                </form>
                <ul className="mt-6 max-h-72 space-y-1 overflow-y-auto border-t border-muted-surface pt-4">
                  {talukas.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setTalukaId(t.id)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          talukaId === t.id ? 'bg-section font-medium text-text-primary' : 'hover:bg-section/60 text-text-secondary'
                        }`}
                      >
                        {t.name}
                      </button>
                      <div className="mt-1 flex flex-wrap gap-2 px-2 pb-2">
                        <button
                          type="button"
                          className="text-xs font-medium text-secondary hover:text-primary"
                          onClick={() => {
                            const n = window.prompt('Taluka name', t.name)
                            if (!n?.trim()) return
                            void adminUpdateTaluka(t.id, { name: n.trim() }).then(() => void refreshAll())
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-danger hover:underline"
                          onClick={() => {
                            if (!window.confirm(`Delete taluka “${t.name}” and its union councils (no schools)?`)) return
                            void adminDeleteTaluka(t.id)
                              .then(() => {
                                if (talukaId === t.id) setTalukaId('')
                                void refreshAll()
                              })
                              .catch((err: unknown) => alert(err instanceof Error ? err.message : 'Delete failed'))
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section
            className={`rounded-2xl border border-muted-surface bg-surface p-5 shadow-sm ${!talukaId ? 'opacity-60' : ''}`}
          >
            <h2 className="text-lg font-semibold text-text-primary">Union councils</h2>
            {!talukaId ? (
              <p className="mt-4 text-sm text-text-muted">Select a taluka to manage union councils.</p>
            ) : (
              <>
                <form onSubmit={addUc} className="mt-4 space-y-3">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-text-secondary">New UC name</span>
                    <input
                      value={ucName}
                      onChange={(e) => setUcName(e.target.value)}
                      className="w-full rounded-lg border border-muted-surface px-3 py-2"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary"
                  >
                    Add union council
                  </button>
                </form>
                <ul className="mt-6 max-h-72 space-y-1 overflow-y-auto border-t border-muted-surface pt-4">
                  {ucs.map((u) => (
                    <li key={u.id} className="border-b border-muted-surface/80 py-2 last:border-0">
                      <p className="px-1 text-sm text-text-primary">{u.name}</p>
                      <div className="mt-1 flex flex-wrap gap-2 px-1">
                        <button
                          type="button"
                          className="text-xs font-medium text-secondary hover:text-primary"
                          onClick={() => {
                            const n = window.prompt('Union council name', u.name)
                            if (!n?.trim()) return
                            void adminUpdateUnionCouncil(u.id, { name: n.trim() }).then(() => void refreshAll())
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-danger hover:underline"
                          onClick={() => {
                            if (!window.confirm(`Delete union council “${u.name}” (no schools at this UC)?`)) return
                            void adminDeleteUnionCouncil(u.id)
                              .then(() => void refreshAll())
                              .catch((err: unknown) => alert(err instanceof Error ? err.message : 'Delete failed'))
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
