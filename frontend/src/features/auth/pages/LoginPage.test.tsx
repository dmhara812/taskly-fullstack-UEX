import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../AuthProvider'
import { LoginPage } from './LoginPage'

function renderLoginPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app" element={<h1>Projetos</h1>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  it('shows validation messages before sending invalid data', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch')

    renderLoginPage()

    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'email-invalido' },
    })

    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: '123' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(
      await screen.findByText('Informe um e-mail válido.'),
    ).toBeVisible()

    expect(
      await screen.findByText('A senha deve ter pelo menos 8 caracteres.'),
    ).toBeVisible()

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('stores the session and navigates after a valid login', async () => {
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            token_type: 'bearer',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
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
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )

    renderLoginPage()

    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'ana@example.com' },
    })

    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'StrongPassword123' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(
      await screen.findByRole(
        'heading',
        { name: 'Projetos' },
        { timeout: 10_000 },
      ),
    ).toBeVisible()

    expect(fetchSpy).toHaveBeenCalledTimes(2)

    expect(
      window.localStorage.getItem('taskly.auth.tokens'),
    ).toContain('refresh-token')
  })
})