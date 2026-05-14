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
    <div className="flex min-h-screen items-center justify-center bg-section px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-muted-surface bg-surface p-8 shadow-lg">
        <h1 className="text-xl font-semibold text-text-primary">Reset password</h1>
        <p className="mt-2 text-sm text-text-muted">Enter your email. If an account exists, we will send a reset link when email is configured.</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-text-secondary">Email</span>
            <input
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-muted-surface px-3 py-2 text-text-primary"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
            />
          </label>
          {msg ? <p className="text-sm text-[var(--color-success)]">{msg}</p> : null}
          {err ? <p className="text-sm text-danger">{err}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-70"
          >
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-secondary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
