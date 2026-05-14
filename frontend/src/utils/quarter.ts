/** Normalize user-typed quarters (e.g. "Q2 2026", "q2-2026") to the canonical "Q2-2026" form used in the API. */
export function normalizeQuarterInput(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  const m = t.match(/^([qQ]\d)\s*[-]?\s*(\d{4})$/i)
  if (m) return `${m[1].toUpperCase()}-${m[2]}`
  return t
}
