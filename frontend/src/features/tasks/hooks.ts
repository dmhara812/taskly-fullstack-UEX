import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as tasksApi from './api'
import type {
  PaginatedTasks,
  Task,
  TaskBoardFilters,
  TaskCreatePayload,
  TaskFilters,
  TaskStatus,
  TaskUpdatePayload,
} from './types'

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: TaskFilters) => [...taskKeys.lists(), filters] as const,
  boards: () => [...taskKeys.all, 'board'] as const,
  board: (filters: TaskBoardFilters) => [...taskKeys.boards(), filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (taskId: string) => [...taskKeys.details(), taskId] as const,
}

export function useTasks(filters: TaskFilters, enabled = true) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => tasksApi.listTasks(filters),
    enabled: enabled && Boolean(filters.projectId),
  })
}

export function useKanbanTasks(filters: TaskBoardFilters, enabled = true) {
  return useQuery({
    queryKey: taskKeys.board(filters),
    queryFn: () => tasksApi.listAllProjectTasks(filters),
    enabled: enabled && Boolean(filters.projectId),
  })
}

function useRefreshTaskQueries() {
  const queryClient = useQueryClient()

  return async (task?: Task) => {
    if (task) {
      queryClient.setQueryData(taskKeys.detail(task.id), task)
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: taskKeys.boards() }),
    ])
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

interface MoveTaskStatusVariables {
  task: Task
  status: TaskStatus
}

interface MoveTaskStatusContext {
  listSnapshots: Array<[readonly unknown[], PaginatedTasks | undefined]>
  boardSnapshots: Array<[readonly unknown[], Task[] | undefined]>
  detailSnapshot: Task | undefined
}

function updateTaskInList(
  data: PaginatedTasks | undefined,
  taskId: string,
  status: TaskStatus,
  filters: TaskFilters | undefined,
): PaginatedTasks | undefined {
  if (!data) {
    return data
  }

  const currentTask = data.items.find((task) => task.id === taskId)
  if (!currentTask) {
    return data
  }

  // Em uma lista filtrada por status, a tarefa precisa desaparecer assim que
  // for movida para outra coluna. A invalidação posterior confirma o total real.
  if (filters?.status && filters.status !== status) {
    return {
      ...data,
      items: data.items.filter((task) => task.id !== taskId),
      total: Math.max(0, data.total - 1),
    }
  }

  return {
    ...data,
    items: data.items.map((task) =>
      task.id === taskId ? { ...task, status } : task,
    ),
  }
}

export function useMoveTaskStatus() {
  const queryClient = useQueryClient()

  return useMutation<Task, Error, MoveTaskStatusVariables, MoveTaskStatusContext>({
    mutationFn: ({ task, status }) =>
      tasksApi.updateTask(task.id, { status }),
    onMutate: async ({ task, status }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: taskKeys.lists() }),
        queryClient.cancelQueries({ queryKey: taskKeys.boards() }),
        queryClient.cancelQueries({ queryKey: taskKeys.detail(task.id) }),
      ])

      const listSnapshots = queryClient.getQueriesData<PaginatedTasks>({
        queryKey: taskKeys.lists(),
      })
      const boardSnapshots = queryClient.getQueriesData<Task[]>({
        queryKey: taskKeys.boards(),
      })
      const detailSnapshot = queryClient.getQueryData<Task>(
        taskKeys.detail(task.id),
      )

      for (const [queryKey, data] of listSnapshots) {
        const filters = queryKey[2] as TaskFilters | undefined
        queryClient.setQueryData(
          queryKey,
          updateTaskInList(data, task.id, status, filters),
        )
      }

      for (const [queryKey, data] of boardSnapshots) {
        queryClient.setQueryData<Task[] | undefined>(
          queryKey,
          data?.map((item) =>
            item.id === task.id ? { ...item, status } : item,
          ),
        )
      }

      queryClient.setQueryData<Task>(taskKeys.detail(task.id), {
        ...task,
        status,
      })

      return { listSnapshots, boardSnapshots, detailSnapshot }
    },
    onError: (_error, { task }, context) => {
      // O rollback restaura exatamente os caches existentes antes do arraste.
      // Nenhuma coluna permanece visualmente alterada se a API rejeitar o PATCH.
      for (const [queryKey, data] of context?.listSnapshots ?? []) {
        queryClient.setQueryData(queryKey, data)
      }

      for (const [queryKey, data] of context?.boardSnapshots ?? []) {
        queryClient.setQueryData(queryKey, data)
      }

      if (context?.detailSnapshot) {
        queryClient.setQueryData(taskKeys.detail(task.id), context.detailSnapshot)
      } else {
        queryClient.removeQueries({
          queryKey: taskKeys.detail(task.id),
          exact: true,
        })
      }
    },
    onSuccess: (updatedTask) => {
      queryClient.setQueryData(taskKeys.detail(updatedTask.id), updatedTask)
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: taskKeys.boards() }),
      ])
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId: string) => tasksApi.deleteTask(taskId),
    onSuccess: async (_, taskId) => {
      queryClient.removeQueries({ queryKey: taskKeys.detail(taskId) })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: taskKeys.boards() }),
      ])
    },
  })
}
