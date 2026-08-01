import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { taskKeys } from '../tasks/hooks'
import type { TaskAttachment } from '../tasks/types'
import * as attachmentsApi from './api'

export const attachmentKeys = {
  all: ['attachments'] as const,
  task: (taskId: string) => [...attachmentKeys.all, 'task', taskId] as const,
}

async function invalidateTaskRepresentations(
  queryClient: QueryClient,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: taskKeys.lists() }),
    queryClient.invalidateQueries({ queryKey: taskKeys.boards() }),
  ])
}

export function useTaskAttachments(taskId: string, enabled = true) {
  return useQuery({
    queryKey: attachmentKeys.task(taskId),
    queryFn: () => attachmentsApi.listTaskAttachments(taskId),
    enabled: enabled && Boolean(taskId),
  })
}

export function useUploadTaskAttachment(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: File) =>
      attachmentsApi.uploadTaskAttachment(taskId, file),
    onSuccess: async (attachment) => {
      queryClient.setQueryData<TaskAttachment[]>(
        attachmentKeys.task(taskId),
        (current = []) => [
          ...current.filter((item) => item.id !== attachment.id),
          attachment,
        ],
      )
      await invalidateTaskRepresentations(queryClient)
    },
  })
}

export function useDeleteTaskAttachment(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (attachmentId: string) =>
      attachmentsApi.deleteTaskAttachment(attachmentId),
    onSuccess: async (_, attachmentId) => {
      queryClient.setQueryData<TaskAttachment[]>(
        attachmentKeys.task(taskId),
        (current = []) =>
          current.filter((attachment) => attachment.id !== attachmentId),
      )
      await invalidateTaskRepresentations(queryClient)
    },
  })
}

export function useDownloadTaskAttachment() {
  return useMutation({
    mutationFn: (attachmentId: string) =>
      attachmentsApi.downloadTaskAttachment(attachmentId),
  })
}