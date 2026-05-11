import { Outlet } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const { user, logout } = useAuth()

  if (!user) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-section">
      <Sidebar user={user} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header user={user} onLogout={logout} />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
