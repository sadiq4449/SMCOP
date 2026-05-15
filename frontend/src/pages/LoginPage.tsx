import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth()
  const [email, setEmail] = useState('superadmin@example.com')
  const [password, setPassword] = useState('Password123!')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await login(email, password)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div
        className="w-full max-w-md border border-slate-200/90 bg-white/90 p-10 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_24px_56px_rgb(15_23_42/0.08)] backdrop-blur-xl"
        style={{ borderRadius: 'var(--radius-card-lg, 1.75rem)' }}
      >
        <div className="mb-10 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">SMOCP Portal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">Sign in</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
            Secure access to national school monitoring and reporting.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full !py-3"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full !py-3"
              required
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-rose-200/80 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-primary px-4 py-3 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgb(51_78_104/0.2)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Signing in…' : 'Continue'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-text-secondary">
          <Link to="/forgot-password" className="font-medium text-primary/90 hover:text-primary hover:underline">
            Forgot password?
          </Link>
        </p>

        <div className="mt-8 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 text-center text-[13px] leading-relaxed text-text-muted">
          Demo: <span className="font-mono text-text-secondary">superadmin@example.com</span> /{' '}
          <span className="font-mono text-text-secondary">Password123!</span>
        </div>
      </div>
    </div>
  )
}
