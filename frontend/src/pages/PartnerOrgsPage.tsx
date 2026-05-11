import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '../context/AuthContext'
import type { PartnerOrg } from '../types/school'
import {
  createPartnerOrg,
  deletePartnerOrg,
  getPartnerOrgs,
  updatePartnerOrg,
} from '../services/schoolsApi'

export function PartnerOrgsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<PartnerOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const refresh = () =>
    getPartnerOrgs()
      .then(setItems)
      .catch(() => setError('Failed to load partner organizations'))

  useEffect(() => {
    if (user?.role !== 'super_admin') return
    setLoading(true)
    void refresh().finally(() => setLoading(false))
  }, [user?.role])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await createPartnerOrg({
        name: name.trim(),
        contact_person: contactPerson.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
      })
      setName('')
      setContactPerson('')
      setEmail('')
      setPhone('')
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Create failed')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this partner organization? Schools will unlink.')) return
    try {
      await deletePartnerOrg(id)
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handleRename = async (org: PartnerOrg) => {
    const next = window.prompt('Partner organization name', org.name)
    if (!next || next === org.name) return
    try {
      await updatePartnerOrg(org.id, { name: next.trim() })
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed')
    }
  }

  if (user?.role !== 'super_admin') {
    return (
      <section className="rounded-2xl border border-muted-surface bg-surface p-6">
        <p className="text-text-secondary">Partner organizations are managed by Super Admin only.</p>
      </section>
    )
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Master data</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Partner organizations</h1>
        <p className="mt-1 text-sm text-text-muted">PPP nodes and adopting organizations linked to schools.</p>
      </header>

      <section className="rounded-2xl border border-muted-surface bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-text-primary">Add partner</h2>
        <form onSubmit={handleCreate} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-text-secondary">Name</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Contact person</span>
            <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-text-secondary">Phone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </label>
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary md:col-span-2">
            Create partner org
          </button>
        </form>
      </section>

      {error ? <p className="text-danger">{error}</p> : null}

      <section className="overflow-hidden rounded-2xl border border-muted-surface bg-surface shadow-sm">
        <div className="border-b border-muted-surface px-4 py-3 text-sm text-text-muted">
          {loading ? 'Loading…' : `${items.length} organizations`}
        </div>
        <ul className="divide-y divide-muted-surface">
          {items.map((org) => (
            <li key={org.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div>
                <p className="font-semibold text-text-primary">{org.name}</p>
                <p className="text-sm text-text-muted">
                  {[org.contact_person, org.email, org.phone].filter(Boolean).join(' · ') || 'No contact details'}
                </p>
              </div>
              <div className="flex gap-3 text-sm">
                <button type="button" onClick={() => void handleRename(org)} className="font-medium text-secondary hover:text-primary">
                  Rename
                </button>
                <button type="button" onClick={() => void handleDelete(org.id)} className="font-medium text-danger hover:underline">
                  Delete
                </button>
              </div>
            </li>
          ))}
          {!loading && items.length === 0 ? (
            <li className="px-4 py-8 text-center text-text-muted">No partner organizations yet.</li>
          ) : null}
        </ul>
      </section>
    </div>
  )
}
