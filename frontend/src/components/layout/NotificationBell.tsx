import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from '../../services/operationalApi'

function isReadRow(n: NotificationRow): boolean {
  const v = n.is_read as unknown
  return v === true || v === 'true' || v === 1
}

function routeForNotification(n: NotificationRow): string | null {
  const ref = (n.ref_id ?? '').trim()
  const rt = (n.ref_type ?? '').trim()

  if (rt === 'visit' && ref) {
    return `/dashboard/monitoring/${encodeURIComponent(ref)}`
  }
  if (rt === 'report') {
    return '/dashboard/reports'
  }
  if (rt === 'issue') {
    return '/dashboard/issues'
  }
  if (rt === 'task') {
    return '/dashboard/issues'
  }
  return null
}

export function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})

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

  const updatePanelPosition = useCallback(() => {
    if (!open || !anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    const w = Math.min(384, window.innerWidth - 32)
    setPanelStyle({
      position: 'fixed',
      top: r.bottom + 8,
      right: Math.max(16, window.innerWidth - r.right),
      width: w,
      zIndex: 200,
    })
  }, [open])

  useLayoutEffect(() => {
    updatePanelPosition()
  }, [open, updatePanelPosition])

  useEffect(() => {
    if (!open) return
    const onResize = () => updatePanelPosition()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open, updatePanelPosition])

  useEffect(() => {
    const tid = window.setTimeout(() => void refreshCount(), 500)
    const t = window.setInterval(() => void refreshCount(), 60000)
    return () => {
      window.clearTimeout(tid)
      window.clearInterval(t)
    }
  }, [refreshCount])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
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
    await markNotificationRead(id)
    await refreshCount()
    await loadList()
  }

  const onReadAll = async () => {
    setErr(null)
    try {
      await markAllNotificationsRead()
      await refreshCount()
      await loadList()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Failed to mark all read')
    }
  }

  const handleRowActivate = async (n: NotificationRow) => {
    setErr(null)
    try {
      if (!isReadRow(n)) {
        await onReadOne(n.id)
      }
      const path = routeForNotification(n)
      if (path) {
        navigate(path)
        setOpen(false)
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Failed')
    }
  }

  const dropdown =
    open &&
    createPortal(
      <div
        ref={panelRef}
        style={panelStyle}
        className="overflow-hidden rounded-xl border border-slate-200/90 bg-white/98 py-1 shadow-[0_12px_48px_rgb(15_23_42/0.18)] backdrop-blur-xl"
        role="dialog"
        aria-label="Notifications list"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
          <div>
            <p className="text-[13px] font-semibold text-text-primary">Notifications</p>
            {count > 0 ? (
              <p className="text-[11px] text-text-muted">
                {count} unread · list shows recent (read and unread)
              </p>
            ) : (
              <p className="text-[11px] text-text-muted">No unread · recent activity below</p>
            )}
          </div>
          <button
            type="button"
            className="text-[11px] font-medium text-text-muted transition-colors hover:text-text-primary"
            onClick={(e) => {
              e.stopPropagation()
              void onReadAll()
            }}
          >
            Mark all read
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? <p className="p-3 text-sm text-text-muted">Loading…</p> : null}
          {err ? <p className="p-3 text-sm text-danger">{err}</p> : null}
          {!loading && items.length === 0 ? (
            <p className="p-3 text-sm text-text-muted">No notifications yet.</p>
          ) : null}
          {items.map((n) => {
            const read = isReadRow(n)
            const hasLink = Boolean(routeForNotification(n))
            return (
              <button
                key={n.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  void handleRowActivate(n)
                }}
                className={`block w-full border-b border-slate-100 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 ${
                  read ? 'text-text-muted' : 'bg-sky-50/80 text-text-primary'
                }`}
              >
                <span className="font-medium">{n.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-text-secondary">{n.message}</span>
                {hasLink ? (
                  <span className="mt-1 block text-[11px] font-medium text-secondary">Open related page</span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>,
      document.body,
    )

  return (
    <div className="relative">
      <button
        ref={anchorRef}
        type="button"
        onClick={onToggle}
        className="relative rounded-xl border border-slate-200/90 bg-white/90 px-3.5 py-2 text-[13px] font-medium text-text-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.95)] transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Notifications"
      >
        Alerts
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-semibold text-white shadow-sm">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>
      {dropdown}
    </div>
  )
}
