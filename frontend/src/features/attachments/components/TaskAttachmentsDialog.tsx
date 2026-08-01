import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ApiError } from '../../../api/client'
import type { Task, TaskAttachment } from '../../tasks/types'
import {
  useDeleteTaskAttachment,
  useDownloadTaskAttachment,
  useTaskAttachments,
  useUploadTaskAttachment,
} from '../hooks'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

interface TaskAttachmentsDialogProps {
  task: Task
  isReadOnly: boolean
  onClose: () => void
}

function getErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.detail
    : 'Não foi possível concluir a operação com o anexo.'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const kilobytes = bytes / 1024
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`
}

function attachmentKind(attachment: TaskAttachment): string {
  if (attachment.content_type === 'application/pdf') {
    return 'PDF'
  }

  return 'Imagem'
}

export function TaskAttachmentsDialog({
  task,
  isReadOnly,
  onClose,
}: TaskAttachmentsDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const attachmentsQuery = useTaskAttachments(task.id)
  const uploadMutation = useUploadTaskAttachment(task.id)
  const deleteMutation = useDeleteTaskAttachment(task.id)
  const downloadMutation = useDownloadTaskAttachment()
  const isBusy =
    uploadMutation.isPending ||
    deleteMutation.isPending ||
    downloadMutation.isPending

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setActionError(null)

    if (!file) {
      setSelectedFile(null)
      return
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      setSelectedFile(null)
      setActionError('Selecione uma imagem JPEG, PNG, WebP ou um arquivo PDF.')
      event.target.value = ''
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null)
      setActionError('O arquivo deve ter no máximo 5 MB.')
      event.target.value = ''
      return
    }

    setSelectedFile(file)
  }

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedFile || isReadOnly) {
      return
    }

    setActionError(null)

    try {
      await uploadMutation.mutateAsync(selectedFile)
      setSelectedFile(null)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      setActionError(getErrorMessage(error))
    }
  }

  const download = async (attachment: TaskAttachment) => {
    setActionError(null)

    try {
      const blob = await downloadMutation.mutateAsync(attachment.id)
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = attachment.name
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
    } catch (error) {
      setActionError(getErrorMessage(error))
    }
  }

  const remove = async (attachment: TaskAttachment) => {
    if (isReadOnly) {
      return
    }

    const confirmed = window.confirm(`Excluir o anexo “${attachment.name}”?`)
    if (!confirmed) {
      return
    }

    setActionError(null)

    try {
      await deleteMutation.mutateAsync(attachment.id)
    } catch (error) {
      setActionError(getErrorMessage(error))
    }
  }

  const attachments = attachmentsQuery.data ?? task.attachments

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!isBusy) {
          onClose()
        }
      }}
    >
      <section
        aria-labelledby="attachments-dialog-title"
        aria-modal="true"
        className="attachments-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">Arquivos da tarefa</span>
            <h2 id="attachments-dialog-title">Anexos de {task.title}</h2>
          </div>
          <button
            aria-label="Fechar anexos"
            className="icon-button"
            type="button"
            disabled={isBusy}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {isReadOnly ? (
          <div className="read-only-banner compact-read-only" role="status">
            <strong>Consulta permitida.</strong>
            <span>Restaure o projeto para enviar ou excluir arquivos.</span>
          </div>
        ) : (
          <form className="attachment-upload" onSubmit={upload}>
            <div className="field-group">
              <label htmlFor="task-attachment-file">Novo anexo</label>
              <input
                ref={fileInputRef}
                id="task-attachment-file"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                disabled={isBusy}
                onChange={selectFile}
              />
              <span className="field-hint">
                JPEG, PNG, WebP ou PDF, com no máximo 5 MB.
              </span>
            </div>
            <button
              className="primary-button"
              type="submit"
              disabled={!selectedFile || isBusy}
            >
              {uploadMutation.isPending ? 'Enviando…' : 'Enviar arquivo'}
            </button>
          </form>
        )}

        {actionError ? (
          <div className="form-error" role="alert">
            {actionError}
          </div>
        ) : null}

        <div className="attachments-content">
          {attachmentsQuery.isPending ? (
            <div className="attachments-state" role="status">
              Carregando anexos…
            </div>
          ) : attachmentsQuery.isError ? (
            <div className="attachments-state" role="alert">
              <p>{getErrorMessage(attachmentsQuery.error)}</p>
              <button
                className="secondary-button"
                type="button"
                onClick={() => void attachmentsQuery.refetch()}
              >
                Tentar novamente
              </button>
            </div>
          ) : attachments.length === 0 ? (
            <div className="attachments-state attachments-empty">
              <strong>Nenhum anexo enviado.</strong>
              <span>Os arquivos desta tarefa aparecerão aqui.</span>
            </div>
          ) : (
            <ul className="attachments-list" aria-label="Anexos da tarefa">
              {attachments.map((attachment) => (
                <li key={attachment.id}>
                  <div className="attachment-icon" aria-hidden="true">
                    {attachment.content_type === 'application/pdf' ? 'PDF' : 'IMG'}
                  </div>
                  <div className="attachment-copy">
                    <strong>{attachment.name}</strong>
                    <span>
                      {attachmentKind(attachment)} ·{' '}
                      {formatFileSize(attachment.size_bytes)}
                    </span>
                  </div>
                  <div className="attachment-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={isBusy}
                      onClick={() => void download(attachment)}
                    >
                      Baixar
                    </button>
                    {!isReadOnly ? (
                      <button
                        className="danger-text-button"
                        type="button"
                        disabled={isBusy}
                        onClick={() => void remove(attachment)}
                      >
                        Excluir
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}