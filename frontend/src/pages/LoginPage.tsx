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
      <div className="w-full max-w-md rounded-ref-lg border border-white/10 bg-surface/90 p-8 shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">SMOCP Portal</p>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">Sign in to continue</h1>
          <p className="mt-2 text-sm text-text-muted">
            Government ERP access for school monitoring and reporting.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-text-secondary">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl px-3 py-2.5 outline-none ring-primary/30 focus:ring-2"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-text-secondary">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl px-3 py-2.5 outline-none ring-primary/30 focus:ring-2"
              required
            />
          </label>

          {error ? (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-gradient-to-br from-primary to-secondary px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(91,140,255,0.26)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-text-secondary">
          <Link to="/forgot-password" className="text-accent hover:text-primary hover:underline">
            Forgot password?
          </Link>
        </p>

        <div className="mt-6 rounded-xl border border-white/10 bg-surface-deep/40 p-4 text-sm text-text-muted">
          Demo users are seeded for each role. Example: <span className="text-text-secondary">superadmin@example.com</span> / <span className="text-text-secondary">Password123!</span>
        </div>
      </div>
    </div>
  )
}
