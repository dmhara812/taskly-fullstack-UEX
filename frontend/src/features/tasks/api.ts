import { apiRequest } from '../../api/client'
import type {
  PaginatedTasks,
  Task,
  TaskCreatePayload,
  TaskFilters,
  TaskUpdatePayload,
} from './types'

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