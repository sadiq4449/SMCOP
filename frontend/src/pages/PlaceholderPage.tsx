interface PlaceholderPageProps {
  title: string
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <section className="rounded-2xl border border-dashed border-secondary/40 bg-surface p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
      <p className="mt-2 text-text-secondary">
        This module is reserved for a later iteration. Navigation is wired for the current role.
      </p>
    </section>
  )
}
