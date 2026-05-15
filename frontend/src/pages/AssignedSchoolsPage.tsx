import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import { getSchools } from '../services/schoolsApi'
import type { SchoolSummary } from '../types/school'

export function AssignedSchoolsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<SchoolSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const allowed = user?.role === 'ie'

  useEffect(() => {
    if (!allowed) return
    setLoading(true)
    void getSchools({ limit: 100 })
      .then((r) => setItems(r.items))
      .catch((e: unknown) => setError(getApiErrorMessage(e, 'Failed to load schools')))
      .finally(() => setLoading(false))
  }, [allowed])

  if (!user || !allowed) {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">Assigned schools are shown for Independent Evaluator accounts.</p>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">School access</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Assigned schools</h1>
        <p className="mt-1 text-sm text-text-muted">
          Schools your IE account may monitor — start a quarterly visit from here.
        </p>
      </header>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-muted-surface bg-surface shadow-sm">
        <div className="border-b border-muted-surface px-4 py-3 text-sm text-text-muted">
          {loading ? 'Loading…' : `${items.length} school${items.length === 1 ? '' : 's'}`}
        </div>
        <div className="divide-y divide-muted-surface">
          {items.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-text-primary">{s.name}</p>
                <p className="text-xs font-mono text-text-muted">
                  {s.emis_code} · {s.district_name}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/dashboard/monitoring/new?schoolId=${encodeURIComponent(s.id)}`}
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-secondary"
                >
                  New visit
                </Link>
                <Link
                  to={`/dashboard/schools/${encodeURIComponent(s.id)}`}
                  className="rounded-lg border border-muted-surface px-3 py-1.5 text-sm font-semibold text-text-primary hover:bg-muted-surface/40"
                >
                  School profile
                </Link>
              </div>
            </div>
          ))}
          {!loading && items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-text-muted">No schools assigned to your account.</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
