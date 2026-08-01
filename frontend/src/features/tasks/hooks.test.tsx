import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import * as tasksApi from './api'
import { taskKeys, useMoveTaskStatus } from './hooks'
import type {
  PaginatedTasks,
  Task,
  TaskBoardFilters,
  TaskFilters,
} from './types'

function taskFixture(): Task {
  return {
    id: 'task-1',
    project_id: 'project-1',
    title: 'Revisar autenticação',
    short_description: 'Validar o fluxo de sessão persistente.',
    description: null,
    status: 'todo',
    priority: 'high',
    due_at: null,
    tags: [],
    attachments: [],
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  }
}

describe('useMoveTaskStatus', () => {
  it('restores list and board caches when status persistence fails', async () => {
    const task = taskFixture()

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,

          // Este teste preenche os caches diretamente, sem montar useQuery.
          // Mantê-los indefinidamente evita coleta antes do rollback.
          gcTime: Infinity,
        },
        mutations: {
          retry: false,
        },
      },
    })

    const listFilters: TaskFilters = {
      projectId: 'project-1',
      page: 1,
      size: 8,
    }

    const boardFilters: TaskBoardFilters = {
      projectId: 'project-1',
    }

    const listData: PaginatedTasks = {
      items: [task],
      total: 1,
      page: 1,
      size: 8,
      pages: 1,
    }

    queryClient.setQueryData(taskKeys.list(listFilters), listData)
    queryClient.setQueryData(taskKeys.board(boardFilters), [task])
    queryClient.setQueryData(taskKeys.detail(task.id), task)

    let rejectRequest: ((reason?: unknown) => void) | undefined

    vi.spyOn(tasksApi, 'updateTask').mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject
        }),
    )

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )

    const { result } = renderHook(() => useMoveTaskStatus(), {
      wrapper,
    })

    let mutationPromise: Promise<Task> | undefined

    act(() => {
      mutationPromise = result.current.mutateAsync({
        task,
        status: 'done',
      })
    })

    // Confirma que a atualização otimista ocorreu antes da resposta da API.
    await waitFor(() => {
      const board = queryClient.getQueryData<Task[]>(
        taskKeys.board(boardFilters),
      )

      const list = queryClient.getQueryData<PaginatedTasks>(
        taskKeys.list(listFilters),
      )

      expect(board?.[0].status).toBe('done')
      expect(list?.items[0].status).toBe('done')
    })

    act(() => {
      rejectRequest?.(new Error('Falha simulada'))
    })

    await expect(mutationPromise).rejects.toThrow('Falha simulada')

    // Confirma que a falha restaurou os snapshots anteriores.
    await waitFor(() => {
      const board = queryClient.getQueryData<Task[]>(
        taskKeys.board(boardFilters),
      )

      const list = queryClient.getQueryData<PaginatedTasks>(
        taskKeys.list(listFilters),
      )

      const detail = queryClient.getQueryData<Task>(
        taskKeys.detail(task.id),
      )

      expect(board?.[0].status).toBe('todo')
      expect(list?.items[0].status).toBe('todo')
      expect(detail?.status).toBe('todo')
    })
  })
})