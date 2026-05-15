import { useEffect, useRef, useState } from 'react'

/** Visit KPI aggregates are typically on a 0–5 scale in this product. */
export function kpiAggregateToPercent(score: number | null | undefined): number | null {
  if (score == null || Number.isNaN(Number(score))) return null
  const n = Number(score)
  if (n <= 5) return Math.min(100, Math.round(n * 20))
  return Math.min(100, Math.round(n))
}

function ringColor(pct: number): string {
  if (pct >= 72) return '#059669'
  if (pct >= 55) return '#2563eb'
  if (pct >= 38) return '#d97706'
  return '#dc2626'
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const fn = () => setReduced(mq.matches)
    fn()
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return reduced
}

export type ScoreGaugeCardDef = {
  key: string
  label: string
  hint: string
  /** 0–100 ring fill; null = neutral track only (no colored arc). */
  ringProgress: number | null
  /** Center value: number animates from 0; string shows when animation completes (or immediately if reduced motion). */
  displayValue: number | string
  /**
   * Text under the center value. `undefined`: show " / 100" when numeric and ringProgress is set.
   * `null`: never. string: literal (e.g. " pupils").
   */
  centerSuffix?: string | null
}

function ScoreGaugeCard({
  label,
  hint,
  ringProgress,
  displayValue,
  centerSuffix,
  run,
}: ScoreGaugeCardDef & { run: boolean }) {
  const reduced = usePrefersReducedMotion()
  const [t, setT] = useState(0)
  const raf = useRef<number>(0)
  const isNumeric = typeof displayValue === 'number'
  const targetNum = isNumeric ? displayValue : 0

  const duration = reduced ? 0 : 1100

  useEffect(() => {
    if (!run) return
    if (reduced) {
      setT(1)
      return
    }
    setT(0)
    const start = performance.now()
    const ease = (x: number) => 1 - (1 - x) ** 3
    const loop = (now: number) => {
      const u = Math.min(1, (now - start) / duration)
      setT(ease(u))
      if (u < 1) raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
  }, [run, reduced, duration, displayValue, ringProgress, centerSuffix])

  const size = 112
  const stroke = 7
  const r = (size - stroke) / 2 - 2
  const c = 2 * Math.PI * r
  const pct = ringProgress == null ? 0 : Math.min(100, Math.max(0, ringProgress))
  const arcLen = (pct / 100) * t * c
  const offset = c - arcLen
  const strokeColor = ringProgress == null ? '#94a3b8' : ringColor(pct)

  const centerText = isNumeric ? String(Math.round(targetNum * t)) : String(displayValue)

  const suffix =
    centerSuffix === undefined
      ? isNumeric && ringProgress != null
        ? '/ 100'
        : null
      : centerSuffix === null || centerSuffix === ''
        ? null
        : centerSuffix

  return (
    <article
      className="flex min-w-[10.5rem] flex-1 flex-col items-center rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-5 shadow-[0_2px_12px_rgb(15_23_42/0.06)]"
      style={{ borderRadius: 'var(--radius-card, 1.25rem)' }}
    >
      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={0}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={strokeColor}
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={ringProgress == null ? c : offset}
            strokeLinecap="round"
            className={ringProgress == null ? 'opacity-35' : ''}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="max-w-[5.5rem] truncate text-xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-2xl">
            {centerText}
          </span>
          {suffix ? (
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{suffix}</span>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">{label}</p>
      <p className="mt-1.5 text-center text-[12px] leading-snug text-slate-500">{hint}</p>
    </article>
  )
}

export function ScoreGaugeStrip({ cards, animateKey }: { cards: ScoreGaugeCardDef[]; animateKey: string }) {
  const run = Boolean(animateKey)

  if (cards.length === 0) return null

  return (
    <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-min gap-4">
        {cards.map((c) => {
          const { key, ...rest } = c
          return <ScoreGaugeCard key={key} {...rest} run={run} />
        })}
      </div>
    </div>
  )
}

/** Reference-style frame: dark location bar + light canvas for the gauge row. */
export function DashboardGaugeBoard({
  location,
  contextLine,
  cards,
  animateKey,
}: {
  location: string
  contextLine: string
  cards: ScoreGaugeCardDef[]
  animateKey: string
}) {
  if (cards.length === 0) return null

  return (
    <div
      className="animate-premium-in overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-50/80 shadow-[0_8px_30px_rgb(15_23_42/0.06)]"
      style={{ borderRadius: 'var(--radius-card, 1.25rem)' }}
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 px-6 py-3.5 text-[13px] text-white">
        <span className="inline-flex items-center gap-2 font-medium tracking-tight">
          <span className="text-rose-400" aria-hidden>
            ●
          </span>
          {location}
        </span>
        <span className="inline-flex items-center gap-2 text-white/88">
          <span className="opacity-70" aria-hidden>
            ▣
          </span>
          {contextLine}
        </span>
      </div>
      <div className="border-t border-slate-200/70 bg-gradient-to-b from-white to-slate-50/90 px-5 py-6 sm:px-7">
        <ScoreGaugeStrip cards={cards} animateKey={animateKey} />
      </div>
    </div>
  )
}
