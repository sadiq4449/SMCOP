import { roleLabels } from '../config/navigation'
import { useAuth } from '../context/AuthContext'

const placeholderCards = [
  { title: 'Monitoring', description: 'Quarterly visit and KPI workflows will appear here.' },
  { title: 'Reports', description: 'Approval queues and exports will be added in later iterations.' },
  { title: 'Attendance', description: 'Teacher and student attendance summaries will live here.' },
]

export function DashboardPage() {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Dashboard</p>
        <h1 className="mt-2 text-2xl font-semibold text-text-primary">
          {roleLabels[user.role]} workspace
        </h1>
        <p className="mt-2 max-w-2xl text-text-secondary">
          Iteration 01 provides the authenticated shell only. Module pages linked in the sidebar are
          placeholders until later delivery iterations.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {placeholderCards.map((card) => (
          <article
            key={card.title}
            className="rounded-2xl border border-muted-surface bg-surface p-5 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-text-primary">{card.title}</h2>
            <p className="mt-2 text-sm text-text-secondary">{card.description}</p>
            <span className="mt-4 inline-flex rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-primary">
              Coming soon
            </span>
          </article>
        ))}
      </section>
    </div>
  )
}
