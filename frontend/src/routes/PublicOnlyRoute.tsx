import { Navigate, Outlet } from 'react-router-dom'
import { LoadingScreen } from '../components/LoadingScreen'
import { useAuth } from '../features/auth/auth-context'

export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  return isAuthenticated ? <Navigate to="/app" replace /> : <Outlet />
}