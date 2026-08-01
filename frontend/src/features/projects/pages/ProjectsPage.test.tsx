import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../../auth/auth-context'
import { ProjectsPage } from './ProjectsPage'

const authValue: AuthContextValue = {
  user: {
    id: 'user-1',
    name: 'Ana Silva',
    email: 'ana@example.com',
    is_active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderProjectsPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/app']}>
          <Routes>
            <Route path="/app" element={<ProjectsPage />} />
            <Route path="/app/projects/:projectId" element={<h1>Projeto aberto</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('ProjectsPage', () => {
  it('renders projects returned by the API', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: 'project-1',
            owner_id: 'user-1',
            name: 'Portal do cliente',
            description: 'Nova área autenticada para clientes.',
            status: 'active',
            created_at: '2026-08-01T00:00:00Z',
            updated_at: '2026-08-01T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        size: 9,
        pages: 1,
      }),
    )

    renderProjectsPage()

    expect(await screen.findByText('Portal do cliente')).toBeVisible()
    expect(screen.getByText('Nova área autenticada para clientes.')).toBeVisible()
    expect(screen.getByRole('link', { name: /Abrir projeto/ })).toHaveAttribute(
      'href',
      '/app/projects/project-1',
    )
  })

  it('creates a project and refreshes the list', async () => {
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({ items: [], total: 0, page: 1, size: 9, pages: 0 }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            id: 'project-2',
            owner_id: 'user-1',
            name: 'Aplicativo móvel',
            description: 'Planejamento do novo aplicativo.',
            status: 'active',
            created_at: '2026-08-01T00:00:00Z',
            updated_at: '2026-08-01T00:00:00Z',
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'project-2',
              owner_id: 'user-1',
              name: 'Aplicativo móvel',
              description: 'Planejamento do novo aplicativo.',
              status: 'active',
              created_at: '2026-08-01T00:00:00Z',
              updated_at: '2026-08-01T00:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          size: 9,
          pages: 1,
        }),
      )

    renderProjectsPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Criar projeto' }))
    const dialog = screen.getByRole('dialog', { name: 'Crie um espaço de trabalho' })

    fireEvent.change(within(dialog).getByLabelText('Nome'), {
      target: { value: 'Aplicativo móvel' },
    })
    fireEvent.change(within(dialog).getByLabelText('Descrição'), {
      target: { value: 'Planejamento do novo aplicativo.' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar projeto' }))

    expect(await screen.findByText('Aplicativo móvel')).toBeVisible()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3))
    expect(fetchSpy.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' })
    expect(fetchSpy.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({
        name: 'Aplicativo móvel',
        description: 'Planejamento do novo aplicativo.',
      }),
    )
  })

  it('edits an existing project and refreshes its card', async () => {
    vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'project-3',
              owner_id: 'user-1',
              name: 'Nome anterior',
              description: null,
              status: 'active',
              created_at: '2026-08-01T00:00:00Z',
              updated_at: '2026-08-01T00:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          size: 9,
          pages: 1,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'project-3',
          owner_id: 'user-1',
          name: 'Nome atualizado',
          description: 'Descrição atualizada.',
          status: 'active',
          created_at: '2026-08-01T00:00:00Z',
          updated_at: '2026-08-01T01:00:00Z',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'project-3',
              owner_id: 'user-1',
              name: 'Nome atualizado',
              description: 'Descrição atualizada.',
              status: 'active',
              created_at: '2026-08-01T00:00:00Z',
              updated_at: '2026-08-01T01:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          size: 9,
          pages: 1,
        }),
      )

    renderProjectsPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    const dialog = screen.getByRole('dialog', { name: 'Atualize os detalhes' })

    fireEvent.change(within(dialog).getByLabelText('Nome'), {
      target: { value: 'Nome atualizado' },
    })
    fireEvent.change(within(dialog).getByLabelText('Descrição'), {
      target: { value: 'Descrição atualizada.' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar alterações' }),
    )

    expect(await screen.findByText('Nome atualizado')).toBeVisible()
    expect(screen.getByText('Descrição atualizada.')).toBeVisible()
  })

  it('archives a project and removes it from the active list', async () => {
    vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'project-4',
              owner_id: 'user-1',
              name: 'Projeto concluído',
              description: null,
              status: 'active',
              created_at: '2026-08-01T00:00:00Z',
              updated_at: '2026-08-01T00:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          size: 9,
          pages: 1,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'project-4',
          owner_id: 'user-1',
          name: 'Projeto concluído',
          description: null,
          status: 'archived',
          created_at: '2026-08-01T00:00:00Z',
          updated_at: '2026-08-01T01:00:00Z',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ items: [], total: 0, page: 1, size: 9, pages: 0 }),
      )

    renderProjectsPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Arquivar' }))

    expect(await screen.findByText('Crie seu primeiro projeto')).toBeVisible()
    expect(screen.queryByText('Projeto concluído')).not.toBeInTheDocument()
  })

})