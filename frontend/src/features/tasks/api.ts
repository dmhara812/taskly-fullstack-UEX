import { apiRequest } from '../../api/client'
import type {
  PaginatedTasks,
  Task,
  TaskBoardFilters,
  TaskCreatePayload,
  TaskFilters,
  TaskUpdatePayload,
} from './types'

const KANBAN_PAGE_SIZE = 100

export function listTasks(filters: TaskFilters): Promise<PaginatedTasks> {
  const params = new URLSearchParams({
    project_id: filters.projectId,
    page: String(filters.page),
    size: String(filters.size),
  })

  if (filters.status) {
    params.set('status', filters.status)
  }

  if (filters.priority) {
    params.set('priority', filters.priority)
  }

  if (filters.search) {
    params.set('search', filters.search)
  }

  return apiRequest<PaginatedTasks>(`/tasks?${params.toString()}`)
}

export async function listAllProjectTasks(
  filters: TaskBoardFilters,
): Promise<Task[]> {
  const tasks: Task[] = []
  let currentPage = 1
  let totalPages = 1

  // O endpoint continua paginado. O kanban percorre todas as páginas para não
  // ocultar tarefas quando um projeto ultrapassar o limite máximo da API.
  do {
    const response = await listTasks({
      projectId: filters.projectId,
      page: currentPage,
      size: KANBAN_PAGE_SIZE,
      priority: filters.priority,
      search: filters.search,
    })

    tasks.push(...response.items)
    totalPages = response.pages
    currentPage += 1
  } while (currentPage <= totalPages)

  return tasks
}

export function createTask(payload: TaskCreatePayload): Promise<Task> {
  return apiRequest<Task>('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateTask(
  taskId: string,
  payload: TaskUpdatePayload,
): Promise<Task> {
  return apiRequest<Task>(`/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteTask(taskId: string): Promise<void> {
  return apiRequest<void>(`/tasks/${taskId}`, {
    method: 'DELETE',
  })
}
