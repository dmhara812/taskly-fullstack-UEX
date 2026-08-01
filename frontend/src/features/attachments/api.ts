import { apiDownload, apiRequest } from '../../api/client'
import type { TaskAttachment } from '../tasks/types'

export function listTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  return apiRequest<TaskAttachment[]>(`/tasks/${taskId}/attachments`)
}

export function uploadTaskAttachment(
  taskId: string,
  file: File,
): Promise<TaskAttachment> {
  const formData = new FormData()
  formData.append('file', file)

  // O navegador define automaticamente o boundary do multipart. Definir
  // Content-Type manualmente quebraria o upload no FastAPI.
  return apiRequest<TaskAttachment>(`/tasks/${taskId}/attachments`, {
    method: 'POST',
    body: formData,
  })
}

export function deleteTaskAttachment(attachmentId: string): Promise<void> {
  return apiRequest<void>(`/attachments/${attachmentId}`, {
    method: 'DELETE',
  })
}

export function downloadTaskAttachment(attachmentId: string): Promise<Blob> {
  return apiDownload(`/attachments/${attachmentId}/content`)
}