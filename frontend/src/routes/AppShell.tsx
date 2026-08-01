import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/auth-context'

export function AppShell() {
  const { user, logout } = useAuth()

  return (
    <div className="application-shell">
      <header className="app-header">
        <Link className="brand brand-dark" to="/app">
          <span className="brand-mark" aria-hidden="true">
            T
          </span>
          <span>Taskly</span>
        </Link>
        <div className="user-actions">
          <div className="user-summary">
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
          </div>
          <button className="secondary-button" type="button" onClick={logout}>
            Sair
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}