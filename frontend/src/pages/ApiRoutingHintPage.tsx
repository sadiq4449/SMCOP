/**
 * Shown when the browser loads the SPA for a URL that should be served by the FastAPI app on Vercel
 * (rewrites/cache/dashboard overrides). Stops the catch-all route from sending users to /login.
 */
export function ApiRoutingHintPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-section px-6 py-12 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-secondary">SMOCP Portal</p>
      <h1 className="mt-3 max-w-lg text-xl font-semibold text-text-primary">This URL should hit the API, not the web app</h1>
      <p className="mt-4 max-w-xl text-sm text-text-muted">
        Vercel returned the React bundle for an API path (for example <code className="text-text-secondary">/health/db</code>
        ). The client router used to send you to the login screen; you are seeing this page instead.
      </p>
      <p className="mt-4 max-w-xl text-sm text-text-muted">
        Production builds call the API at <code className="text-text-secondary">/svc/v1</code> (Vercel reserves{' '}
        <code className="text-text-secondary">/api/*</code> for function filesystem routing). If you still see this page for{' '}
        <code className="text-text-secondary">/health/db</code>, rewrites may be off or CDN cache stale — redeploy without cache.
        Set <code className="text-text-secondary">API_V1_PREFIX</code> on the server if you use a custom prefix.{' '}
        <code className="text-text-secondary">GET /health/db</code> must return JSON when routing is correct.
      </p>
      <p className="mt-4 max-w-xl text-xs text-text-muted">Details: <code className="text-text-secondary">supabase/README.txt</code> (Vercel section).</p>
    </div>
  )
}
