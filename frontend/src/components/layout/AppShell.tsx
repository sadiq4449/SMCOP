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
    <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Sidebar user={user} />
      <div className="flex min-h-[calc(100vh-4rem)] min-w-0 flex-1 flex-col gap-6">
        <Header user={user} onLogout={logout} />
        <main className="flex-1 pb-12">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
