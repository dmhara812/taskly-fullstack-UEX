import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as tasksApi from './api'
import type {
  Task,
  TaskCreatePayload,
  TaskFilters,
  TaskUpdatePayload,
} from './types'

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: TaskFilters) => [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (taskId: string) => [...taskKeys.details(), taskId] as const,
}

export function useTasks(filters: TaskFilters) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => tasksApi.listTasks(filters),
    enabled: Boolean(filters.projectId),
  })
}

function useRefreshTaskQueries() {
  const queryClient = useQueryClient()

  return async (task?: Task) => {
    if (task) {
      queryClient.setQueryData(taskKeys.detail(task.id), task)
    }

    await queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
  }
}

export function useCreateTask() {
  const refresh = useRefreshTaskQueries()

  return useMutation({
    mutationFn: (payload: TaskCreatePayload) => tasksApi.createTask(payload),
    onSuccess: (task) => refresh(task),
  })
}

export function useUpdateTask() {
  const refresh = useRefreshTaskQueries()

  return useMutation({
    mutationFn: ({
      taskId,
      payload,
    }: {
      taskId: string
      payload: TaskUpdatePayload
    }) => tasksApi.updateTask(taskId, payload),
    onSuccess: (task) => refresh(task),
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId: string) => tasksApi.deleteTask(taskId),
    onSuccess: async (_, taskId) => {
      queryClient.removeQueries({ queryKey: taskKeys.detail(taskId) })
      await queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
    },
  })
}