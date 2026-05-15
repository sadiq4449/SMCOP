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
      <div className="w-full max-w-md rounded-ref-lg border border-white/10 bg-surface/90 p-8 shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur-md">
        <h1 className="text-xl font-semibold text-text-primary">Choose a new password</h1>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-text-secondary">New password</span>
            <input
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded-xl px-3 py-2.5"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
            />
          </label>
          {msg ? <p className="text-sm text-success">{msg}</p> : null}
          {err ? <p className="text-sm text-danger">{err}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-br from-primary to-secondary py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(91,140,255,0.26)] hover:opacity-95 disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-accent hover:text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
