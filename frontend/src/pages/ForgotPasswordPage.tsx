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
      <div className="w-full max-w-md rounded-ref-lg border border-white/10 bg-surface/90 p-8 shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur-md">
        <h1 className="text-xl font-semibold text-text-primary">Reset password</h1>
        <p className="mt-2 text-sm text-text-muted">Enter your email. If an account exists, we will send a reset link when email is configured.</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-text-secondary">Email</span>
            <input
              type="email"
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
            />
          </label>
          {msg ? <p className="text-sm text-success">{msg}</p> : null}
          {err ? <p className="text-sm text-danger">{err}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-br from-primary to-secondary py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(91,140,255,0.26)] hover:opacity-95 disabled:opacity-60"
          >
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-accent hover:text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
