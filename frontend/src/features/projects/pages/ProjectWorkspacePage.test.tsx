import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { Project } from '../types'
import { ProjectWorkspacePage } from './ProjectWorkspacePage'
import type { Task } from '../../tasks/types'

const activeProject: Project = {
  id: 'project-1',
  owner_id: 'user-1',
  name: 'Portal do cliente',
  description: 'Nova área autenticada.',
  status: 'active',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
}

function taskFixture(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    project_id: 'project-1',
    title: 'Revisar autenticação',
    short_description: 'Validar o fluxo de sessão persistente.',
    description: 'Confirmar login, refresh e logout em todos os cenários.',
    status: 'todo',
    priority: 'high',
    due_at: '2026-08-05T18:30:00Z',
    tags: [
      {
        id: 'tag-1',
        name: 'frontend',
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
    ],
    attachments: [],
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function requestDetails(input: RequestInfo | URL, init?: RequestInit) {
  if (input instanceof Request) {
    return { url: input.url, method: input.method }
  }

  return { url: String(input), method: init?.method ?? 'GET' }
}

function installApiMock({
  project = activeProject,
  initialTasks = [taskFixture()],
  kanbanPages,
}: {
  project?: Project
  initialTasks?: Task[]
  kanbanPages?: Task[][]
} = {}) {
  let tasks = [...initialTasks]

  return vi.spyOn(window, 'fetch').mockImplementation(async (input, init) => {
    const { url, method } = requestDetails(input, init)

    if (url.endsWith('/projects/project-1') && method === 'GET') {
      return jsonResponse(project)
    }

    if (url.includes('/tasks?') && method === 'GET') {
      const parsedUrl = new URL(url)
      const requestedPage = Number(parsedUrl.searchParams.get('page') ?? '1')
      const requestedSize = Number(parsedUrl.searchParams.get('size') ?? '8')

      if (requestedSize === 100 && kanbanPages) {
        const pageItems = kanbanPages[requestedPage - 1] ?? []
        const total = kanbanPages.reduce(
          (sum, currentPage) => sum + currentPage.length,
          0,
        )

        return jsonResponse({
          items: pageItems,
          total,
          page: requestedPage,
          size: requestedSize,
          pages: kanbanPages.length,
        })
      }

      return jsonResponse({
        items: tasks,
        total: tasks.length,
        page: requestedPage,
        size: requestedSize,
        pages: tasks.length > 0 ? 1 : 0,
      })
    }

    if (url.endsWith('/tasks') && method === 'POST') {
      const payload = JSON.parse(String(init?.body)) as Record<string, unknown>
      const createdTask = taskFixture({
        id: 'task-created',
        title: String(payload.title),
        short_description: String(payload.short_description),
        description: payload.description as string | null,
        priority: payload.priority as Task['priority'],
        due_at: payload.due_at as string | null,
        tags: (payload.tags as string[]).map((name, index) => ({
          id: `tag-created-${index}`,
          name,
          created_at: '2026-08-01T00:00:00Z',
          updated_at: '2026-08-01T00:00:00Z',
        })),
      })
      tasks = [createdTask, ...tasks]
      return jsonResponse(createdTask, 201)
    }

    if (url.endsWith('/tasks/task-1') && method === 'PATCH') {
      const payload = JSON.parse(String(init?.body)) as Partial<Task>
      tasks = tasks.map((task) =>
        task.id === 'task-1' ? { ...task, ...payload } : task,
      )
      return jsonResponse(tasks.find((task) => task.id === 'task-1'))
    }

    throw new Error(`Requisição não simulada: ${method} ${url}`)
  })
}

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app/projects/project-1']}>
        <Routes>
          <Route
            path="/app/projects/:projectId"
            element={<ProjectWorkspacePage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProjectWorkspacePage', () => {
  it('renders the project tasks with status, priority, tags and due date', async () => {
    installApiMock()
    renderWorkspace()

    expect(await screen.findByRole('heading', { name: 'Portal do cliente' })).toBeVisible()
    expect(await screen.findByText('Revisar autenticação')).toBeVisible()
    expect(screen.getByText('Prioridade alta')).toBeVisible()
    expect(screen.getByText('frontend')).toBeVisible()
    expect(screen.getByText(/Prazo:/)).toBeVisible()
  })

  it('creates a task and sends the local deadline normalized as an ISO instant', async () => {
    const fetchSpy = installApiMock({ initialTasks: [] })
    renderWorkspace()

    fireEvent.click(await screen.findByRole('button', { name: 'Criar tarefa' }))
    const dialog = screen.getByRole('dialog', { name: 'Planeje o próximo trabalho' })

    fireEvent.change(within(dialog).getByLabelText('Título'), {
      target: { value: 'Preparar demonstração' },
    })
    fireEvent.change(within(dialog).getByLabelText('Descrição curta'), {
      target: { value: 'Organizar o roteiro funcional do Taskly.' },
    })
    fireEvent.change(within(dialog).getByLabelText('Descrição completa'), {
      target: { value: 'Mostrar autenticação, projetos e tarefas.' },
    })
    fireEvent.change(within(dialog).getByLabelText('Prioridade'), {
      target: { value: 'high' },
    })
    fireEvent.change(within(dialog).getByLabelText('Prazo'), {
      target: { value: '2026-08-06T14:30' },
    })
    fireEvent.change(within(dialog).getByLabelText('Tags'), {
      target: { value: 'demo, frontend, demo' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar tarefa' }))

    expect(await screen.findByText('Preparar demonstração')).toBeVisible()

    const postCall = fetchSpy.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(postCall).toBeDefined()

    const payload = JSON.parse(String(postCall?.[1]?.body)) as {
      due_at: string
      tags: string[]
    }
    expect(new Date(payload.due_at).toISOString()).toBe(payload.due_at)
    expect(payload.tags).toEqual(['demo', 'frontend'])
  })

  it('updates the task status directly from the list', async () => {
    const fetchSpy = installApiMock()
    renderWorkspace()

    const statusSelect = await screen.findByRole('combobox', {
      name: 'Status de Revisar autenticação',
    })
    fireEvent.change(statusSelect, { target: { value: 'done' } })

    await waitFor(() => expect(statusSelect).toHaveValue('done'))

    const patchCall = fetchSpy.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(patchCall?.[1]?.body).toBe(JSON.stringify({ status: 'done' }))
  })

  it('loads every API page when the kanban view is opened', async () => {
    const secondTask = taskFixture({
      id: 'task-2',
      title: 'Publicar ambiente',
      short_description: 'Disponibilizar a aplicação para validação.',
      status: 'done',
    })
    const fetchSpy = installApiMock({
      kanbanPages: [[taskFixture()], [secondTask]],
    })
    renderWorkspace()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Kanban' }),
    )

    expect(await screen.findByText('Publicar ambiente')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Não iniciada' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Concluída' })).toBeVisible()

    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(([input]) => {
          const url = input instanceof Request ? input.url : String(input)
          return url.includes('page=2') && url.includes('size=100')
        }),
      ).toBe(true)
    })
  })

  it('persists a status change made from the kanban card', async () => {
    const fetchSpy = installApiMock({
      kanbanPages: [[taskFixture()]],
    })
    renderWorkspace()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Kanban' }),
    )

    const moveSelect = await screen.findByRole('combobox', {
      name: 'Mover Revisar autenticação para outra coluna',
    })
    fireEvent.change(moveSelect, { target: { value: 'in_progress' } })

    await waitFor(() => {
      const patchCall = fetchSpy.mock.calls.find(([, init]) => init?.method === 'PATCH')
      expect(patchCall?.[1]?.body).toBe(JSON.stringify({ status: 'in_progress' }))
    })
  })

  it('keeps an archived project in read-only mode', async () => {
    installApiMock({
      project: { ...activeProject, status: 'archived' },
    })
    renderWorkspace()

    expect(await screen.findByText(/somente leitura/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: '+ Nova tarefa' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: 'Status de Revisar autenticação' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeDisabled()
  })
})
