import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { resetPassword } from '../services/operationalApi'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    if (!token) {
      setErr('Missing token in URL.')
      return
    }
    setBusy(true)
    try {
      const m = await resetPassword(token, password)
      setMsg(m)
      window.setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div
        className="w-full max-w-md border border-slate-200/90 bg-white/90 p-10 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_24px_56px_rgb(15_23_42/0.08)] backdrop-blur-xl"
        style={{ borderRadius: 'var(--radius-card-lg, 1.75rem)' }}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">New password</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">Choose a strong password for your account.</p>
        <form className="mt-8 space-y-5" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">Password</span>
            <input
              type="password"
              required
              minLength={8}
              className="w-full !py-3"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
            />
          </label>
          {msg ? <p className="text-sm text-success">{msg}</p> : null}
          {err ? <p className="text-sm text-danger">{err}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-primary py-3 text-[15px] font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </form>
        <p className="mt-8 text-center text-sm">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
