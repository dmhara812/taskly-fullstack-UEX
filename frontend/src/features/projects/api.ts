import { apiRequest } from '../../api/client'
import type {
  PaginatedProjects,
  Project,
  ProjectFilters,
  ProjectPayload,
  ProjectUpdatePayload,
} from './types'

export function listProjects(filters: ProjectFilters): Promise<PaginatedProjects> {
  const params = new URLSearchParams({
    page: String(filters.page),
    size: String(filters.size),
    status: filters.status,
  })

  if (filters.search) {
    params.set('search', filters.search)
  }

  return apiRequest<PaginatedProjects>(`/projects?${params.toString()}`)
}

export function getProject(projectId: string): Promise<Project> {
  return apiRequest<Project>(`/projects/${projectId}`)
}

export function createProject(payload: ProjectPayload): Promise<Project> {
  return apiRequest<Project>('/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateProject(
  projectId: string,
  payload: ProjectUpdatePayload,
): Promise<Project> {
  return apiRequest<Project>(`/projects/${projectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function archiveProject(projectId: string): Promise<Project> {
  return apiRequest<Project>(`/projects/${projectId}/archive`, {
    method: 'PATCH',
  })
}

export function deleteProject(projectId: string): Promise<void> {
  return apiRequest<void>(`/projects/${projectId}`, {
    method: 'DELETE',
  })
}