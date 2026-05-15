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
    <div className="flex min-h-screen gap-5 p-5">
      <Sidebar user={user} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col gap-5">
        <Header user={user} onLogout={logout} />
        <main className="flex-1 px-1 pb-8 pt-1 md:px-2">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
