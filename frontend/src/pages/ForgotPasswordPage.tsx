import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { forgotPassword } from '../services/operationalApi'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    setBusy(true)
    try {
      const m = await forgotPassword(email.trim())
      setMsg(m)
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
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Reset password</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
          Enter your email. If an account exists, we will send a reset link when email is configured.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Email</span>
            <input
              type="email"
              required
              className="mt-1.5 w-full !py-3"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
            />
          </label>
          {msg ? <p className="text-sm text-success">{msg}</p> : null}
          {err ? <p className="text-sm text-danger">{err}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-xl bg-primary py-3 text-[15px] font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
