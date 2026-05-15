import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/api'
import { listVisits } from '../services/visitsApi'
import type { VisitSummary } from '../types/visit'

function monthStrFromDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function isoDay(y: number, monthIndex0: number, day: number) {
  const m = String(monthIndex0 + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function todayIso() {
  const n = new Date()
  return isoDay(n.getFullYear(), n.getMonth(), n.getDate())
}

/** HH:MM for <input type="time" /> from API time string */
function timeInput(iso: string | null | undefined) {
  if (!iso) return ''
  return iso.length >= 5 ? iso.slice(0, 5) : iso
}

export function VisitCalendarPage() {
  const { user } = useAuth()
  const [cursor, setCursor] = useState(() => new Date())
  const monthLabel = monthStrFromDate(cursor)
  const [scheduledRows, setScheduledRows] = useState<VisitSummary[]>([])
  const [unscheduledRows, setUnscheduledRows] = useState<VisitSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const allowed =
    user && (user.role === 'ie' || user.role === 'government' || user.role === 'partner' || user.role === 'super_admin')

  useEffect(() => {
    if (!allowed) return
    setLoading(true)
    setError(null)
    void Promise.all([
      listVisits({ scheduled_month: monthLabel, limit: 100 }),
      listVisits({ unscheduled: true, limit: 80 }),
    ])
      .then(([s, u]) => {
        setScheduledRows(s.items)
        setUnscheduledRows(u.items)
      })
      .catch((e: unknown) => setError(getApiErrorMessage(e, 'Failed to load visits')))
      .finally(() => setLoading(false))
  }, [allowed, monthLabel])

  const byDay = useMemo(() => {
    const m = new Map<string, VisitSummary[]>()
    for (const v of scheduledRows) {
      const d = v.scheduled_date
      if (!d) continue
      const arr = m.get(d) ?? []
      arr.push(v)
      m.set(d, arr)
    }
    return m
  }, [scheduledRows])

  const calendarCells = useMemo(() => {
    const y = cursor.getFullYear()
    const mo = cursor.getMonth()
    const first = new Date(y, mo, 1)
    const lastDay = new Date(y, mo + 1, 0).getDate()
    const startWeekdayMon0 = (first.getDay() + 6) % 7
    const cells: { day: number | null; iso: string | null }[] = []
    for (let i = 0; i < startWeekdayMon0; i++) cells.push({ day: null, iso: null })
    for (let d = 1; d <= lastDay; d++) cells.push({ day: d, iso: isoDay(y, mo, d) })
    return cells
  }, [cursor])

  const shiftMonth = (delta: number) => {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }

  if (!user || !allowed) {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">Visit calendar is available for PPP Node, partners, IE, and Super Admin.</p>
      </section>
    )
  }

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Scheduling</p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">Visit calendar</h1>
          <p className="mt-1 text-sm text-text-muted">
            Planned inspection dates set by IE appear here; open a cell to complete the monitoring visit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-lg border border-muted-surface px-3 py-1.5 text-sm font-medium hover:bg-muted-surface/40"
          >
            ← Prev
          </button>
          <span className="min-w-[9rem] text-center font-semibold text-text-primary">{monthLabel}</span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-lg border border-muted-surface px-3 py-1.5 text-sm font-medium hover:bg-muted-surface/40"
          >
            Next →
          </button>
          <Link
            to="/dashboard/monitoring"
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-secondary"
          >
            Visit list
          </Link>
        </div>
      </header>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-muted-surface bg-surface shadow-sm">
        <div className="border-b border-muted-surface px-4 py-3 text-sm text-text-muted">
          {loading ? 'Loading…' : `${scheduledRows.length} scheduled · ${unscheduledRows.length} unscheduled drafts`}
        </div>
        <div className="grid grid-cols-7 gap-px bg-muted-surface p-px text-xs md:text-sm">
          {weekdays.map((w) => (
            <div key={w} className="bg-section px-2 py-2 text-center font-semibold text-text-muted">
              {w}
            </div>
          ))}
          {calendarCells.map((cell, idx) => {
            const iso = cell.iso
            if (!iso) {
              return <div key={`e-${idx}`} className="min-h-[88px] bg-section/40" />
            }
            const visits = byDay.get(iso) ?? []
            const today = todayIso()
            const isPast = iso < today
            const hasOverdueDraft = visits.some((v) => v.status === 'draft' && iso < today)
            return (
              <div
                key={iso}
                className={`min-h-[88px] bg-surface p-2 ${isPast ? 'opacity-90' : ''} ${hasOverdueDraft ? 'ring-1 ring-amber-400/80' : ''}`}
              >
                <div className="mb-1 flex justify-between gap-1">
                  <span className="font-mono font-semibold text-text-primary">{cell.day}</span>
                </div>
                <ul className="space-y-1">
                  {visits.map((v) => (
                    <li key={v.id}>
                      <Link
                        to={`/dashboard/monitoring/${v.id}`}
                        className="block truncate rounded bg-secondary/10 px-1 py-0.5 text-[11px] font-medium text-secondary hover:bg-secondary/20 md:text-xs"
                        title={v.school_name ?? v.school_id}
                      >
                        {v.school_name ?? 'School'}{' '}
                        <span className="font-mono text-text-muted">({v.quarter})</span>
                      </Link>
                      {v.scheduled_time_start || v.scheduled_time_end ? (
                        <p className="truncate font-mono text-[10px] text-text-muted">
                          {timeInput(v.scheduled_time_start) || '—'}–{timeInput(v.scheduled_time_end) || '—'}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Draft visits without a planned date</h2>
        <p className="text-sm text-text-muted">
          Set a planned inspection date and optional time window from the visit form so they appear on the calendar above.
        </p>
        {unscheduledRows.length === 0 ? (
          <p className="text-sm text-text-muted">None in your scope.</p>
        ) : (
          <ul className="divide-y divide-muted-surface rounded-lg border border-muted-surface">
            {unscheduledRows.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div>
                  <p className="font-medium text-text-primary">{v.school_name ?? 'School'}</p>
                  <p className="font-mono text-xs text-text-muted">
                    {v.quarter} · {v.status}
                  </p>
                </div>
                <Link
                  to={`/dashboard/monitoring/${v.id}`}
                  className="text-sm font-semibold text-secondary hover:text-primary"
                >
                  Open visit →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
