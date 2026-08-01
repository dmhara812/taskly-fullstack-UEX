import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Task, TaskAttachment } from '../../tasks/types'
import { TaskAttachmentsDialog } from './TaskAttachmentsDialog'

const attachment: TaskAttachment = {
  id: 'attachment-1',
  task_id: 'task-1',
  name: 'requisitos.pdf',
  url: '/api/v1/attachments/attachment-1/content',
  content_type: 'application/pdf',
  size_bytes: 2048,
  created_at: '2026-08-01T00:00:00Z',
}

const task: Task = {
  id: 'task-1',
  project_id: 'project-1',
  title: 'Revisar requisitos',
  short_description: 'Conferir o escopo obrigatório.',
  description: null,
  status: 'todo',
  priority: 'medium',
  due_at: null,
  tags: [],
  attachments: [],
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function requestDetails(input: RequestInfo | URL, init?: RequestInit) {
  if (input instanceof Request) {
    return { url: input.url, method: input.method, body: input.body }
  }

  return {
    url: String(input),
    method: init?.method ?? 'GET',
    body: init?.body ?? null,
  }
}

function renderDialog(isReadOnly = false) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <TaskAttachmentsDialog
        task={task}
        isReadOnly={isReadOnly}
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  )
}

describe('TaskAttachmentsDialog', () => {
  it('uploads a valid file and updates the visible list', async () => {
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockImplementation(async (input, init) => {
        const { url, method } = requestDetails(input, init)

        if (url.endsWith('/tasks/task-1/attachments') && method === 'GET') {
          return jsonResponse([])
        }

        if (url.endsWith('/tasks/task-1/attachments') && method === 'POST') {
          return jsonResponse(attachment, 201)
        }

        throw new Error(`Requisição não simulada: ${method} ${url}`)
      })

    renderDialog()

    const file = new File(['conteúdo'], 'requisitos.pdf', {
      type: 'application/pdf',
    })
    fireEvent.change(await screen.findByLabelText('Novo anexo'), {
      target: { files: [file] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar arquivo' }))

    expect(await screen.findByText('requisitos.pdf')).toBeVisible()

    const postCall = fetchSpy.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(postCall?.[1]?.body).toBeInstanceOf(FormData)
    expect((postCall?.[1]?.body as FormData).get('file')).toBe(file)
  })

  it('downloads and deletes an existing attachment', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:attachment'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(() => undefined),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    )

    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockImplementation(async (input, init) => {
        const { url, method } = requestDetails(input, init)

        if (url.endsWith('/tasks/task-1/attachments') && method === 'GET') {
          return jsonResponse([attachment])
        }

        if (
          url.endsWith('/attachments/attachment-1/content') &&
          method === 'GET'
        ) {
          return new Response(new Blob(['pdf'], { type: 'application/pdf' }), {
            status: 200,
          })
        }

        if (url.endsWith('/attachments/attachment-1') && method === 'DELETE') {
          return new Response(null, { status: 204 })
        }

        throw new Error(`Requisição não simulada: ${method} ${url}`)
      })

    renderDialog()

    expect(await screen.findByText('requisitos.pdf')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Baixar' }))

    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.some(([input]) =>
          String(input).includes('/attachments/attachment-1/content'),
        ),
      ).toBe(true),
    )

    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    await waitFor(() => expect(deleteButton).toBeEnabled())
    fireEvent.click(deleteButton)
    await waitFor(() =>
      expect(screen.queryByText('requisitos.pdf')).not.toBeInTheDocument(),
    )
  })

  it('keeps attachments available for download in a read-only project', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(jsonResponse([attachment]))

    renderDialog(true)

    expect(await screen.findByText('requisitos.pdf')).toBeVisible()
    expect(screen.queryByLabelText('Novo anexo')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Baixar' })).toBeVisible()
  })
})