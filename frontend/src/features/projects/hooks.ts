import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as projectsApi from './api'
import type {
  Project,
  ProjectFilters,
  ProjectPayload,
  ProjectUpdatePayload,
} from './types'

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: ProjectFilters) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (projectId: string) => [...projectKeys.details(), projectId] as const,
}

export function useProjects(filters: ProjectFilters) {
  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: () => projectsApi.listProjects(filters),
  })
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => projectsApi.getProject(projectId),
    enabled: Boolean(projectId),
  })
}

function useRefreshProjectQueries() {
  const queryClient = useQueryClient()

  return async (project?: Project) => {
    if (project) {
      queryClient.setQueryData(projectKeys.detail(project.id), project)
    }

    await queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
  }
}

export function useCreateProject() {
  const refresh = useRefreshProjectQueries()

  return useMutation({
    mutationFn: (payload: ProjectPayload) => projectsApi.createProject(payload),
    onSuccess: (project) => refresh(project),
  })
}

export function useUpdateProject() {
  const refresh = useRefreshProjectQueries()

  return useMutation({
    mutationFn: ({
      projectId,
      payload,
    }: {
      projectId: string
      payload: ProjectUpdatePayload
    }) => projectsApi.updateProject(projectId, payload),
    onSuccess: (project) => refresh(project),
  })
}

export function useArchiveProject() {
  const refresh = useRefreshProjectQueries()

  return useMutation({
    mutationFn: (projectId: string) => projectsApi.archiveProject(projectId),
    onSuccess: (project) => refresh(project),
  })
}

export function useRestoreProject() {
  const refresh = useRefreshProjectQueries()

  return useMutation({
    mutationFn: (projectId: string) =>
      projectsApi.updateProject(projectId, { status: 'active' }),
    onSuccess: (project) => refresh(project),
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (projectId: string) => projectsApi.deleteProject(projectId),
    onSuccess: async (_, projectId) => {
      queryClient.removeQueries({ queryKey: projectKeys.detail(projectId) })
      await queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    },
  })
}