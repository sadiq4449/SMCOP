import { useCallback, useEffect, useRef, useState } from 'react'

import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from '../../services/operationalApi'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const refreshCount = useCallback(async () => {
    try {
      const n = await getUnreadNotificationCount()
      setCount(n)
    } catch {
      /* ignore */
    }
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const data = await listNotifications({ limit: 25 })
      setItems(data.items)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshCount()
    const t = window.setInterval(() => void refreshCount(), 60000)
    return () => window.clearInterval(t)
  }, [refreshCount])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  useEffect(() => {
    if (open) void loadList()
  }, [open, loadList])

  const onToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setOpen((v) => !v)
  }

  const onReadOne = async (id: string) => {
    try {
      await markNotificationRead(id)
      await refreshCount()
      await loadList()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Failed')
    }
  }

  const onReadAll = async () => {
    try {
      await markAllNotificationsRead()
      await refreshCount()
      await loadList()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Failed')
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={onToggle}
        className="relative rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-medium text-text-primary shadow-sm backdrop-blur-sm hover:bg-white/10"
        aria-expanded={open}
        aria-label="Notifications"
      >
        Alerts
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs font-semibold text-white">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-surface/95 py-1 shadow-[0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-muted-surface px-3 py-2">
            <p className="text-sm font-semibold text-text-primary">Notifications</p>
            <button type="button" className="text-xs text-secondary hover:underline" onClick={() => void onReadAll()}>
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? <p className="p-3 text-sm text-text-muted">Loading…</p> : null}
            {err ? <p className="p-3 text-sm text-danger">{err}</p> : null}
            {!loading && items.length === 0 ? (
              <p className="p-3 text-sm text-text-muted">No notifications yet.</p>
            ) : null}
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => (n.is_read ? undefined : void onReadOne(n.id))}
                className={`block w-full border-b border-white/5 px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.06] ${
                  n.is_read ? 'text-text-muted' : 'bg-section/50 text-text-primary'
                }`}
              >
                <span className="font-medium">{n.title}</span>
                <span className="mt-0.5 block text-xs text-text-secondary">{n.message}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
