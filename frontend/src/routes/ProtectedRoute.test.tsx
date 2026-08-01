import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../features/auth/AuthProvider'
import { writeAuthTokens } from '../lib/auth-storage'
import { ProtectedRoute } from './ProtectedRoute'

function renderProtectedRoute() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app']}>
        <AuthProvider>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/app" element={<h1>Área privada</h1>} />
            </Route>
            <Route path="/login" element={<h1>Entrar</h1>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('redirects anonymous users to login', async () => {
    renderProtectedRoute()

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeVisible()
  })

  it('renders protected content after validating the session', async () => {
    writeAuthTokens({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })
    vi.spyOn(window, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {
            id: '38cc5ffb-e0b0-47e4-b6e2-941fab3ce298',
            name: 'Ana Silva',
            email: 'ana@example.com',
            is_active: true,
            created_at: '2026-07-31T12:00:00Z',
            updated_at: '2026-07-31T12:00:00Z',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    renderProtectedRoute()

    expect(
      await screen.findByRole('heading', { name: 'Área privada' }),
    ).toBeVisible()
  })
})