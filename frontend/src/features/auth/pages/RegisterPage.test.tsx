import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../AuthProvider'
import { RegisterPage } from './RegisterPage'

function renderRegisterPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/app" element={<h1>Projetos</h1>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('RegisterPage', () => {
  it('rejects different passwords without sending a request', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch')
    renderRegisterPage()

    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Ana Silva' },
    })
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'ana@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'StrongPassword123' },
    })
    fireEvent.change(screen.getByLabelText('Confirmar senha'), {
      target: { value: 'DifferentPassword123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(
      await screen.findByText('As senhas precisam ser iguais.'),
    ).toBeVisible()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('registers, authenticates and opens the protected application', async () => {
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'user-1',
            name: 'Ana Silva',
            email: 'ana@example.com',
            is_active: true,
            created_at: '2026-08-01T12:00:00Z',
            updated_at: '2026-08-01T12:00:00Z',
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            token_type: 'bearer',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: {
              id: 'user-1',
              name: 'Ana Silva',
              email: 'ana@example.com',
              is_active: true,
              created_at: '2026-08-01T12:00:00Z',
              updated_at: '2026-08-01T12:00:00Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )

    renderRegisterPage()

    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Ana Silva' },
    })
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'ana@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'StrongPassword123' },
    })
    fireEvent.change(screen.getByLabelText('Confirmar senha'), {
      target: { value: 'StrongPassword123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(
      await screen.findByRole('heading', { name: 'Projetos' }),
    ).toBeVisible()
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(window.localStorage.getItem('taskly.auth.tokens')).toContain(
      'refresh-token',
    )
  })
})