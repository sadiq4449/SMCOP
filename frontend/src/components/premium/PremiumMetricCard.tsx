import type { ReactNode } from 'react'

const toneAccent: Record<'neutral' | 'success' | 'warning' | 'danger', string> = {
  neutral: 'from-slate-400/90 to-slate-500/70',
  success: 'from-emerald-500/80 to-emerald-600/60',
  warning: 'from-amber-500/70 to-amber-600/50',
  danger: 'from-rose-500/70 to-rose-600/50',
}

export function PremiumMetricCard({
  label,
  value,
  hint,
  tone = 'neutral',
  progress,
  iconLetter,
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
  progress?: number | null
  iconLetter?: string
}) {
  const fill =
    tone === 'success'
      ? 'bg-emerald-500/55'
      : tone === 'warning'
        ? 'bg-amber-500/50'
        : tone === 'danger'
          ? 'bg-rose-500/50'
          : 'bg-slate-400/70'

  const p = progress == null || Number.isNaN(Number(progress)) ? null : Math.min(100, Math.max(0, Number(progress)))

  return (
    <article
      className="group relative overflow-hidden border border-slate-200/70 bg-white/85 p-6 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_8px_32px_rgb(15_23_42/0.06)] backdrop-blur-xl transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgb(15_23_42/0.04),0_16px_48px_rgb(15_23_42/0.08)]"
      style={{ borderRadius: 'var(--radius-card, 1.25rem)' }}
    >
      <div
        className={`pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-gradient-to-br opacity-[0.07] blur-2xl transition-opacity duration-500 group-hover:opacity-[0.12] ${toneAccent[tone]}`}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{label}</p>
          <p className="mt-3 font-semibold tracking-tight text-text-primary tabular-nums" style={{ fontSize: '1.875rem', lineHeight: 1.1 }}>
            {value}
          </p>
          {hint ? <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{hint}</p> : null}
        </div>
        {iconLetter ? (
          <div
            className="grid size-11 shrink-0 place-items-center rounded-2xl border border-slate-200/80 bg-white/80 text-sm font-semibold text-text-secondary shadow-[inset_0_1px_0_rgb(255_255_255/0.9)] backdrop-blur-sm transition-shadow duration-300 group-hover:shadow-[0_0_28px_rgb(15_23_42/0.06)]"
            aria-hidden
          >
            {iconLetter}
          </div>
        ) : null}
      </div>
      {p != null ? (
        <div className="relative mt-5 h-1 overflow-hidden rounded-full bg-slate-200/90">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ease-out ${fill}`}
            style={{ width: `${p}%` }}
          />
        </div>
      ) : (
        <div className="mt-5 h-px bg-gradient-to-r from-transparent via-slate-200/80 to-transparent" aria-hidden />
      )}
    </article>
  )
}

export function PremiumPanel({
  children,
  className = '',
  noPadding,
}: {
  children: ReactNode
  className?: string
  noPadding?: boolean
}) {
  return (
    <section
      className={`border border-slate-200/70 bg-white/80 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_8px_32px_rgb(15_23_42/0.05)] backdrop-blur-xl transition-shadow duration-300 hover:shadow-[0_1px_2px_rgb(15_23_42/0.04),0_12px_40px_rgb(15_23_42/0.07)] ${noPadding ? '' : 'p-8'} ${className}`}
      style={{ borderRadius: 'var(--radius-card-lg, 1.75rem)' }}
    >
      {children}
    </section>
  )
}

export function PremiumEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">{children}</p>
  )
}
