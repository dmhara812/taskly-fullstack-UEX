import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './features/auth/pages/LoginPage'
import { RegisterPage } from './features/auth/pages/RegisterPage'
import { AppShell } from './routes/AppShell'
import { DashboardPage } from './routes/DashboardPage'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { PublicOnlyRoute } from './routes/PublicOnlyRoute'

export function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}