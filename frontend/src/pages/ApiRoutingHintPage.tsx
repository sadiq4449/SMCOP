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
        Fix deployment: Vercel → Settings → Build &amp; Development → disable dashboard overrides for Framework / Build /
        Output; use dashboard Framework preset <strong className="text-text-primary">Other</strong> (no auto-detect), or keep{' '}
        <code className="text-text-secondary">vercel.json</code> with <code className="text-text-secondary">&quot;framework&quot;: null</code> — do{' '}
        <strong className="text-text-primary">not</strong> use the string <code className="text-text-secondary">&quot;other&quot;</code> (Vercel rejects it). Then root{' '}
        <code className="text-text-secondary">vercel.json</code> rewrites run; root directory = repo root. Redeploy, then
        purge cache (Deployments → … → Redeploy without cache, or Vercel cache purge).{' '}
        <code className="text-text-secondary">GET /health/db</code> must return JSON.
      </p>
      <p className="mt-4 max-w-xl text-xs text-text-muted">Details: <code className="text-text-secondary">supabase/README.txt</code> (Vercel section).</p>
    </div>
  )
}
