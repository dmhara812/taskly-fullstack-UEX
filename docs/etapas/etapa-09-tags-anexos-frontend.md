# Etapa 09 — Tags e anexos no frontend

## 1. Objetivo da etapa

Completar a integração visual dos recursos de tags e anexos já existentes no backend, oferecendo autocomplete de tags e gestão autenticada de arquivos por tarefa.

Esta etapa preserva o backend e as migrations. As alterações ficam concentradas no frontend e na documentação.

A base utilizada já incorpora as correções identificadas após a Etapa 08:

- cache do teste de rollback mantido durante a execução;
- barra horizontal superior sincronizada no kanban;
- ajustes anteriores de lint, testes e imports.

## 2. O que foi feito e por quê

Foram implementados:

- autocomplete de tags reutilizáveis do usuário;
- manutenção da possibilidade de criar uma tag nova ao salvar a tarefa;
- integração do campo com React Hook Form por `Controller`;
- consulta de sugestões apenas enquanto o campo está aberto;
- feature independente de anexos no frontend;
- diálogo de anexos acessível pela lista e pelo kanban;
- upload autenticado de JPEG, PNG, WebP e PDF;
- limite antecipado de 5 MB no navegador;
- listagem de metadados dos anexos;
- download autenticado por Blob;
- exclusão com confirmação;
- atualização do cache de anexos;
- invalidação de lista e kanban após upload e exclusão;
- consulta e download em projetos arquivados;
- bloqueio de upload e exclusão em projetos arquivados;
- estados de carregamento, erro e vazio;
- testes de autocomplete, upload, download, exclusão e somente leitura.

## 3. Decisões técnicas tomadas

### 3.1. Autocomplete sem substituir o contrato de tags

O payload continua enviando `tags: string[]`.

**Motivo:** o backend já resolve normalização, reutilização e criação de tags. O frontend apenas melhora a seleção, sem duplicar a regra de negócio.

### 3.2. Sugestões sob demanda

A consulta de tags é habilitada somente quando o campo está em uso.

**Motivo:** evita requests desnecessários, reduz interferência nos testes existentes e mantém a tela de tarefa leve.

### 3.3. Anexos em diálogo próprio

Os anexos não foram colocados diretamente no formulário de criação.

**Motivo:** o upload exige `task_id`. Separar o fluxo evita uma transação composta e permite gerenciar arquivos de uma tarefa já persistida tanto na lista quanto no kanban.

### 3.4. Download autenticado por Blob

O cliente HTTP ganhou `apiDownload`, reutilizando a mesma lógica de access token e refresh token.

**Motivo:** um link direto não envia o bearer token e não atende ao endpoint protegido.

### 3.5. `FormData` sem `Content-Type` manual

O upload envia `FormData` e deixa o navegador definir o header multipart.

**Motivo:** o navegador precisa acrescentar o boundary; definir o header manualmente quebra o parsing no FastAPI.

### 3.6. Cache remoto como fonte de verdade

O diálogo atualiza seu cache específico e invalida lista e kanban.

**Motivo:** contadores e metadados precisam refletir o backend sem criar uma segunda coleção global em estado local.

### 3.7. Projetos arquivados

Listagem e download permanecem disponíveis. Upload e exclusão ficam indisponíveis.

**Motivo:** concretiza o modo somente leitura já aprovado no domínio.

### 3.8. `DECISIONS.md`

Não foi alterado. A modelagem relacional de tags, o storage desacoplado e o comportamento de projetos arquivados já estavam documentados. Esta etapa apenas integra essas decisões ao frontend.

## 4. Dependências entre arquivos e ordem de criação

1. `api/client.ts` passa a suportar resposta Blob.
2. `features/tags/` cria tipos, API, query e autocomplete.
3. `TaskFormDialog.tsx` integra o autocomplete ao React Hook Form.
4. `features/attachments/` cria API, hooks, diálogo e testes.
5. Lista e kanban recebem a ação de abrir anexos.
6. `ProjectWorkspacePage.tsx` coordena o diálogo selecionando a tarefa.
7. `styles.css` adiciona os estilos dos novos componentes.
8. READMEs e documentos globais registram o estado alcançado.

## 5. Conteúdo completo dos arquivos criados ou alterados

O conteúdo deste documento não é repetido dentro dele para evitar recursão. Os demais arquivos são reproduzidos integralmente abaixo.

### `frontend/src/api/client.ts`

````typescript
import {
  clearAuthTokens,
  readAuthTokens,
  writeAuthTokens,
} from '../lib/auth-storage'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
const AUTH_EXPIRED_DETAIL = 'Invalid or expired token'

let refreshInFlight: Promise<boolean> | null = null

interface ApiRequestOptions extends RequestInit {
  authenticated?: boolean
  retryAfterRefresh?: boolean
}

interface ErrorPayload {
  detail?: string | Array<{ msg?: string }>
}

interface RefreshResponse {
  access_token: string
  refresh_token: string | null
}

export class ApiError extends Error {
  readonly status: number
  readonly detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

function normalizeErrorDetail(payload: ErrorPayload | null): string {
  if (!payload?.detail) {
    return 'Não foi possível concluir a solicitação.'
  }

  if (typeof payload.detail === 'string') {
    return payload.detail
  }

  return payload.detail
    .map((item) => item.msg)
    .filter((message): message is string => Boolean(message))
    .join(' ')
}

async function readErrorPayload(response: Response): Promise<ErrorPayload | null> {
  try {
    return (await response.clone().json()) as ErrorPayload
  } catch {
    return null
  }
}

function buildHeaders(
  headers: HeadersInit | undefined,
  authenticated: boolean,
): Headers {
  const result = new Headers(headers)

  if (!result.has('Accept')) {
    result.set('Accept', 'application/json')
  }

  const tokens = readAuthTokens()
  if (authenticated && tokens) {
    result.set('Authorization', `Bearer ${tokens.accessToken}`)
  }

  return result
}

async function executeRefresh(): Promise<boolean> {
  const tokens = readAuthTokens()

  if (!tokens?.refreshToken) {
    return false
  }

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: tokens.refreshToken }),
  })

  if (!response.ok) {
    clearAuthTokens()
    return false
  }

  const payload = (await response.json()) as RefreshResponse

  if (!payload.refresh_token) {
    clearAuthTokens()
    return false
  }

  writeAuthTokens({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
  })
  return true
}

function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    // Uma única renovação atende requisições concorrentes que falharam com o
    // mesmo access token, evitando rotação duplicada e chamadas redundantes.
    refreshInFlight = executeRefresh().finally(() => {
      refreshInFlight = null
    })
  }

  return refreshInFlight
}

async function executeApiRequest(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Response> {
  const {
    authenticated = true,
    retryAfterRefresh = true,
    headers,
    ...requestOptions
  } = options

  const response = await fetch(`${API_URL}${path}`, {
    ...requestOptions,
    headers: buildHeaders(headers, authenticated),
  })

  if (response.ok) {
    return response
  }

  const payload = await readErrorPayload(response)
  const detail = normalizeErrorDetail(payload)
  const isAuthenticationFailure =
    response.status === 401 ||
    (response.status === 403 && detail === AUTH_EXPIRED_DETAIL)

  if (authenticated && retryAfterRefresh && isAuthenticationFailure) {
    const refreshed = await refreshSession()

    if (refreshed) {
      return executeApiRequest(path, {
        ...options,
        retryAfterRefresh: false,
      })
    }
  }

  if (isAuthenticationFailure) {
    clearAuthTokens()
  }

  throw new ApiError(response.status, detail)
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await executeApiRequest(path, options)

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function apiDownload(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Blob> {
  // Downloads usam a mesma renovação de sessão das chamadas JSON. A diferença
  // é somente o parser final, preservando autenticação e tratamento de erros.
  const response = await executeApiRequest(path, options)
  return response.blob()
}
````

### `frontend/src/api/client.test.ts`

````typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { writeAuthTokens } from '../lib/auth-storage'
import { apiDownload, apiRequest } from './client'

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('refreshes an expired access token and retries once', async () => {
    writeAuthTokens({
      accessToken: 'expired-access-token',
      refreshToken: 'current-refresh-token',
    })

    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Invalid or expired token' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            token_type: 'bearer',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: 'protected-data' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    const response = await apiRequest<{ value: string }>('/protected')

    expect(response.value).toBe('protected-data')
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(window.localStorage.getItem('taskly.auth.tokens')).toContain(
      'new-refresh-token',
    )

    const retryHeaders = new Headers(fetchSpy.mock.calls[2][1]?.headers)
    expect(retryHeaders.get('Authorization')).toBe('Bearer new-access-token')
  })


  it('downloads protected binary content with the current access token', async () => {
    writeAuthTokens({
      accessToken: 'valid-access-token',
      refreshToken: 'valid-refresh-token',
    })
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValueOnce(
      new Response(new Blob(['arquivo'], { type: 'application/pdf' }), {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      }),
    )

    const blob = await apiDownload('/attachments/attachment-1/content')

    expect(blob.type).toBe('application/pdf')
    expect(await blob.text()).toBe('arquivo')
    const headers = new Headers(fetchSpy.mock.calls[0][1]?.headers)
    expect(headers.get('Authorization')).toBe('Bearer valid-access-token')
  })

  it('does not refresh a business-rule forbidden response', async () => {
    writeAuthTokens({
      accessToken: 'valid-access-token',
      refreshToken: 'valid-refresh-token',
    })
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Archived project is read-only' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(apiRequest('/tasks')).rejects.toMatchObject({
      status: 403,
      detail: 'Archived project is read-only',
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
````

### `frontend/src/features/tags/types.ts`

````typescript
export interface TagOption {
  id: string
  name: string
  created_at: string
  updated_at: string
}
````

### `frontend/src/features/tags/api.ts`

````typescript
import { apiRequest } from '../../api/client'
import type { TagOption } from './types'

export function listTags(search?: string): Promise<TagOption[]> {
  const params = new URLSearchParams({ limit: '50' })

  if (search) {
    params.set('search', search)
  }

  return apiRequest<TagOption[]>(`/tags?${params.toString()}`)
}
````

### `frontend/src/features/tags/hooks.ts`

````typescript
import { useQuery } from '@tanstack/react-query'
import { listTags } from './api'

export const tagKeys = {
  all: ['tags'] as const,
  list: (search?: string) => [...tagKeys.all, 'list', search ?? ''] as const,
}

export function useTagSuggestions(search: string, enabled: boolean) {
  const normalizedSearch = search.trim()

  return useQuery({
    queryKey: tagKeys.list(normalizedSearch || undefined),
    queryFn: () => listTags(normalizedSearch || undefined),
    enabled,
    staleTime: 60_000,
  })
}
````

### `frontend/src/features/tags/components/TagAutocompleteInput.tsx`

````tsx
import { useId, useMemo, useState } from 'react'
import { useTagSuggestions } from '../hooks'
import type { TagOption } from '../types'

interface TagAutocompleteInputProps {
  id: string
  value: string
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  onChange: (value: string) => void
  onBlur: () => void
}

function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function selectedTagNames(value: string): string[] {
  return value
    .split(',')
    .map(normalizeTagName)
    .filter(Boolean)
}

export function TagAutocompleteInput({
  id,
  value,
  disabled = false,
  invalid = false,
  describedBy,
  onChange,
  onBlur,
}: TagAutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const listboxId = useId()
  const segments = value.split(',')
  const activeSearch = normalizeTagName(segments.at(-1) ?? '')
  const selectedNames = useMemo(() => selectedTagNames(value), [value])
  const selectedKeys = useMemo(
    () => new Set(selectedNames.map((name) => name.toLocaleLowerCase('pt-BR'))),
    [selectedNames],
  )
  const suggestionsQuery = useTagSuggestions(activeSearch, isOpen && !disabled)
  const suggestions = (suggestionsQuery.data ?? []).filter(
    (tag) => !selectedKeys.has(tag.name.toLocaleLowerCase('pt-BR')),
  )

  const selectSuggestion = (tag: TagOption) => {
    const previousSegments = segments.slice(0, -1)
    const nextTags = [...previousSegments, tag.name]
      .map(normalizeTagName)
      .filter(Boolean)

    onChange(`${nextTags.join(', ')}, `)
    setIsOpen(true)
  }

  return (
    <div className="tag-autocomplete">
      <input
        id={id}
        value={value}
        disabled={disabled}
        placeholder="frontend, urgente, revisão"
        autoComplete="off"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        role="combobox"
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          onBlur()
          window.setTimeout(() => setIsOpen(false), 100)
        }}
        onChange={(event) => onChange(event.target.value)}
      />

      {isOpen ? (
        <div className="tag-suggestions" id={listboxId} role="listbox">
          {suggestionsQuery.isPending ? (
            <span className="tag-suggestions-state">Buscando tags…</span>
          ) : suggestionsQuery.isError ? (
            <span className="tag-suggestions-state">
              Não foi possível carregar sugestões.
            </span>
          ) : suggestions.length > 0 ? (
            suggestions.map((tag) => (
              <button
                key={tag.id}
                type="button"
                role="option"
                aria-selected="false"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectSuggestion(tag)}
              >
                {tag.name}
              </button>
            ))
          ) : (
            <span className="tag-suggestions-state">
              {activeSearch
                ? 'Nenhuma tag existente. O novo nome será criado ao salvar.'
                : 'Digite para buscar ou crie uma nova tag.'}
            </span>
          )}
        </div>
      ) : null}
    </div>
  )
}
````

### `frontend/src/features/tags/components/TagAutocompleteInput.test.tsx`

````tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TagAutocompleteInput } from './TagAutocompleteInput'

function ControlledTagInput() {
  const [value, setValue] = useState('')

  return (
    <>
      <label htmlFor="tags">Tags</label>
      <TagAutocompleteInput
        id="tags"
        value={value}
        onChange={setValue}
        onBlur={() => undefined}
      />
    </>
  )
}

function renderInput() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ControlledTagInput />
    </QueryClientProvider>,
  )
}

describe('TagAutocompleteInput', () => {
  it('loads existing tags and inserts the selected suggestion', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)

      if (url.includes('/tags?')) {
        return new Response(
          JSON.stringify([
            {
              id: 'tag-1',
              name: 'frontend',
              created_at: '2026-08-01T00:00:00Z',
              updated_at: '2026-08-01T00:00:00Z',
            },
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      throw new Error(`Requisição não simulada: ${url}`)
    })

    renderInput()

    const input = screen.getByRole('combobox', { name: 'Tags' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'front' } })

    fireEvent.mouseDown(
      await screen.findByRole('option', { name: 'frontend' }),
    )
    fireEvent.click(screen.getByRole('option', { name: 'frontend' }))

    expect(input).toHaveValue('frontend, ')
  })
})
````

### `frontend/src/features/attachments/api.ts`

````typescript
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
````

### `frontend/src/features/attachments/hooks.ts`

````typescript
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
````

### `frontend/src/features/attachments/components/TaskAttachmentsDialog.tsx`

````tsx
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
````

### `frontend/src/features/attachments/components/TaskAttachmentsDialog.test.tsx`

````tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Task, TaskAttachment } from '../../tasks/types'
import { TaskAttachmentsDialog } from './TaskAttachmentsDialog'

const attachment: TaskAttachment = {
  id: 'attachment-1',
  task_id: 'task-1',
  name: 'requisitos.pdf',
  url: '/api/v1/attachments/attachment-1/content',
  content_type: 'application/pdf',
  size_bytes: 2048,
  created_at: '2026-08-01T00:00:00Z',
}

const task: Task = {
  id: 'task-1',
  project_id: 'project-1',
  title: 'Revisar requisitos',
  short_description: 'Conferir o escopo obrigatório.',
  description: null,
  status: 'todo',
  priority: 'medium',
  due_at: null,
  tags: [],
  attachments: [],
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function requestDetails(input: RequestInfo | URL, init?: RequestInit) {
  if (input instanceof Request) {
    return { url: input.url, method: input.method, body: input.body }
  }

  return {
    url: String(input),
    method: init?.method ?? 'GET',
    body: init?.body ?? null,
  }
}

function renderDialog(isReadOnly = false) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <TaskAttachmentsDialog
        task={task}
        isReadOnly={isReadOnly}
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  )
}

describe('TaskAttachmentsDialog', () => {
  it('uploads a valid file and updates the visible list', async () => {
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockImplementation(async (input, init) => {
        const { url, method } = requestDetails(input, init)

        if (url.endsWith('/tasks/task-1/attachments') && method === 'GET') {
          return jsonResponse([])
        }

        if (url.endsWith('/tasks/task-1/attachments') && method === 'POST') {
          return jsonResponse(attachment, 201)
        }

        throw new Error(`Requisição não simulada: ${method} ${url}`)
      })

    renderDialog()

    const file = new File(['conteúdo'], 'requisitos.pdf', {
      type: 'application/pdf',
    })
    fireEvent.change(await screen.findByLabelText('Novo anexo'), {
      target: { files: [file] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar arquivo' }))

    expect(await screen.findByText('requisitos.pdf')).toBeVisible()

    const postCall = fetchSpy.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(postCall?.[1]?.body).toBeInstanceOf(FormData)
    expect((postCall?.[1]?.body as FormData).get('file')).toBe(file)
  })

  it('downloads and deletes an existing attachment', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:attachment'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(() => undefined),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    )

    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockImplementation(async (input, init) => {
        const { url, method } = requestDetails(input, init)

        if (url.endsWith('/tasks/task-1/attachments') && method === 'GET') {
          return jsonResponse([attachment])
        }

        if (
          url.endsWith('/attachments/attachment-1/content') &&
          method === 'GET'
        ) {
          return new Response(new Blob(['pdf'], { type: 'application/pdf' }), {
            status: 200,
          })
        }

        if (url.endsWith('/attachments/attachment-1') && method === 'DELETE') {
          return new Response(null, { status: 204 })
        }

        throw new Error(`Requisição não simulada: ${method} ${url}`)
      })

    renderDialog()

    expect(await screen.findByText('requisitos.pdf')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Baixar' }))

    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.some(([input]) =>
          String(input).includes('/attachments/attachment-1/content'),
        ),
      ).toBe(true),
    )

    const deleteButton = screen.getByRole('button', { name: 'Excluir' })
    await waitFor(() => expect(deleteButton).toBeEnabled())
    fireEvent.click(deleteButton)
    await waitFor(() =>
      expect(screen.queryByText('requisitos.pdf')).not.toBeInTheDocument(),
    )
  })

  it('keeps attachments available for download in a read-only project', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(jsonResponse([attachment]))

    renderDialog(true)

    expect(await screen.findByText('requisitos.pdf')).toBeVisible()
    expect(screen.queryByLabelText('Novo anexo')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Baixar' })).toBeVisible()
  })
})
````

### `frontend/src/features/tasks/components/TaskFormDialog.tsx`

````tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { TagAutocompleteInput } from '../../tags/components/TagAutocompleteInput'
import { toDateTimeLocalValue, toUtcISOString } from '../date'
import type {
  Task,
  TaskFormSubmission,
  TaskPriority,
  TaskStatus,
} from '../types'

const taskStatuses = ['todo', 'in_progress', 'done', 'cancelled'] as const
const taskPriorities = ['low', 'medium', 'high'] as const

const statusLabels: Record<TaskStatus, string> = {
  todo: 'Não iniciada',
  in_progress: 'Em andamento',
  done: 'Concluída',
  cancelled: 'Cancelada',
}

const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}

function normalizeTags(value: string): string[] {
  const uniqueTags = new Map<string, string>()

  for (const rawTag of value.split(',')) {
    const tag = rawTag.trim().replace(/\s+/g, ' ')

    if (tag) {
      uniqueTags.set(tag.toLocaleLowerCase('pt-BR'), tag)
    }
  }

  return [...uniqueTags.values()]
}

const taskFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, 'O título deve ter pelo menos 2 caracteres.')
      .max(180, 'O título deve ter no máximo 180 caracteres.'),
    shortDescription: z
      .string()
      .trim()
      .min(2, 'A descrição curta deve ter pelo menos 2 caracteres.')
      .max(280, 'A descrição curta deve ter no máximo 280 caracteres.'),
    description: z
      .string()
      .max(5000, 'A descrição completa deve ter no máximo 5000 caracteres.'),
    priority: z.enum(taskPriorities),
    status: z.enum(taskStatuses),
    dueAt: z.string(),
    tagsText: z.string(),
  })
  .superRefine((values, context) => {
    if (values.dueAt && Number.isNaN(new Date(values.dueAt).getTime())) {
      context.addIssue({
        code: 'custom',
        path: ['dueAt'],
        message: 'Informe uma data e hora válidas.',
      })
    }

    const tags = normalizeTags(values.tagsText)

    if (tags.length > 10) {
      context.addIssue({
        code: 'custom',
        path: ['tagsText'],
        message: 'Informe no máximo 10 tags.',
      })
    }

    if (tags.some((tag) => tag.length > 40)) {
      context.addIssue({
        code: 'custom',
        path: ['tagsText'],
        message: 'Cada tag deve ter no máximo 40 caracteres.',
      })
    }
  })

type TaskFormData = z.infer<typeof taskFormSchema>

interface TaskFormDialogProps {
  task?: Task
  isPending: boolean
  errorMessage?: string | null
  onClose: () => void
  onSubmit: (payload: TaskFormSubmission) => Promise<void>
}

export function TaskFormDialog({
  task,
  isPending,
  errorMessage,
  onClose,
  onSubmit,
}: TaskFormDialogProps) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title ?? '',
      shortDescription: task?.short_description ?? '',
      description: task?.description ?? '',
      priority: task?.priority ?? 'medium',
      status: task?.status ?? 'todo',
      dueAt: toDateTimeLocalValue(task?.due_at ?? null),
      tagsText: task?.tags.map((tag) => tag.name).join(', ') ?? '',
    },
  })

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      title: values.title.trim(),
      short_description: values.shortDescription.trim(),
      description: values.description.trim() || null,
      priority: values.priority,
      due_at: toUtcISOString(values.dueAt),
      tags: normalizeTags(values.tagsText),
      status: task ? values.status : undefined,
    })
  })

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="task-dialog-title"
        aria-modal="true"
        className="task-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">{task ? 'Editar tarefa' : 'Nova tarefa'}</span>
            <h2 id="task-dialog-title">
              {task ? 'Atualize a tarefa' : 'Planeje o próximo trabalho'}
            </h2>
          </div>
          <button
            aria-label="Fechar formulário"
            className="icon-button"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form className="task-form" onSubmit={submit} noValidate>
          <div className="field-group task-field-full">
            <label htmlFor="task-title">Título</label>
            <input
              id="task-title"
              placeholder="Ex.: Revisar fluxo de autenticação"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'task-title-error' : undefined}
              {...register('title')}
            />
            {errors.title ? (
              <span className="field-error" id="task-title-error">
                {errors.title.message}
              </span>
            ) : null}
          </div>

          <div className="field-group task-field-full">
            <label htmlFor="task-short-description">Descrição curta</label>
            <textarea
              id="task-short-description"
              placeholder="Resuma o resultado esperado desta tarefa."
              rows={3}
              aria-invalid={Boolean(errors.shortDescription)}
              aria-describedby={
                errors.shortDescription ? 'task-short-description-error' : undefined
              }
              {...register('shortDescription')}
            />
            {errors.shortDescription ? (
              <span className="field-error" id="task-short-description-error">
                {errors.shortDescription.message}
              </span>
            ) : null}
          </div>

          <div className="field-group task-field-full">
            <label htmlFor="task-description">Descrição completa</label>
            <textarea
              id="task-description"
              placeholder="Inclua contexto, critérios de aceite e observações."
              rows={6}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description ? 'task-description-error' : undefined
              }
              {...register('description')}
            />
            {errors.description ? (
              <span className="field-error" id="task-description-error">
                {errors.description.message}
              </span>
            ) : null}
          </div>

          <div className="field-group">
            <label htmlFor="task-priority">Prioridade</label>
            <select id="task-priority" {...register('priority')}>
              {taskPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priorityLabels[priority]}
                </option>
              ))}
            </select>
          </div>

          {task ? (
            <div className="field-group">
              <label htmlFor="task-status">Status</label>
              <select id="task-status" {...register('status')}>
                {taskStatuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="field-group">
            <label htmlFor="task-due-at">Prazo</label>
            <input
              id="task-due-at"
              type="datetime-local"
              aria-invalid={Boolean(errors.dueAt)}
              aria-describedby={errors.dueAt ? 'task-due-at-error' : undefined}
              {...register('dueAt')}
            />
            {errors.dueAt ? (
              <span className="field-error" id="task-due-at-error">
                {errors.dueAt.message}
              </span>
            ) : null}
          </div>

          <div className="field-group task-field-full">
            <label htmlFor="task-tags">Tags</label>
            <Controller
              control={control}
              name="tagsText"
              render={({ field }) => (
                <TagAutocompleteInput
                  id="task-tags"
                  value={field.value}
                  disabled={isPending}
                  invalid={Boolean(errors.tagsText)}
                  describedBy="task-tags-hint"
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
            <span className="field-hint" id="task-tags-hint">
              Separe as tags por vírgula ou selecione uma sugestão. Máximo de 10 tags.
            </span>
            {errors.tagsText ? (
              <span className="field-error">{errors.tagsText.message}</span>
            ) : null}
          </div>

          {errorMessage ? (
            <div className="form-error task-field-full" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <div className="dialog-actions task-field-full">
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button className="primary-button" type="submit" disabled={isPending}>
              {isPending
                ? 'Salvando…'
                : task
                  ? 'Salvar alterações'
                  : 'Criar tarefa'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
````

### `frontend/src/features/tasks/components/TaskListItem.tsx`

````tsx
import { formatDueAt, isTaskOverdue } from '../date'
import type { Task, TaskPriority, TaskStatus } from '../types'

const statusLabels: Record<TaskStatus, string> = {
  todo: 'Não iniciada',
  in_progress: 'Em andamento',
  done: 'Concluída',
  cancelled: 'Cancelada',
}

const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}

interface TaskListItemProps {
  task: Task
  isBusy: boolean
  isReadOnly: boolean
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onAttachments: (task: Task) => void
  onStatusChange: (task: Task, status: TaskStatus) => void
}

export function TaskListItem({
  task,
  isBusy,
  isReadOnly,
  onEdit,
  onDelete,
  onAttachments,
  onStatusChange,
}: TaskListItemProps) {
  const overdue = isTaskOverdue(task.due_at, task.status)

  return (
    <article className={`task-list-item task-status-${task.status}`}>
      <div className="task-list-main">
        <div className="task-list-badges">
          <span className={`task-status-badge task-status-badge-${task.status}`}>
            {statusLabels[task.status]}
          </span>
          <span className={`priority-badge priority-${task.priority}`}>
            Prioridade {priorityLabels[task.priority].toLocaleLowerCase('pt-BR')}
          </span>
          {overdue ? <span className="overdue-badge">Prazo vencido</span> : null}
        </div>

        <div className="task-list-copy">
          <h3>{task.title}</h3>
          <p>{task.short_description}</p>
        </div>

        {task.tags.length > 0 ? (
          <ul className="task-tags" aria-label={`Tags de ${task.title}`}>
            {task.tags.map((tag) => (
              <li key={tag.id}>{tag.name}</li>
            ))}
          </ul>
        ) : null}

        <div className="task-metadata">
          <span>
            {task.due_at ? (
              <>
                Prazo:{' '}
                <time dateTime={task.due_at}>{formatDueAt(task.due_at)}</time>
              </>
            ) : (
              'Sem prazo definido'
            )}
          </span>
          <span>
            {task.attachments.length}{' '}
            {task.attachments.length === 1 ? 'anexo' : 'anexos'}
          </span>
        </div>

        {task.description ? (
          <details className="task-description-details">
            <summary>Ver descrição completa</summary>
            <p>{task.description}</p>
          </details>
        ) : null}
      </div>

      <div className="task-list-actions">
        <label className="task-status-control">
          <span>Status</span>
          <select
            aria-label={`Status de ${task.title}`}
            value={task.status}
            disabled={isBusy || isReadOnly}
            onChange={(event) =>
              onStatusChange(task, event.target.value as TaskStatus)
            }
          >
            {Object.entries(statusLabels).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="task-row-buttons">
          <button
            className="secondary-button"
            type="button"
            disabled={isBusy}
            onClick={() => onAttachments(task)}
          >
            Anexos
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={isBusy || isReadOnly}
            onClick={() => onEdit(task)}
          >
            Editar
          </button>
          <button
            className="danger-text-button"
            type="button"
            disabled={isBusy || isReadOnly}
            onClick={() => onDelete(task)}
          >
            Excluir
          </button>
        </div>
      </div>
    </article>
  )
}
````

### `frontend/src/features/tasks/components/KanbanTaskCard.tsx`

````tsx
import { useDraggable } from '@dnd-kit/core'
import type { CSSProperties } from 'react'
import { formatDueAt, isTaskOverdue } from '../date'
import type { Task, TaskPriority, TaskStatus } from '../types'

const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}

const statusLabels: Record<TaskStatus, string> = {
  todo: 'Não iniciada',
  in_progress: 'Em andamento',
  done: 'Concluída',
  cancelled: 'Cancelada',
}

interface KanbanTaskCardContentProps {
  task: Task
  isOverlay?: boolean
  isBusy?: boolean
  isReadOnly?: boolean
  onEdit?: (task: Task) => void
  onDelete?: (task: Task) => void
  onAttachments?: (task: Task) => void
  onStatusChange?: (task: Task, status: TaskStatus) => void
}

export function KanbanTaskCardContent({
  task,
  isOverlay = false,
  isBusy = false,
  isReadOnly = false,
  onEdit,
  onDelete,
  onAttachments,
  onStatusChange,
}: KanbanTaskCardContentProps) {
  const overdue = isTaskOverdue(task.due_at, task.status)

  return (
    <div className="kanban-card-content">
      <div className="kanban-card-topline">
        <span className={`priority-badge priority-${task.priority}`}>
          {priorityLabels[task.priority]}
        </span>
        {overdue ? <span className="overdue-badge">Vencida</span> : null}
      </div>

      <div className="kanban-card-copy">
        <h4>{task.title}</h4>
        <p>{task.short_description}</p>
      </div>

      {task.tags.length > 0 ? (
        <ul className="task-tags kanban-card-tags" aria-label={`Tags de ${task.title}`}>
          {task.tags.slice(0, 3).map((tag) => (
            <li key={tag.id}>{tag.name}</li>
          ))}
          {task.tags.length > 3 ? <li>+{task.tags.length - 3}</li> : null}
        </ul>
      ) : null}

      <div className="kanban-card-meta">
        <span>
          {task.due_at ? (
            <time dateTime={task.due_at}>{formatDueAt(task.due_at)}</time>
          ) : (
            'Sem prazo'
          )}
        </span>
        <span>
          {task.attachments.length} {task.attachments.length === 1 ? 'anexo' : 'anexos'}
        </span>
      </div>

      {!isOverlay ? (
        <div className="kanban-card-actions">
          <label className="kanban-status-fallback">
            <span className="sr-only">Mover {task.title} para outra coluna</span>
            <select
              aria-label={`Mover ${task.title} para outra coluna`}
              value={task.status}
              disabled={isBusy || isReadOnly}
              onChange={(event) =>
                onStatusChange?.(task, event.target.value as TaskStatus)
              }
            >
              {Object.entries(statusLabels).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="kanban-card-buttons">
            <button
              className="text-button"
              type="button"
              disabled={isBusy}
              onClick={() => onAttachments?.(task)}
            >
              Anexos
            </button>
            <button
              className="text-button"
              type="button"
              disabled={isBusy || isReadOnly}
              onClick={() => onEdit?.(task)}
            >
              Editar
            </button>
            <button
              className="text-button danger-text-button"
              type="button"
              disabled={isBusy || isReadOnly}
              onClick={() => onDelete?.(task)}
            >
              Excluir
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

interface KanbanTaskCardProps {
  task: Task
  isBusy: boolean
  isReadOnly: boolean
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onAttachments: (task: Task) => void
  onStatusChange: (task: Task, status: TaskStatus) => void
}

export function KanbanTaskCard({
  task,
  isBusy,
  isReadOnly,
  onEdit,
  onDelete,
  onAttachments,
  onStatusChange,
}: KanbanTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: task.id,
    data: { task, status: task.status },
    disabled: isBusy || isReadOnly,
  })

  const style: CSSProperties | undefined = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`kanban-task-card${isDragging ? ' is-dragging' : ''}`}
    >
      <button
        ref={setActivatorNodeRef}
        className="kanban-drag-handle"
        type="button"
        aria-label={`Arrastar tarefa ${task.title}`}
        disabled={isBusy || isReadOnly}
        {...attributes}
        {...listeners}
      >
        <span aria-hidden="true">⋮⋮</span>
      </button>

      <KanbanTaskCardContent
        task={task}
        isBusy={isBusy}
        isReadOnly={isReadOnly}
        onEdit={onEdit}
        onDelete={onDelete}
        onAttachments={onAttachments}
        onStatusChange={onStatusChange}
      />
    </article>
  )
}
````

### `frontend/src/features/tasks/components/KanbanColumn.tsx`

````tsx
import { useDroppable } from '@dnd-kit/core'
import type { Task, TaskStatus } from '../types'
import { KanbanTaskCard } from './KanbanTaskCard'

interface KanbanColumnProps {
  status: TaskStatus
  title: string
  tasks: Task[]
  isBusy: boolean
  isReadOnly: boolean
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onAttachments: (task: Task) => void
  onStatusChange: (task: Task, status: TaskStatus) => void
}

export function KanbanColumn({
  status,
  title,
  tasks,
  isBusy,
  isReadOnly,
  onEdit,
  onDelete,
  onAttachments,
  onStatusChange,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { status },
    disabled: isReadOnly,
  })

  return (
    <section
      ref={setNodeRef}
      className={`kanban-column kanban-column-${status}${isOver ? ' is-over' : ''}`}
      aria-labelledby={`kanban-column-${status}`}
    >
      <header className="kanban-column-heading">
        <div>
          <span className={`kanban-column-marker marker-${status}`} aria-hidden="true" />
          <h3 id={`kanban-column-${status}`}>{title}</h3>
        </div>
        <span className="kanban-column-count" aria-label={`${tasks.length} tarefas`}>
          {tasks.length}
        </span>
      </header>

      <div className="kanban-column-body">
        {tasks.length === 0 ? (
          <p className="kanban-column-empty">
            {isReadOnly ? 'Nenhuma tarefa nesta coluna.' : 'Arraste uma tarefa para cá.'}
          </p>
        ) : (
          tasks.map((task) => (
            <KanbanTaskCard
              key={task.id}
              task={task}
              isBusy={isBusy}
              isReadOnly={isReadOnly}
              onEdit={onEdit}
              onDelete={onDelete}
              onAttachments={onAttachments}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </div>
    </section>
  )
}
````

### `frontend/src/features/tasks/components/KanbanBoard.tsx`

````tsx
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  useEffect,
  useRef,
  useState,
  type UIEvent,
} from 'react'
import type { Task, TaskStatus } from '../types'
import { KanbanColumn } from './KanbanColumn'
import { KanbanTaskCardContent } from './KanbanTaskCard'

const columns: Array<{ status: TaskStatus; title: string }> = [
  { status: 'todo', title: 'Não iniciada' },
  { status: 'in_progress', title: 'Em andamento' },
  { status: 'done', title: 'Concluída' },
  { status: 'cancelled', title: 'Cancelada' },
]

interface KanbanBoardProps {
  tasks: Task[]
  isBusy: boolean
  isReadOnly: boolean
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onAttachments: (task: Task) => void
  onStatusChange: (task: Task, status: TaskStatus) => void
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return columns.some((column) => column.status === value)
}

export function KanbanBoard({
  tasks,
  isBusy,
  isReadOnly,
  onEdit,
  onDelete,
  onAttachments,
  onStatusChange,
}: KanbanBoardProps) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)

  const topScrollRef = useRef<HTMLDivElement>(null)
  const topScrollContentRef = useRef<HTMLDivElement>(null)
  const boardScrollRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor),
  )

  const activeTask = activeTaskId
    ? tasks.find((task) => task.id === activeTaskId) ?? null
    : null

  useEffect(() => {
    const board = boardRef.current
    const topScrollContent = topScrollContentRef.current

    if (!board || !topScrollContent) {
      return
    }

    const updateTopScrollbarWidth = () => {
      // A barra superior precisa reproduzir a largura real do board,
      // inclusive quando o viewport ou as regras responsivas mudarem.
      topScrollContent.style.width = `${board.scrollWidth}px`
    }

    updateTopScrollbarWidth()
    window.addEventListener('resize', updateTopScrollbarWidth)

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        window.removeEventListener('resize', updateTopScrollbarWidth)
      }
    }

    const observer = new ResizeObserver(updateTopScrollbarWidth)
    observer.observe(board)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateTopScrollbarWidth)
    }
  }, [])

  const handleTopScroll = (event: UIEvent<HTMLDivElement>) => {
    const boardScroll = boardScrollRef.current

    if (
      boardScroll &&
      boardScroll.scrollLeft !== event.currentTarget.scrollLeft
    ) {
      boardScroll.scrollLeft = event.currentTarget.scrollLeft
    }
  }

  const handleBoardScroll = (event: UIEvent<HTMLDivElement>) => {
    const topScroll = topScrollRef.current

    if (
      topScroll &&
      topScroll.scrollLeft !== event.currentTarget.scrollLeft
    ) {
      topScroll.scrollLeft = event.currentTarget.scrollLeft
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null)

    const task = tasks.find(
      (item) => item.id === String(event.active.id),
    )

    const targetStatus = event.over?.data.current?.status

    if (
      !task ||
      !isTaskStatus(targetStatus) ||
      task.status === targetStatus
    ) {
      return
    }

    onStatusChange(task, targetStatus)
  }

  return (
    <div className="kanban-shell">
      <div
        ref={topScrollRef}
        className="kanban-scroll-top"
        role="region"
        aria-label="Rolagem horizontal do quadro kanban"
        tabIndex={0}
        onScroll={handleTopScroll}
      >
        <div
          ref={topScrollContentRef}
          className="kanban-scroll-top-content"
          aria-hidden="true"
        />
      </div>

      <div
        ref={boardScrollRef}
        className="kanban-scroll"
        aria-label="Quadro kanban de tarefas"
        onScroll={handleBoardScroll}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragCancel={() => setActiveTaskId(null)}
          onDragEnd={handleDragEnd}
        >
          <div
            ref={boardRef}
            className="kanban-board"
          >
            {columns.map((column) => (
              <KanbanColumn
                key={column.status}
                status={column.status}
                title={column.title}
                tasks={tasks.filter(
                  (task) => task.status === column.status,
                )}
                isBusy={isBusy}
                isReadOnly={isReadOnly}
                onEdit={onEdit}
                onDelete={onDelete}
                onAttachments={onAttachments}
                onStatusChange={onStatusChange}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="kanban-task-card kanban-task-overlay">
                <KanbanTaskCardContent
                  task={activeTask}
                  isOverlay
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
````

### `frontend/src/features/projects/pages/ProjectWorkspacePage.tsx`

````tsx
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../../api/client'
import { TaskAttachmentsDialog } from '../../attachments/components/TaskAttachmentsDialog'
import { KanbanBoard } from '../../tasks/components/KanbanBoard'
import { TaskFormDialog } from '../../tasks/components/TaskFormDialog'
import { TaskListItem } from '../../tasks/components/TaskListItem'
import {
  useCreateTask,
  useDeleteTask,
  useKanbanTasks,
  useMoveTaskStatus,
  useTasks,
  useUpdateTask,
} from '../../tasks/hooks'
import type {
  Task,
  TaskFormSubmission,
  TaskPriority,
  TaskStatus,
} from '../../tasks/types'
import { useProject } from '../hooks'

const PAGE_SIZE = 8

type StatusFilter = TaskStatus | 'all'
type PriorityFilter = TaskPriority | 'all'
type ViewMode = 'list' | 'kanban'

interface TaskActionOptions {
  removesItemFromCurrentPage?: boolean
}

const statusLabels: Record<StatusFilter, string> = {
  all: 'Todos os status',
  todo: 'Não iniciadas',
  in_progress: 'Em andamento',
  done: 'Concluídas',
  cancelled: 'Canceladas',
}

const priorityLabels: Record<PriorityFilter, string> = {
  all: 'Todas as prioridades',
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}

function getErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.detail
    : 'Não foi possível concluir a ação. Tente novamente.'
}

export function ProjectWorkspacePage() {
  const { projectId = '' } = useParams()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [attachmentsTask, setAttachmentsTask] = useState<Task | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const projectQuery = useProject(projectId)
  const tasksQuery = useTasks(
    {
      projectId,
      page,
      size: PAGE_SIZE,
      status: statusFilter === 'all' ? undefined : statusFilter,
      priority: priorityFilter === 'all' ? undefined : priorityFilter,
      search: search || undefined,
    },
    viewMode === 'list',
  )
  const kanbanQuery = useKanbanTasks(
    {
      projectId,
      priority: priorityFilter === 'all' ? undefined : priorityFilter,
      search: search || undefined,
    },
    viewMode === 'kanban',
  )

  const createMutation = useCreateTask()
  const updateMutation = useUpdateTask()
  const moveStatusMutation = useMoveTaskStatus()
  const deleteMutation = useDeleteTask()

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    moveStatusMutation.isPending ||
    deleteMutation.isPending

  const closeDialog = () => {
    if (isMutating) {
      return
    }

    setIsCreating(false)
    setEditingTask(null)
    setActionError(null)
  }

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSearch(searchInput.trim())
    setPage(1)
  }

  const clearFilters = () => {
    setStatusFilter('all')
    setPriorityFilter('all')
    setSearchInput('')
    setSearch('')
    setPage(1)
    setActionError(null)
  }

  const changeView = (nextView: ViewMode) => {
    setViewMode(nextView)
    setPage(1)
    setActionError(null)

    // O kanban sempre apresenta as quatro colunas. O filtro de status pertence
    // somente à lista e é limpo na troca para evitar um board incompleto.
    if (nextView === 'kanban') {
      setStatusFilter('all')
    }
  }

  const shouldReturnToPreviousPage = (removesItem: boolean) =>
    viewMode === 'list' &&
    removesItem &&
    page > 1 &&
    (tasksQuery.data?.items.length ?? 0) === 1

  const runTaskAction = async (
    action: () => Promise<unknown>,
    options: TaskActionOptions = {},
  ) => {
    setActionError(null)
    const returnToPreviousPage = shouldReturnToPreviousPage(
      options.removesItemFromCurrentPage === true,
    )

    try {
      await action()

      if (returnToPreviousPage) {
        setPage((currentPage) => Math.max(currentPage - 1, 1))
      }
    } catch (error) {
      setActionError(getErrorMessage(error))
    }
  }

  const submitTask = async (payload: TaskFormSubmission) => {
    setActionError(null)

    try {
      if (editingTask) {
        const nextStatus = payload.status ?? editingTask.status
        const leavesCurrentFilter =
          viewMode === 'list' &&
          statusFilter !== 'all' &&
          nextStatus !== statusFilter
        const returnToPreviousPage = shouldReturnToPreviousPage(
          leavesCurrentFilter,
        )

        await updateMutation.mutateAsync({
          taskId: editingTask.id,
          payload,
        })

        if (returnToPreviousPage) {
          setPage((currentPage) => Math.max(currentPage - 1, 1))
        }
      } else {
        await createMutation.mutateAsync({
          project_id: projectId,
          title: payload.title,
          short_description: payload.short_description,
          description: payload.description,
          priority: payload.priority,
          due_at: payload.due_at,
          tags: payload.tags,
        })

        // A tarefa nasce como `todo`. Limpamos filtros para que ela fique
        // visível tanto na lista quanto na primeira coluna do kanban.
        setStatusFilter('all')
        setPriorityFilter('all')
        setSearchInput('')
        setSearch('')
        setPage(1)
      }

      setEditingTask(null)
      setIsCreating(false)
    } catch (error) {
      setActionError(getErrorMessage(error))
    }
  }

  const changeTaskStatus = (task: Task, status: TaskStatus) => {
    if (task.status === status) {
      return
    }

    const leavesCurrentFilter =
      viewMode === 'list' && statusFilter !== 'all' && status !== statusFilter

    void runTaskAction(
      () =>
        updateMutation.mutateAsync({
          taskId: task.id,
          payload: { status },
        }),
      { removesItemFromCurrentPage: leavesCurrentFilter },
    )
  }

  const moveTaskOnKanban = (task: Task, status: TaskStatus) => {
    if (task.status === status) {
      return
    }

    setActionError(null)

    // O hook aplica a mudança no cache antes do PATCH e restaura o snapshot
    // automaticamente se a persistência falhar.
    void moveStatusMutation
      .mutateAsync({ task, status })
      .catch((error: unknown) => setActionError(getErrorMessage(error)))
  }

  const deleteTask = (task: Task) => {
    const confirmed = window.confirm(
      `Excluir a tarefa “${task.title}”? Esta ação também removerá seus anexos.`,
    )

    if (!confirmed) {
      return
    }

    void runTaskAction(
      () => deleteMutation.mutateAsync(task.id),
      { removesItemFromCurrentPage: viewMode === 'list' },
    )
  }

  if (projectQuery.isPending) {
    return (
      <main className="project-workspace project-workspace-state" role="status">
        <div className="loading-orb" aria-hidden="true" />
        <p>Carregando projeto…</p>
      </main>
    )
  }

  if (projectQuery.isError) {
    return (
      <main className="project-workspace project-workspace-state" role="alert">
        <h1>Projeto indisponível</h1>
        <p>{getErrorMessage(projectQuery.error)}</p>
        <Link className="secondary-button link-button" to="/app">
          Voltar aos projetos
        </Link>
      </main>
    )
  }

  if (!projectQuery.data) {
    return (
      <main className="project-workspace project-workspace-state" role="alert">
        <h1>Projeto indisponível</h1>
        <p>A API não retornou os dados do projeto.</p>
        <Link className="secondary-button link-button" to="/app">
          Voltar aos projetos
        </Link>
      </main>
    )
  }

  const project = projectQuery.data
  const isReadOnly = project.status === 'archived'
  const tasks =
    viewMode === 'list' ? tasksQuery.data?.items ?? [] : kanbanQuery.data ?? []
  const total = viewMode === 'list' ? tasksQuery.data?.total ?? 0 : tasks.length
  const pages = viewMode === 'list' ? tasksQuery.data?.pages ?? 0 : 0
  const isTasksPending =
    viewMode === 'list' ? tasksQuery.isPending : kanbanQuery.isPending
  const isTasksError =
    viewMode === 'list' ? tasksQuery.isError : kanbanQuery.isError
  const tasksError =
    viewMode === 'list' ? tasksQuery.error : kanbanQuery.error
  const hasFilters =
    (viewMode === 'list' && statusFilter !== 'all') ||
    priorityFilter !== 'all' ||
    Boolean(search)

  return (
    <main className="project-workspace">
      <Link className="back-link" to="/app">
        ← Todos os projetos
      </Link>

      <section className="workspace-heading workspace-heading-with-action">
        <div>
          <span className={`status-badge status-${project.status}`}>
            {project.status === 'archived' ? 'Arquivado' : 'Ativo'}
          </span>
          <h1>{project.name}</h1>
          <p>{project.description || 'Projeto sem descrição.'}</p>
        </div>

        {!isReadOnly ? (
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setActionError(null)
              setIsCreating(true)
            }}
          >
            + Nova tarefa
          </button>
        ) : null}
      </section>

      {isReadOnly ? (
        <div className="read-only-banner" role="status">
          <strong>Projeto arquivado em modo somente leitura.</strong>
          <span>Restaure o projeto para criar, editar ou excluir tarefas.</span>
        </div>
      ) : null}

      <section className="tasks-panel">
        <div className="tasks-panel-heading">
          <div>
            <span className="eyebrow">Execução</span>
            <h2>Tarefas do projeto</h2>
          </div>
          <div className="view-toggle" aria-label="Visualização das tarefas">
            <button
              className={viewMode === 'list' ? 'is-active' : undefined}
              type="button"
              aria-pressed={viewMode === 'list'}
              onClick={() => changeView('list')}
            >
              Lista
            </button>
            <button
              className={viewMode === 'kanban' ? 'is-active' : undefined}
              type="button"
              aria-pressed={viewMode === 'kanban'}
              onClick={() => changeView('kanban')}
            >
              Kanban
            </button>
          </div>
        </div>

        <div
          className={`task-filters${viewMode === 'kanban' ? ' task-filters-kanban' : ''}`}
          aria-label="Filtros de tarefas"
        >
          {viewMode === 'list' ? (
            <div className="field-group compact-field">
              <label htmlFor="task-status-filter">Status</label>
              <select
                id="task-status-filter"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as StatusFilter)
                  setPage(1)
                }}
              >
                {Object.entries(statusLabels).map(([status, label]) => (
                  <option key={status} value={status}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="field-group compact-field">
            <label htmlFor="task-priority-filter">Prioridade</label>
            <select
              id="task-priority-filter"
              value={priorityFilter}
              onChange={(event) => {
                setPriorityFilter(event.target.value as PriorityFilter)
                setPage(1)
              }}
            >
              {Object.entries(priorityLabels).map(([priority, label]) => (
                <option key={priority} value={priority}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <form className="task-search" role="search" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="task-search-input">
              Buscar tarefas
            </label>
            <input
              id="task-search-input"
              type="search"
              placeholder="Buscar por título ou descrição"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <button className="secondary-button" type="submit">
              Buscar
            </button>
          </form>

          {hasFilters ? (
            <button
              className="text-button task-clear-filters"
              type="button"
              onClick={clearFilters}
            >
              Limpar filtros
            </button>
          ) : null}
        </div>

        {actionError ? (
          <div className="page-alert" role="alert">
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError(null)}>
              Fechar
            </button>
          </div>
        ) : null}

        {isTasksPending ? (
          <section className="tasks-state" role="status">
            <div className="loading-orb" aria-hidden="true" />
            <h3>Carregando tarefas</h3>
            <p>
              {viewMode === 'kanban'
                ? 'Montando todas as colunas do projeto.'
                : 'Organizando o trabalho deste projeto.'}
            </p>
          </section>
        ) : isTasksError ? (
          <section className="tasks-state tasks-state-error" role="alert">
            <span aria-hidden="true">!</span>
            <h3>Não foi possível carregar as tarefas</h3>
            <p>{getErrorMessage(tasksError)}</p>
            <button
              className="secondary-button"
              type="button"
              onClick={() =>
                void (viewMode === 'list'
                  ? tasksQuery.refetch()
                  : kanbanQuery.refetch())
              }
            >
              Tentar novamente
            </button>
          </section>
        ) : tasks.length === 0 ? (
          <section className="tasks-state tasks-empty">
            <span aria-hidden="true">✓</span>
            <h3>
              {hasFilters ? 'Nenhuma tarefa encontrada' : 'Nenhuma tarefa criada'}
            </h3>
            <p>
              {hasFilters
                ? 'Revise os filtros para encontrar outras tarefas.'
                : isReadOnly
                  ? 'Este projeto arquivado não possui tarefas.'
                  : 'Crie a primeira tarefa para começar a acompanhar a execução.'}
            </p>
            {!hasFilters && !isReadOnly ? (
              <button
                className="primary-button"
                type="button"
                onClick={() => setIsCreating(true)}
              >
                Criar tarefa
              </button>
            ) : null}
          </section>
        ) : (
          <>
            <div className="tasks-summary">
              <strong>{total}</strong> {total === 1 ? 'tarefa' : 'tarefas'}
              {search ? <span> para “{search}”</span> : null}
              {viewMode === 'kanban' ? (
                <span> · quadro completo do projeto</span>
              ) : null}
            </div>

            {viewMode === 'list' ? (
              <>
                <section className="task-list" aria-label="Lista de tarefas">
                  {tasks.map((task) => (
                    <TaskListItem
                      key={task.id}
                      task={task}
                      isBusy={isMutating}
                      isReadOnly={isReadOnly}
                      onEdit={(selectedTask) => {
                        setActionError(null)
                        setEditingTask(selectedTask)
                      }}
                      onDelete={deleteTask}
                      onAttachments={setAttachmentsTask}
                      onStatusChange={changeTaskStatus}
                    />
                  ))}
                </section>

                {pages > 1 ? (
                  <nav className="pagination" aria-label="Paginação de tarefas">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={page === 1 || tasksQuery.isFetching}
                      onClick={() =>
                        setPage((currentPage) => Math.max(1, currentPage - 1))
                      }
                    >
                      Anterior
                    </button>
                    <span>
                      Página {page} de {pages}
                    </span>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={page >= pages || tasksQuery.isFetching}
                      onClick={() => setPage((currentPage) => currentPage + 1)}
                    >
                      Próxima
                    </button>
                  </nav>
                ) : null}
              </>
            ) : (
              <KanbanBoard
                tasks={tasks}
                isBusy={isMutating}
                isReadOnly={isReadOnly}
                onEdit={(selectedTask) => {
                  setActionError(null)
                  setEditingTask(selectedTask)
                }}
                onDelete={deleteTask}
                onAttachments={setAttachmentsTask}
                onStatusChange={moveTaskOnKanban}
              />
            )}
          </>
        )}
      </section>

      {isCreating || editingTask ? (
        <TaskFormDialog
          task={editingTask ?? undefined}
          isPending={createMutation.isPending || updateMutation.isPending}
          errorMessage={actionError}
          onClose={closeDialog}
          onSubmit={submitTask}
        />
      ) : null}

      {attachmentsTask ? (
        <TaskAttachmentsDialog
          task={attachmentsTask}
          isReadOnly={isReadOnly}
          onClose={() => setAttachmentsTask(null)}
        />
      ) : null}
    </main>
  )
}
````

### `frontend/src/styles.css`

````css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');

:root {
  font-family: 'DM Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
    sans-serif;
  color: #172033;
  background: #f4f6fb;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  --ink: #172033;
  --muted: #687087;
  --line: #dfe4ef;
  --surface: #ffffff;
  --primary: #6556e8;
  --primary-dark: #4f42c8;
  --primary-soft: #efedff;
  --danger: #b42318;
  --danger-soft: #fff1f0;
  --success: #16835f;
  --shadow: 0 24px 70px rgba(44, 47, 88, 0.13);
}

* {
  box-sizing: border-box;
}

html {
  min-width: 320px;
  min-height: 100%;
}

body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
}

button,
input,
textarea {
  font: inherit;
}

button,
a {
  -webkit-tap-highlight-color: transparent;
}

a {
  color: inherit;
}

.auth-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(420px, 0.92fr);
  background: var(--surface);
}

.auth-hero {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: clamp(28px, 4vw, 64px);
  color: #ffffff;
  background:
    radial-gradient(circle at 15% 15%, rgba(173, 161, 255, 0.45), transparent 31%),
    radial-gradient(circle at 88% 81%, rgba(86, 209, 207, 0.22), transparent 30%),
    linear-gradient(145deg, #332979 0%, #5243be 46%, #6556e8 100%);
}

.auth-hero::after {
  content: '';
  position: absolute;
  width: 320px;
  height: 320px;
  right: -135px;
  top: 8%;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 50%;
  box-shadow:
    0 0 0 70px rgba(255, 255, 255, 0.035),
    0 0 0 140px rgba(255, 255, 255, 0.022);
}

.brand {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 11px;
  width: fit-content;
  color: #ffffff;
  text-decoration: none;
  font-family: 'Manrope', sans-serif;
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  color: #4f42c8;
  background: #ffffff;
  box-shadow: 0 10px 25px rgba(16, 12, 57, 0.2);
}

.brand-dark {
  color: var(--ink);
}

.brand-dark .brand-mark {
  color: #ffffff;
  background: var(--primary);
}

.hero-copy {
  position: relative;
  z-index: 1;
  width: min(640px, 92%);
  margin: auto 0 42px;
}

.hero-kicker,
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--primary);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.hero-kicker {
  color: rgba(255, 255, 255, 0.78);
}

.hero-copy h1 {
  max-width: 650px;
  margin: 18px 0 22px;
  font-family: 'Manrope', sans-serif;
  font-size: clamp(2.6rem, 5vw, 5.3rem);
  line-height: 0.98;
  letter-spacing: -0.065em;
}

.hero-copy p {
  max-width: 570px;
  margin: 0;
  color: rgba(255, 255, 255, 0.75);
  font-size: clamp(1rem, 1.3vw, 1.2rem);
  line-height: 1.65;
}

.hero-preview {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 22px;
  background: rgba(25, 20, 79, 0.28);
  box-shadow: 0 28px 60px rgba(19, 14, 65, 0.2);
  backdrop-filter: blur(16px);
}

.preview-column {
  min-height: 138px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.07);
}

.preview-column > span {
  display: block;
  margin-bottom: 12px;
  color: rgba(255, 255, 255, 0.68);
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
}

.preview-card {
  height: 34px;
  margin-top: 8px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.82);
}

.preview-card-large {
  height: 48px;
}

.preview-card-accent {
  height: 72px;
  background: #bbb3ff;
}

.preview-card-done {
  background: #81dfc3;
}

.auth-panel {
  display: grid;
  place-items: center;
  padding: clamp(28px, 6vw, 92px);
  background:
    linear-gradient(rgba(255, 255, 255, 0.91), rgba(255, 255, 255, 0.91)),
    radial-gradient(circle at 100% 0, #eae7ff, transparent 40%);
}

.auth-card {
  width: min(100%, 460px);
}

.auth-heading {
  margin-bottom: 34px;
}

.auth-heading h2,
.dashboard-welcome h1 {
  margin: 12px 0 12px;
  font-family: 'Manrope', sans-serif;
  font-size: clamp(2rem, 3vw, 3rem);
  line-height: 1.08;
  letter-spacing: -0.05em;
}

.auth-heading p,
.dashboard-welcome p {
  margin: 0;
  color: var(--muted);
  line-height: 1.65;
}

.auth-form {
  display: grid;
  gap: 20px;
}

.field-group {
  display: grid;
  gap: 8px;
}

.field-group label {
  color: #30384c;
  font-size: 0.88rem;
  font-weight: 700;
}

.field-group input {
  width: 100%;
  height: 52px;
  padding: 0 15px;
  border: 1px solid var(--line);
  border-radius: 13px;
  outline: none;
  color: var(--ink);
  background: #ffffff;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.field-group input::placeholder {
  color: #a1a8b8;
}

.field-group input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px var(--primary-soft);
}

.field-group input[aria-invalid='true'] {
  border-color: #e38a82;
}

.password-field {
  position: relative;
}

.password-field input {
  padding-right: 86px;
}

.password-toggle {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  border: 0;
  color: var(--primary);
  background: transparent;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

.field-error {
  color: var(--danger);
  font-size: 0.78rem;
}

.form-error {
  padding: 12px 14px;
  border: 1px solid #ffd2cd;
  border-radius: 12px;
  color: var(--danger);
  background: var(--danger-soft);
  font-size: 0.86rem;
}

.primary-button,
.secondary-button {
  min-height: 50px;
  border-radius: 13px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 160ms ease,
    background-color 160ms ease,
    opacity 160ms ease;
}

.primary-button {
  border: 0;
  color: #ffffff;
  background: var(--primary);
  box-shadow: 0 14px 30px rgba(101, 86, 232, 0.25);
}

.primary-button:hover:not(:disabled) {
  transform: translateY(-1px);
  background: var(--primary-dark);
}

.primary-button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.secondary-button {
  padding: 0 18px;
  border: 1px solid var(--line);
  color: var(--ink);
  background: #ffffff;
}

.secondary-button:hover {
  background: #f7f8fc;
}

.auth-switch {
  margin: 26px 0 0;
  color: var(--muted);
  text-align: center;
  font-size: 0.9rem;
}

.auth-switch a {
  color: var(--primary);
  font-weight: 700;
  text-decoration: none;
}

.loading-screen {
  min-height: 100vh;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 14px;
  color: var(--muted);
}

.loading-spinner {
  width: 34px;
  height: 34px;
  border: 3px solid #ddd9ff;
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 700ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.application-shell {
  min-height: 100vh;
  background: #f4f6fb;
}

.app-header {
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 clamp(22px, 5vw, 72px);
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(14px);
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 18px;
}

.user-summary {
  display: grid;
  justify-items: end;
  font-size: 0.82rem;
}

.user-summary span {
  color: var(--muted);
}

.dashboard-page {
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
  padding: clamp(54px, 8vw, 100px) 0;
}

.dashboard-welcome {
  max-width: 700px;
}

.foundation-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-top: 48px;
}

.foundation-grid article {
  min-height: 210px;
  padding: 28px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 12px 40px rgba(48, 52, 84, 0.06);
}

.foundation-grid article > span {
  color: var(--primary);
  font-family: 'Manrope', sans-serif;
  font-size: 0.8rem;
  font-weight: 800;
}

.foundation-grid h2 {
  margin: 34px 0 10px;
  font-family: 'Manrope', sans-serif;
  font-size: 1.2rem;
  letter-spacing: -0.03em;
}

.foundation-grid p {
  margin: 0;
  color: var(--muted);
  line-height: 1.55;
}

@media (max-width: 980px) {
  .auth-page {
    grid-template-columns: 1fr;
  }

  .auth-hero {
    min-height: auto;
    padding-bottom: 42px;
  }

  .hero-copy {
    margin: 90px 0 34px;
  }

  .hero-preview {
    display: none;
  }

  .auth-panel {
    min-height: 620px;
  }
}

@media (max-width: 720px) {
  .auth-hero {
    padding: 24px;
  }

  .hero-copy {
    width: 100%;
    margin-top: 70px;
  }

  .hero-copy h1 {
    font-size: clamp(2.45rem, 13vw, 4rem);
  }

  .auth-panel {
    min-height: auto;
    padding: 48px 24px 64px;
  }

  .app-header {
    height: auto;
    align-items: flex-start;
    padding-top: 18px;
    padding-bottom: 18px;
  }

  .user-summary {
    display: none;
  }

  .foundation-grid {
    grid-template-columns: 1fr;
  }
}


/* Project management */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.projects-page,
.project-workspace {
  width: min(1240px, calc(100% - 40px));
  margin: 0 auto;
  padding: clamp(38px, 6vw, 72px) 0 80px;
}

.projects-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
}

.projects-hero > div {
  max-width: 720px;
}

.projects-hero h1,
.workspace-heading h1 {
  margin: 10px 0 10px;
  font-family: 'Manrope', sans-serif;
  font-size: clamp(2.4rem, 5vw, 4.4rem);
  line-height: 1;
  letter-spacing: -0.06em;
}

.projects-hero p,
.workspace-heading p,
.workspace-placeholder p {
  margin: 0;
  color: var(--muted);
  line-height: 1.65;
}

.projects-hero > .primary-button,
.projects-empty .primary-button {
  padding: 0 22px;
  white-space: nowrap;
}

.projects-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin: 38px 0 26px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 10px 35px rgba(48, 52, 84, 0.05);
}

.project-tabs {
  display: inline-flex;
  gap: 6px;
  padding: 4px;
  border-radius: 13px;
  background: #f0f2f8;
}

.project-tabs button,
.text-button,
.project-actions button,
.icon-button,
.page-alert button {
  border: 0;
  cursor: pointer;
  font-weight: 700;
}

.project-tabs button {
  min-height: 40px;
  padding: 0 17px;
  border-radius: 10px;
  color: var(--muted);
  background: transparent;
}

.project-tabs button.is-active {
  color: var(--primary-dark);
  background: #ffffff;
  box-shadow: 0 5px 16px rgba(48, 52, 84, 0.08);
}

.project-search {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: min(100%, 480px);
}

.project-search input {
  min-width: 0;
  flex: 1;
  height: 46px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  outline: none;
  color: var(--ink);
  background: #ffffff;
}

.project-search input:focus,
.project-form input:focus,
.project-form textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px rgba(101, 86, 232, 0.12);
}

.project-search .secondary-button {
  min-height: 46px;
}

.text-button {
  padding: 8px;
  color: var(--primary-dark);
  background: transparent;
}

.page-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
  padding: 14px 16px;
  border: 1px solid #ffd2cd;
  border-radius: 14px;
  color: var(--danger);
  background: var(--danger-soft);
}

.page-alert button {
  color: inherit;
  background: transparent;
}

.projects-summary {
  margin-bottom: 16px;
  color: var(--muted);
  font-size: 0.9rem;
}

.projects-summary strong {
  color: var(--ink);
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.project-card {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--surface);
  box-shadow: 0 14px 45px rgba(48, 52, 84, 0.055);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease;
}

.project-card:hover {
  transform: translateY(-2px);
  border-color: #cbc5ff;
  box-shadow: 0 20px 55px rgba(48, 52, 84, 0.1);
}

.project-card-topline,
.project-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.status-badge {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
}

.status-active {
  color: #0e6f50;
  background: #e8f8f1;
}

.status-archived {
  color: #626a7d;
  background: #eef0f5;
}

.project-updated {
  color: #8a91a3;
  font-size: 0.74rem;
}

.project-card-content {
  flex: 1;
  padding: 27px 0 24px;
}

.project-card-content h2 {
  margin: 0 0 10px;
  font-family: 'Manrope', sans-serif;
  font-size: 1.25rem;
  letter-spacing: -0.035em;
}

.project-card-content p {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--muted);
  line-height: 1.58;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

.project-card-footer {
  align-items: flex-end;
  padding-top: 16px;
  border-top: 1px solid #edf0f5;
}

.project-open-link,
.back-link,
.link-button {
  color: var(--primary-dark);
  font-weight: 800;
  text-decoration: none;
}

.project-open-link:hover,
.back-link:hover {
  text-decoration: underline;
}

.project-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 5px;
}

.project-actions button {
  padding: 6px;
  color: var(--muted);
  background: transparent;
  font-size: 0.76rem;
}

.project-actions button:hover:not(:disabled) {
  color: var(--primary-dark);
}

.project-actions .danger-text-button:hover:not(:disabled) {
  color: var(--danger);
}

.project-actions button:disabled {
  cursor: wait;
  opacity: 0.5;
}

.projects-state {
  min-height: 360px;
  display: grid;
  place-content: center;
  justify-items: center;
  padding: 40px;
  border: 1px dashed #ccd2df;
  border-radius: 22px;
  color: var(--muted);
  text-align: center;
  background: rgba(255, 255, 255, 0.6);
}

.projects-state > span {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 18px;
  color: var(--primary);
  background: var(--primary-soft);
  font-size: 1.5rem;
  font-weight: 800;
}

.projects-state h2 {
  margin: 18px 0 8px;
  color: var(--ink);
  font-family: 'Manrope', sans-serif;
  letter-spacing: -0.035em;
}

.projects-state p {
  max-width: 480px;
  margin: 0 0 20px;
  line-height: 1.6;
}

.loading-orb {
  width: 38px;
  height: 38px;
  border: 3px solid #ddd9ff;
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 700ms linear infinite;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin-top: 30px;
  color: var(--muted);
  font-size: 0.88rem;
}

.pagination .secondary-button {
  min-height: 42px;
}

.pagination button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.dialog-backdrop {
  position: fixed;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(23, 32, 51, 0.52);
  backdrop-filter: blur(5px);
}

.project-dialog {
  width: min(100%, 590px);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  padding: 28px;
  border-radius: 22px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.dialog-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 25px;
}

.dialog-heading h2 {
  margin: 8px 0 0;
  font-family: 'Manrope', sans-serif;
  font-size: 1.65rem;
  letter-spacing: -0.045em;
}

.icon-button {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  color: var(--muted);
  background: #f2f4f8;
  font-size: 1.4rem;
}

.project-form {
  display: grid;
  gap: 20px;
}

.project-form input,
.project-form textarea {
  width: 100%;
  padding: 14px 15px;
  border: 1px solid var(--line);
  border-radius: 13px;
  outline: none;
  color: var(--ink);
  background: #ffffff;
  resize: vertical;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}

.dialog-actions .primary-button {
  padding: 0 22px;
}

.project-workspace .back-link {
  display: inline-flex;
  margin-bottom: 30px;
}

.workspace-heading {
  padding: clamp(28px, 5vw, 54px);
  border: 1px solid var(--line);
  border-radius: 24px;
  background:
    radial-gradient(circle at 100% 0, rgba(101, 86, 232, 0.13), transparent 36%),
    #ffffff;
  box-shadow: 0 16px 50px rgba(48, 52, 84, 0.06);
}

.workspace-heading p {
  max-width: 720px;
}

.workspace-placeholder {
  margin-top: 22px;
  padding: 34px;
  border: 1px dashed #cfd4e0;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.58);
}

.workspace-placeholder h2 {
  margin: 9px 0 8px;
  font-family: 'Manrope', sans-serif;
  letter-spacing: -0.04em;
}

.project-workspace-state {
  min-height: 460px;
  display: grid;
  place-content: center;
  justify-items: center;
  text-align: center;
}

.link-button {
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  padding: 0 18px;
}

@media (max-width: 1020px) {
  .projects-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .projects-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .project-search {
    min-width: 0;
    width: 100%;
  }
}

@media (max-width: 700px) {
  .projects-page,
  .project-workspace {
    width: min(100% - 28px, 1240px);
    padding-top: 30px;
  }

  .projects-hero {
    align-items: stretch;
    flex-direction: column;
  }

  .projects-hero > .primary-button {
    width: 100%;
  }

  .projects-grid {
    grid-template-columns: 1fr;
  }

  .project-search {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .project-search input {
    flex-basis: 100%;
  }

  .project-search .secondary-button {
    flex: 1;
  }

  .project-card-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .project-actions {
    justify-content: flex-start;
  }

  .dialog-actions {
    flex-direction: column-reverse;
  }

  .dialog-actions button {
    width: 100%;
  }
}

/* Etapa 07: lista e formulário de tarefas. */
.workspace-heading-with-action {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 28px;
}

.workspace-heading-with-action h1 {
  margin-bottom: 10px;
}

.workspace-heading-with-action > .primary-button {
  flex: 0 0 auto;
}

.read-only-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 18px;
  padding: 15px 18px;
  border: 1px solid #d7d2ff;
  border-radius: 14px;
  color: #5146a7;
  background: var(--primary-soft);
}

.tasks-panel {
  margin-top: 22px;
  padding: clamp(22px, 4vw, 34px);
  border: 1px solid var(--line);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 16px 50px rgba(48, 52, 84, 0.05);
}

.tasks-panel-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.tasks-panel-heading h2 {
  margin: 8px 0 0;
  font-family: 'Manrope', sans-serif;
  font-size: clamp(1.55rem, 3vw, 2rem);
  letter-spacing: -0.045em;
}

.view-toggle {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #f5f6fa;
}

.view-toggle button {
  min-height: 36px;
  padding: 0 14px;
  border-radius: 9px;
  color: var(--muted);
  background: transparent;
  font-size: 0.84rem;
  font-weight: 700;
}

.view-toggle button.is-active {
  color: var(--primary-dark);
  background: #ffffff;
  box-shadow: 0 4px 14px rgba(55, 48, 128, 0.11);
}

.view-toggle button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.task-filters {
  display: grid;
  grid-template-columns: minmax(150px, 0.7fr) minmax(150px, 0.7fr) minmax(270px, 1.7fr) auto;
  align-items: end;
  gap: 12px;
  margin-top: 28px;
  padding: 16px;
  border-radius: 16px;
  background: #f6f7fb;
}

.compact-field {
  gap: 6px;
}

.compact-field label {
  font-size: 0.77rem;
}

.compact-field select,
.task-search input,
.task-status-control select,
.task-form input,
.task-form textarea,
.task-form select {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 11px;
  outline: none;
  color: var(--ink);
  background: #ffffff;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.compact-field select:focus,
.task-search input:focus,
.task-status-control select:focus,
.task-form input:focus,
.task-form textarea:focus,
.task-form select:focus {
  border-color: #948af1;
  box-shadow: 0 0 0 4px rgba(101, 86, 232, 0.11);
}

.task-search {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-search input {
  min-width: 0;
}

.task-search .secondary-button {
  flex: 0 0 auto;
  min-height: 44px;
}

.task-clear-filters {
  align-self: center;
  white-space: nowrap;
}

.tasks-summary {
  margin: 24px 0 13px;
  color: var(--muted);
  font-size: 0.88rem;
}

.tasks-summary strong {
  color: var(--ink);
}

.task-list {
  display: grid;
  gap: 14px;
}

.task-list-item {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 190px;
  gap: 24px;
  padding: 22px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 17px;
  background: #ffffff;
  box-shadow: 0 8px 25px rgba(47, 51, 80, 0.035);
}

.task-list-item::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: #a7adbd;
}

.task-list-item.task-status-in_progress::before {
  background: #6f63e8;
}

.task-list-item.task-status-done::before {
  background: #2a9d75;
}

.task-list-item.task-status-cancelled::before {
  background: #c1c5d0;
}

.task-list-main {
  min-width: 0;
}

.task-list-badges {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}

.task-status-badge,
.priority-badge,
.overdue-badge {
  display: inline-flex;
  align-items: center;
  min-height: 25px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
}

.task-status-badge-todo {
  color: #5d6474;
  background: #eef0f4;
}

.task-status-badge-in_progress {
  color: #5145bb;
  background: #efedff;
}

.task-status-badge-done {
  color: #147052;
  background: #e5f7f0;
}

.task-status-badge-cancelled {
  color: #707584;
  background: #f0f1f4;
  text-decoration: line-through;
}

.priority-low {
  color: #336b67;
  background: #e8f5f3;
}

.priority-medium {
  color: #8a5b14;
  background: #fff4d8;
}

.priority-high {
  color: #a12c24;
  background: #fff0ee;
}

.overdue-badge {
  color: var(--danger);
  background: var(--danger-soft);
}

.task-list-copy h3 {
  margin: 13px 0 6px;
  font-family: 'Manrope', sans-serif;
  font-size: 1.12rem;
  letter-spacing: -0.025em;
}

.task-list-copy p {
  margin: 0;
  color: var(--muted);
  line-height: 1.55;
}

.task-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.task-tags li {
  padding: 5px 9px;
  border: 1px solid #dedafc;
  border-radius: 9px;
  color: #594fc2;
  background: #f7f6ff;
  font-size: 0.73rem;
  font-weight: 600;
}

.task-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 14px;
  color: var(--muted);
  font-size: 0.78rem;
}

.task-description-details {
  margin-top: 14px;
  color: var(--muted);
  font-size: 0.84rem;
}

.task-description-details summary {
  width: fit-content;
  cursor: pointer;
  color: var(--primary-dark);
  font-weight: 700;
}

.task-description-details p {
  max-width: 820px;
  margin: 10px 0 0;
  padding: 13px 15px;
  border-radius: 11px;
  white-space: pre-wrap;
  line-height: 1.6;
  background: #f7f7fa;
}

.task-list-actions {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 20px;
  padding-left: 20px;
  border-left: 1px solid var(--line);
}

.task-status-control {
  display: grid;
  gap: 6px;
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 700;
}

.task-status-control select:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.task-row-buttons {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.task-row-buttons .secondary-button {
  min-height: 38px;
  padding: 0 13px;
}

.tasks-state {
  min-height: 310px;
  display: grid;
  place-content: center;
  justify-items: center;
  margin-top: 20px;
  padding: 30px;
  border: 1px dashed #ccd1dc;
  border-radius: 17px;
  text-align: center;
  background: #fafbfc;
}

.tasks-state > span {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 15px;
  color: var(--primary);
  background: var(--primary-soft);
  font-size: 1.3rem;
  font-weight: 800;
}

.tasks-state h3 {
  margin: 15px 0 6px;
  font-family: 'Manrope', sans-serif;
  font-size: 1.25rem;
}

.tasks-state p {
  max-width: 520px;
  margin: 0 0 17px;
  color: var(--muted);
}

.tasks-state-error > span {
  color: var(--danger);
  background: var(--danger-soft);
}

.task-dialog {
  width: min(100%, 760px);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  padding: 28px;
  border-radius: 22px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.task-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 19px;
}

.task-form textarea {
  resize: vertical;
}

.task-field-full {
  grid-column: 1 / -1;
}

.field-hint {
  color: var(--muted);
  font-size: 0.75rem;
}

@media (max-width: 960px) {
  .task-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .task-search {
    grid-column: 1 / -1;
  }

  .task-list-item {
    grid-template-columns: 1fr;
  }

  .task-list-actions {
    flex-direction: row;
    align-items: flex-end;
    padding: 16px 0 0;
    border-top: 1px solid var(--line);
    border-left: 0;
  }

  .task-status-control {
    min-width: 190px;
  }
}

@media (max-width: 700px) {
  .workspace-heading-with-action,
  .tasks-panel-heading,
  .read-only-banner {
    align-items: stretch;
    flex-direction: column;
  }

  .workspace-heading-with-action > .primary-button {
    width: 100%;
  }

  .view-toggle {
    width: 100%;
  }

  .view-toggle button {
    flex: 1;
  }

  .task-filters,
  .task-form {
    grid-template-columns: 1fr;
  }

  .task-search,
  .task-field-full {
    grid-column: auto;
  }

  .task-search {
    align-items: stretch;
    flex-direction: column;
  }

  .task-list-item {
    padding: 20px 18px;
  }

  .task-list-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .task-status-control {
    min-width: 0;
  }

  .task-row-buttons {
    justify-content: stretch;
  }

  .task-row-buttons button {
    flex: 1;
  }
}

/* Etapa 08: quadro kanban e drag-and-drop persistido. */
.task-filters-kanban {
  grid-template-columns: minmax(160px, 0.75fr) minmax(300px, 1.8fr) auto;
}

.kanban-shell {
  position: relative;
  width: 100%;
  min-width: 0;
}

.kanban-scroll-top {
  position: sticky;
  top: 8px;
  z-index: 12;
  width: 100%;
  height: 18px;
  overflow-x: auto;
  overflow-y: hidden;
  margin-bottom: 8px;
  padding: 2px 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  scrollbar-color: #8f86dd #ebe9fa;
  scrollbar-width: auto;
  box-shadow: 0 4px 12px rgba(38, 34, 72, 0.08);
}

.kanban-scroll-top:focus-visible {
  outline: 3px solid rgba(101, 86, 232, 0.25);
  outline-offset: 2px;
}

.kanban-scroll-top-content {
  height: 1px;
}

.kanban-scroll-top::-webkit-scrollbar {
  height: 10px;
}

.kanban-scroll-top::-webkit-scrollbar-track {
  border-radius: 999px;
  background: #ebe9fa;
}

.kanban-scroll-top::-webkit-scrollbar-thumb {
  border: 2px solid #ebe9fa;
  border-radius: 999px;
  background: #8f86dd;
}

.kanban-scroll-top::-webkit-scrollbar-thumb:hover {
  background: #6f63e8;
}

.kanban-scroll {
  width: 100%;
  overflow-x: auto;
  padding: 3px 3px 14px;

  /* A barra visível fica no topo. O contêiner continua rolável para
     trackpad, Shift + roda do mouse e sincronização programática. */
  scrollbar-width: none;
}

.kanban-scroll::-webkit-scrollbar {
  height: 0;
}

.kanban-board {
  min-width: 1120px;
  display: grid;
  grid-template-columns: repeat(4, minmax(260px, 1fr));
  align-items: start;
  gap: 14px;
}

.kanban-column {
  min-height: 430px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: #f6f7fa;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 160ms ease;
}

.kanban-column.is-over {
  border-color: #9187ee;
  background: #f1efff;
  box-shadow: 0 0 0 4px rgba(101, 86, 232, 0.1);
}

.kanban-column-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 40px;
  margin-bottom: 12px;
}

.kanban-column-heading > div {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 9px;
}

.kanban-column-heading h3 {
  margin: 0;
  font-family: 'Manrope', sans-serif;
  font-size: 0.96rem;
  letter-spacing: -0.025em;
}

.kanban-column-marker {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #a7adbd;
}

.marker-in_progress {
  background: #6f63e8;
}

.marker-done {
  background: #2a9d75;
}

.marker-cancelled {
  background: #8e93a0;
}

.kanban-column-count {
  min-width: 28px;
  min-height: 28px;
  display: grid;
  place-items: center;
  padding: 0 7px;
  border-radius: 999px;
  color: var(--muted);
  background: #ffffff;
  font-size: 0.74rem;
  font-weight: 800;
}

.kanban-column-body {
  min-height: 348px;
  display: grid;
  align-content: start;
  gap: 11px;
}

.kanban-column-empty {
  display: grid;
  place-items: center;
  min-height: 118px;
  margin: 0;
  padding: 18px;
  border: 1px dashed #cfd3de;
  border-radius: 13px;
  color: var(--muted);
  text-align: center;
  font-size: 0.8rem;
  line-height: 1.5;
}

.kanban-task-card {
  position: relative;
  display: grid;
  grid-template-columns: 27px minmax(0, 1fr);
  gap: 8px;
  padding: 13px;
  border: 1px solid #e0e2e9;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 7px 20px rgba(45, 49, 77, 0.055);
  transition:
    box-shadow 160ms ease,
    opacity 160ms ease;
}

.kanban-task-card.is-dragging {
  z-index: 5;
  opacity: 0.35;
  box-shadow: 0 16px 34px rgba(43, 38, 90, 0.18);
}

.kanban-task-overlay {
  width: 280px;
  grid-template-columns: 1fr;
  opacity: 0.96;
  transform: rotate(1deg);
  box-shadow: 0 20px 45px rgba(43, 38, 90, 0.22);
}

.kanban-drag-handle {
  width: 27px;
  height: 32px;
  display: grid;
  place-items: center;
  padding: 0;
  border-radius: 8px;
  color: #8a8f9d;
  background: #f2f3f6;
  cursor: grab;
  touch-action: none;
}

.kanban-drag-handle:active {
  cursor: grabbing;
}

.kanban-drag-handle:focus-visible {
  outline: 3px solid rgba(101, 86, 232, 0.25);
  outline-offset: 2px;
}

.kanban-drag-handle:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.kanban-card-content {
  min-width: 0;
}

.kanban-card-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
}

.kanban-card-copy h4 {
  margin: 12px 0 5px;
  font-family: 'Manrope', sans-serif;
  font-size: 0.96rem;
  letter-spacing: -0.025em;
}

.kanban-card-copy p {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  font-size: 0.8rem;
}

.kanban-card-tags {
  margin-top: 11px;
}

.kanban-card-tags li {
  max-width: 105px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kanban-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 5px 9px;
  margin-top: 12px;
  color: var(--muted);
  font-size: 0.7rem;
}

.kanban-card-actions {
  display: grid;
  gap: 9px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #ececf1;
}

.kanban-status-fallback select {
  width: 100%;
  min-height: 34px;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 9px;
  color: var(--ink);
  background: #ffffff;
  font-size: 0.73rem;
}

.kanban-status-fallback select:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.kanban-card-buttons {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.kanban-card-buttons .text-button {
  min-height: 30px;
  padding: 0;
  font-size: 0.74rem;
}

@media (max-width: 860px) {
  .task-filters-kanban {
    grid-template-columns: 1fr;
  }

  .kanban-board {
    min-width: 1060px;
  }
}

/* Etapa 09: autocomplete de tags e gestão de anexos. */
.tag-autocomplete {
  position: relative;
}

.tag-autocomplete > input {
  width: 100%;
}

.tag-suggestions {
  position: absolute;
  z-index: 35;
  inset: calc(100% + 6px) 0 auto;
  max-height: 210px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: #ffffff;
  box-shadow: 0 14px 35px rgba(35, 41, 70, 0.14);
}

.tag-suggestions button {
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  border-radius: 9px;
  color: var(--ink);
  background: transparent;
  text-align: left;
  font-size: 0.84rem;
}

.tag-suggestions button:hover,
.tag-suggestions button:focus-visible {
  color: var(--primary-dark);
  background: var(--primary-soft);
}

.tag-suggestions-state {
  display: block;
  padding: 10px;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.45;
}

.attachments-dialog {
  width: min(100%, 760px);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  padding: 28px;
  border-radius: 22px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.compact-read-only {
  margin-bottom: 18px;
  padding: 13px 15px;
}

.attachment-upload {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 14px;
  margin-bottom: 18px;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 15px;
  background: #f8f8fb;
}

.attachment-upload input[type='file'] {
  width: 100%;
  padding: 10px;
  border: 1px dashed #c8c8d4;
  border-radius: 11px;
  background: #ffffff;
}

.attachment-upload .primary-button {
  min-width: 150px;
}

.attachments-content {
  margin-top: 18px;
}

.attachments-state {
  min-height: 150px;
  display: grid;
  place-items: center;
  gap: 10px;
  padding: 24px;
  border: 1px dashed #d4d6df;
  border-radius: 15px;
  color: var(--muted);
  text-align: center;
}

.attachments-state p {
  margin: 0;
}

.attachments-empty span {
  font-size: 0.82rem;
}

.attachments-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.attachments-list li {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  align-items: center;
  gap: 13px;
  padding: 13px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #ffffff;
}

.attachment-icon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: var(--primary-dark);
  background: var(--primary-soft);
  font-size: 0.68rem;
  font-weight: 800;
}

.attachment-copy {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.attachment-copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-copy span {
  color: var(--muted);
  font-size: 0.76rem;
}

.attachment-actions {
  display: flex;
  align-items: center;
  gap: 9px;
}

.attachment-actions .secondary-button {
  min-height: 38px;
  padding: 0 13px;
}

@media (max-width: 700px) {
  .attachment-upload {
    grid-template-columns: 1fr;
  }

  .attachment-upload .primary-button {
    width: 100%;
  }

  .attachments-list li {
    grid-template-columns: 42px minmax(0, 1fr);
  }

  .attachment-icon {
    width: 42px;
    height: 42px;
  }

  .attachment-actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
}
````

### `frontend/README.md`

````markdown
# Taskly Frontend

Frontend do Taskly desenvolvido com React, Vite e TypeScript.

## Stack

- React e React Router;
- TanStack Query para estado remoto e rollback de mutations;
- dnd-kit para drag-and-drop do kanban;
- React Hook Form e Zod para formulários;
- Vitest e Testing Library para testes;
- ESLint e TypeScript em modo estrito.

## Configuração

Copie o arquivo de ambiente:

```powershell
Copy-Item .env.example .env
```

Valor padrão:

```env
VITE_API_URL="http://localhost:8000/api/v1"
```

## Execução

Na raiz `frontend/`:

```powershell
npm install
npm run dev
```

A aplicação fica disponível em `http://localhost:5173`.

## Validação

```powershell
npm run lint
npx tsc --noEmit
npm run test
npm run build
```

## Fluxos disponíveis

- registro de usuário;
- login por e-mail e senha;
- persistência local da sessão;
- renovação automática do access token;
- validação da sessão por `GET /auth/me`;
- rotas públicas e protegidas;
- logout;
- gestão de projetos;
- lista paginada de tarefas;
- criação, edição, exclusão e atualização de status de tarefas;
- filtros por status, prioridade e busca;
- prazo com conversão entre horário local e UTC;
- tags com autocomplete, criação de novos nomes e exibição na lista e no kanban;
- toggle entre lista e kanban;
- carregamento completo das páginas no quadro;
- drag-and-drop de status com atualização otimista e rollback;
- anexos autenticados com upload, listagem, download e exclusão;
- consulta de anexos preservada em projetos arquivados, sem permitir alterações.

O armazenamento em `localStorage` é um trade-off consciente do case. Para um
produto real, a evolução recomendada é adotar cookies HttpOnly e proteção CSRF.
````

### `README.md`

````markdown
# Taskly Fullstack

Repositório do case técnico Taskly, organizado como monorepo para manter backend, frontend e documentação no mesmo histórico Git.

## Estrutura atual

```text
taskly-fullstack-UEX/
├── backend/          # FastAPI, SQLAlchemy, Alembic e pytest
├── frontend/         # React, Vite, TypeScript e produto web
├── docs/             # etapas, decisões, estado atual e uso de IA
├── .github/          # CI do repositório
├── docker-compose.yml
└── README.md
```

## Diretórios de execução

### Raiz do repositório

Use para Git e Docker Compose:

```powershell
cd "C:\Users\Daniel Hara\Documents\Projetos\taskly-fullstack-UEX"
git status
docker compose up -d
```

### Raiz do backend

Use para Alembic, Ruff e pytest:

```powershell
cd backend
alembic upgrade head
ruff check .
ruff format . --check
python -m pytest
```

### Raiz do frontend

Use para npm, TypeScript, ESLint e Vitest:

```powershell
cd frontend
npm install
npm run dev
npm run lint
npx tsc --noEmit
npm run test
```

## Estado funcional

O backend possui autenticação, refresh token, projetos, tarefas, ownership, prazos em UTC, tags relacionais e anexos.

O frontend possui autenticação persistente, gestão de projetos, lista e kanban de tarefas, drag-and-drop persistido, autocomplete de tags e gestão autenticada de anexos com upload, download e exclusão.
````

### `docs/AI_USAGE.md`

````markdown
# Uso de IA no desenvolvimento do Taskly

## Princípios de registro

A IA é utilizada neste projeto como ferramenta de apoio para pesquisa técnica, organização de informações, comparação de alternativas, identificação preliminar de riscos e revisão de soluções.

As decisões arquiteturais, a seleção das abordagens aplicadas, a implementação, as adaptações ao código existente, a execução das validações e a responsabilidade pelo resultado final pertencem ao desenvolvedor.

Os registros abaixo não tratam sugestões da IA como decisões automáticas. Cada etapa deve distinguir:

- o que foi solicitado à ferramenta;
- quais alternativas foram apresentadas;
- qual decisão foi tomada pelo desenvolvedor;
- quais alterações foram realizadas pelo desenvolvedor;
- quais resultados foram efetivamente validados.

Não serão registrados testes, comandos ou resultados como executados sem a respectiva evidência real.

---

## Etapa 01 - Diagnóstico e decisões técnicas iniciais

### Objetivo

Analisar a base KanbanCore API, identificar o que pode ser reaproveitado no Taskly, localizar lacunas em relação ao escopo do desafio e estabelecer uma sequência de implementação compatível com o prazo de três dias.

### Uso da IA

A IA foi utilizada como apoio para:

- organizar o inventário dos componentes existentes;
- comparar o código atual com os requisitos funcionais do Taskly;
- levantar arquivos potencialmente afetados;
- apresentar alternativas para tags, anexos, persistência de sessão e migrations;
- apontar riscos que deveriam ser verificados antes da implementação;
- estruturar um plano incremental de execução.

Nesta etapa, a IA não implementou funcionalidades nem substituiu a análise e a aprovação do desenvolvedor.

### Sugestão inicial

A análise assistida sugeriu:

- preservar a arquitetura em camadas já existente;
- corrigir a base de migrations antes de evoluir o modelo de tarefas;
- utilizar tags relacionais com escopo por usuário;
- isolar o armazenamento de anexos atrás de uma interface;
- manter prioridade como recurso adicional;
- trabalhar com `due_at` timezone-aware e contrato em UTC;
- carregar todas as páginas de tarefas do projeto para compor o kanban;
- tratar projetos arquivados como somente leitura;
- documentar conscientemente os trade-offs da sessão persistente no frontend.

Também foram apontados como riscos prioritários a ausência de revisions Alembic versionadas, a regra do `.gitignore` que bloqueia migrations, a falta de endpoint de refresh e a ausência de testes de ownership entre usuários diferentes.

### Decisão do desenvolvedor

O desenvolvedor revisou o diagnóstico e aprovou as diretrizes técnicas iniciais.

Foram adotadas as seguintes decisões:

- preservar a arquitetura `api → service → repository → model`;
- considerar o banco local do case recriável, sem obrigação de preservar dados anteriores;
- criar uma baseline Alembic reproduzível antes das mudanças funcionais;
- implementar tags por meio de modelagem relacional enxuta e reutilizável por usuário;
- implementar anexos com metadados relacionais e uma abstração de armazenamento;
- usar armazenamento local em desenvolvimento e testes, deixando a implementação de produção vinculada ao provedor de deploy;
- manter o campo de prioridade;
- adotar UTC como contrato de persistência e transporte para prazos;
- carregar todas as páginas de tarefas de um projeto na visualização kanban;
- tratar projetos arquivados como somente leitura;
- limitar anexos inicialmente a imagens e PDF, com limite configurável;
- utilizar a IA como apoio de pesquisa, comparação e revisão, mantendo decisões e implementação sob responsabilidade do desenvolvedor.

A definição do provedor de deploy e do storage de produção permanece deliberadamente adiada para a etapa de infraestrutura, pois depende das condições reais do ambiente escolhido.

### Alterações humanas

Nesta etapa, o desenvolvedor:

- forneceu o repositório e o escopo do desafio como base da análise;
- definiu que funcionalidades existentes não devem ser reescritas sem justificativa;
- aprovou as decisões técnicas iniciais;
- determinou a forma correta de registrar o uso de IA no desafio;
- manteve a Etapa 01 exclusivamente documental, sem alteração do código-fonte.

### Problemas identificados

- `alembic/versions/` não contém uma revision inicial versionada.
- `.gitignore` ignora `alembic/versions/*.py`.
- O entrypoint executa `alembic upgrade head`, mas a ausência de revisions impede a criação das tabelas em um banco vazio.
- O backend emite refresh token, porém não possui endpoint de renovação.
- Os testes usam `Base.metadata.create_all()` e não validam a integridade das migrations.
- A suíte atual não cobre tentativas de acesso cruzado entre usuários distintos.
- O kanban poderá exibir dados incompletos se consumir apenas a primeira página da listagem.
- Anexos exigem ownership indireto e limpeza coordenada entre banco e storage.
- A conversão futura de `due_date` para `due_at` exige tratamento explícito de timezone.

### Validação

A etapa foi validada por inspeção estática dos arquivos fornecidos e comparação com o escopo aprovado.

Nenhum comando de `pytest`, Ruff, Alembic, Docker, lint, TypeScript ou Vitest foi executado nesta etapa. Não houve alteração de código a ser validada.

### Resultado

O diagnóstico foi consolidado, as decisões iniciais foram aprovadas e a ordem de implementação foi definida. O código-fonte permanece inalterado.

A próxima etapa será a preparação da baseline Alembic e a adaptação do modelo de tarefas, iniciando pela integridade do banco antes da evolução funcional.

---

## Etapa 02 - Baseline Alembic e adaptação do modelo de tarefas

### Objetivo

Estabelecer migrations reproduzíveis e adaptar o contrato de tarefas aos requisitos obrigatórios do Taskly, incluindo descrição curta, prazo com data e hora em UTC e status de cancelamento.

### Uso da IA

A IA foi utilizada como ferramenta de apoio para:

- revisar o comportamento de enums Python no SQLAlchemy e comparar persistência por nome ou valor;
- organizar alternativas para a baseline Alembic;
- sugerir uma estratégia explícita de conversão de `due_date` para `due_at`;
- levantar cenários de teste para timezone, ownership e projetos arquivados;
- revisar dependências entre model, schema, repository, service, route e migration;
- estruturar os comandos e a documentação da etapa.

A implementação proposta foi revisada e selecionada pelo desenvolvedor. A ferramenta não executou deploy, não confirmou a suíte completa e não substituiu a validação no ambiente real do projeto.

### Sugestão inicial

A análise assistida apresentou como alternativas:

1. criar uma única migration já no formato final do Taskly;
2. criar uma baseline do KanbanCore e uma segunda revision incremental;
3. continuar usando `create_all()` nos testes e validar Alembic separadamente.

Também foi sugerido:

- normalizar datetimes timezone-aware para UTC na fronteira Pydantic;
- converter datas legadas para um horário determinístico;
- adicionar `cancelled` explicitamente ao enum PostgreSQL;
- impedir alterações em tarefas de projetos arquivados;
- criar testes com dois usuários reais para validar ownership.

### Decisão do desenvolvedor

O desenvolvedor decidiu:

- usar duas revisions, preservando uma baseline compreensível e uma evolução incremental;
- considerar o banco local anterior descartável, exigindo recriação para adoção da baseline;
- armazenar os valores textuais dos enums (`active`, `todo`, `high`) em vez dos nomes internos dos membros Python;
- tornar `short_description` obrigatória, com limite de 280 caracteres;
- manter `description` completa opcional e editável;
- exigir timezone em `due_at` e normalizar o valor para UTC;
- converter `due_date` legado para 23:59 UTC do mesmo dia durante a migration;
- tratar projetos arquivados como somente leitura também para atualização e exclusão de tarefas;
- executar a cadeia Alembic no setup dos testes, substituindo `create_all()` como preparação principal;
- proteger o reset destrutivo do schema de testes quando o ambiente não estiver identificado como teste.

### Alterações humanas

O desenvolvedor deve revisar e aplicar os arquivos da etapa no repositório, resolver eventuais diferenças com alterações locais e executar as validações no PostgreSQL do projeto.

Antes da aceitação final, cabe ao desenvolvedor:

- conferir a migration em banco vazio;
- validar o downgrade em banco descartável;
- analisar a saída real de Ruff e pytest;
- corrigir qualquer diferença específica do ambiente;
- decidir e executar o commit.

### Problemas identificados

- O `.gitignore` original descartava todas as revisions Alembic.
- A suíte original criava tabelas por `Base.metadata.create_all()`, ocultando migrations ausentes ou inválidas.
- `Enum(PythonEnum)` do SQLAlchemy persiste nomes dos membros por padrão, o que poderia divergir dos valores minúsculos esperados pela API e pelas migrations.
- Um datetime sem offset tornaria o prazo dependente do timezone do servidor.
- A remoção de um valor de enum no downgrade exige recriação controlada do tipo no PostgreSQL.
- O reset do schema usado nos testes é destrutivo e só pode apontar para banco descartável.
- O ambiente usado para preparação dos arquivos não possuía Ruff, `python-jose`, `psycopg` nem uma instância PostgreSQL disponível.

### Validação

Foram realizadas as seguintes verificações locais durante a preparação:

- compilação sintática com `python -m compileall -q app alembic`;
- inspeção da cadeia com `alembic heads` e `alembic history`;
- geração offline PostgreSQL das sequências de upgrade e downgrade para verificar o SQL produzido e o encadeamento das revisions;
- validação direta dos schemas Pydantic para normalização UTC, rejeição de datetime sem timezone e rejeição de `short_description=null`;
- validação direta do mapeamento SQLAlchemy dos enums para valores minúsculos;
- persistência básica do novo modelo em SQLite apenas como verificação auxiliar do ORM.

Não foram executados com sucesso nesta preparação:

- `ruff check .` e `ruff format . --check`, porque Ruff não estava disponível no ambiente;
- `pytest`, porque faltavam dependências da aplicação e PostgreSQL;
- migrations online contra PostgreSQL.

Essas validações permanecem obrigatórias no ambiente do desenvolvedor. Nenhum resultado pendente é apresentado como aprovado.

### Resultado

Os arquivos da Etapa 02 foram preparados com baseline Alembic, migration incremental, contrato atualizado de tarefas, proteção de projetos arquivados, testes de ownership e setup de testes baseado em migrations.

A etapa só deve ser considerada concluída após o desenvolvedor aplicar os arquivos e registrar os resultados reais de Alembic, Ruff e pytest.

---

## Etapa 03 - Tags relacionais e estrutura fullstack

### Objetivo

Reorganizar o repositório em `backend/`, `frontend/` e `docs/`, preservando na raiz os arquivos de coordenação do monorepo, e implementar tags relacionais reutilizáveis por usuário nas tarefas.

### Uso da IA

A IA foi utilizada como ferramenta de apoio para:

- comparar uma raiz exclusivamente backend com uma estrutura de monorepo;
- classificar quais arquivos pertencem ao runtime do backend e quais coordenam o repositório inteiro;
- comparar contratos baseados em IDs de tags com contratos baseados em nomes;
- revisar a modelagem many-to-many e a restrição de unicidade por usuário;
- levantar cenários de normalização, substituição, remoção e ownership de tags;
- verificar dependências entre model, schema, repository, service, route, migration, CI e Docker Compose;
- organizar os comandos e a documentação da etapa.

A ferramenta não escolheu autonomamente a arquitetura nem validou o comportamento em PostgreSQL. As sugestões foram submetidas à revisão do desenvolvedor.

### Sugestão inicial

A análise assistida sugeriu:

- manter `docs/`, `.github/`, `.gitignore`, `.pre-commit-config.yaml` e `docker-compose.yml` na raiz;
- mover `app/`, `alembic/`, `alembic.ini`, `pyproject.toml`, `.env.example`, `Dockerfile`, entrypoint e README técnico para `backend/`;
- reservar `frontend/` para a futura aplicação React/Vite;
- usar `tags` e `task_tags` com ownership direto em `users`;
- aceitar nomes de tags no payload de tarefas para impedir associação direta por IDs de outra conta;
- normalizar nomes para comparação e preservar um nome de exibição;
- usar eager loading para evitar consultas N+1 na serialização das tarefas;
- expor somente a listagem necessária ao autocomplete nesta etapa.

### Decisão do desenvolvedor

O desenvolvedor decidiu:

- adotar a estrutura de monorepo imediatamente, antes da criação do frontend;
- manter ferramentas de Git, CI, documentação e orquestração na raiz do repositório;
- manter o backend executável de forma independente dentro de `backend/`;
- resolver o arquivo `.env` por caminho absoluto derivado da pasta física do backend;
- criar tags relacionais com unicidade por `owner_id + normalized_name`;
- aceitar até dez tags por tarefa, cada uma com no máximo 40 caracteres;
- remover espaços redundantes e deduplicar tags sem diferenciar maiúsculas e minúsculas;
- preservar o primeiro nome de exibição enviado pelo usuário;
- permitir substituição integral das tags em `PATCH` e remoção por lista vazia;
- rejeitar `tags: null`, pois campo ausente e lista vazia já representam as duas operações necessárias;
- disponibilizar `GET /api/v1/tags` para seleção e autocomplete, sem ampliar o escopo para CRUD administrativo.

### Alterações humanas

Cabe ao desenvolvedor:

- aplicar o patch sobre o estado efetivo da Etapa 02;
- revisar os movimentos de arquivos antes de commitar;
- recriar ou ajustar o `.env` em `backend/.env`;
- reinstalar o projeto editável a partir de `backend/`;
- executar Alembic, Ruff e pytest no PostgreSQL local;
- analisar falhas específicas do ambiente e realizar eventuais correções;
- decidir quando a etapa está pronta para commit.

### Problemas identificados

- Após a reorganização, comandos executados na raiz antiga deixam de localizar `pyproject.toml` e `alembic.ini`.
- O Docker Compose precisa usar `./backend` como contexto e volume da API.
- A CI precisa definir `backend/` como diretório de trabalho.
- A configuração de `.env` baseada apenas no diretório corrente é frágil em um monorepo.
- Uma relação many-to-many sem eager loading pode gerar N+1 ao listar tarefas.
- Tags enviadas por ID abririam uma superfície adicional para associação cruzada entre usuários.
- A criação concorrente da mesma tag ainda depende da restrição única do banco; conflitos reais deverão ser observados durante testes de carga ou evolução do produto.
- O ambiente de preparação não possuía Ruff, psycopg nem Docker/PostgreSQL.

### Validação

Foram realizadas durante a preparação:

- compilação sintática com `python -m compileall -q backend/app backend/alembic`;
- validação da árvore SQLAlchemy, confirmando `users`, `projects`, `tasks`, `tags` e `task_tags` no metadata;
- validação dos schemas Pydantic para limpeza, deduplicação, lista vazia e rejeição de `tags: null`;
- inspeção da cadeia Alembic, confirmando `0003_add_relational_tags` como head;
- verificação de whitespace e estrutura do patch com `git diff --check`;
- integração auxiliar do repository em SQLite para criação, associação, substituição e carregamento de tags;
- verificação auxiliar de isolamento, confirmando que dois usuários podem possuir tags homônimas com IDs diferentes.

Não foram executados com sucesso neste ambiente:

- `ruff check .` e `ruff format . --check`;
- migrations online contra PostgreSQL;
- suíte completa com pytest;
- Docker Compose.

Esses resultados permanecem pendentes no ambiente do desenvolvedor e não são apresentados como aprovados.

### Resultado

A Etapa 03 foi preparada com estrutura fullstack, backend isolado em sua própria pasta, frontend reservado, migration relacional de tags, integração de tags ao fluxo de tarefas, endpoint de autocomplete e testes de ownership.

A conclusão efetiva depende da aplicação do patch e da validação real pelo desenvolvedor.

---

## Etapa 04 - Anexos e abstração de armazenamento

### Objetivo

Implementar anexos e fotos vinculados às tarefas, mantendo os metadados no PostgreSQL e os bytes fora do banco, com ownership, validação de tipo e tamanho, armazenamento substituível e limpeza coordenada em exclusões.

### Uso da IA

A IA foi utilizada como ferramenta de apoio para:

- comparar armazenamento de bytes no banco, filesystem e serviço compatível com S3;
- revisar o desenho de uma interface mínima de storage;
- levantar riscos de path traversal, nomes previsíveis, MIME forjado, arquivos órfãos e acesso cruzado;
- organizar alternativas de consistência entre metadados e conteúdo físico;
- sugerir cenários de teste para upload, listagem, download, exclusão, projeto arquivado e ownership;
- revisar as dependências entre model, migration, repository, service, rotas, configuração, Docker e testes;
- estruturar os comandos e a documentação da etapa.

As sugestões foram avaliadas pelo desenvolvedor antes de serem incorporadas. A ferramenta não selecionou o provider de produção, não executou migrations online e não validou a suíte completa no ambiente real.

### Sugestão inicial

A análise assistida sugeriu:

- criar `StorageBackend` com operações de salvar, abrir, excluir e verificar existência;
- usar `LocalStorageBackend` em desenvolvimento e testes;
- gerar chaves internas com UUID, sem usar o nome enviado como caminho físico;
- persistir nome, URL protegida, MIME, tamanho, chave interna e `task_id`;
- aceitar inicialmente JPEG, PNG, WebP e PDF;
- conferir MIME, limite de bytes e assinatura inicial do arquivo;
- validar ownership por `Attachment → Task → Project → owner_id`;
- impedir upload e exclusão em projetos arquivados;
- remover arquivos físicos quando anexo, tarefa ou projeto forem excluídos;
- usar diretório temporário isolado na suíte de testes.

### Decisão do desenvolvedor

O desenvolvedor decidiu:

- manter os bytes fora do PostgreSQL;
- adotar uma interface de storage independente do provider;
- usar armazenamento local no ambiente atual e volume persistente no Docker Compose;
- manter o endpoint de conteúdo autenticado, evitando exposição pública direta dos arquivos;
- limitar o MVP a JPEG, PNG, WebP e PDF, com tamanho padrão máximo de 5 MiB configurável;
- verificar assinaturas conhecidas além do MIME declarado;
- sanitizar o nome original apenas para exibição e `Content-Disposition`;
- gerar chaves internas por usuário, tarefa e UUID;
- aplicar 404 para recursos de outra conta, sem revelar sua existência;
- preservar consulta e download em projetos arquivados, bloqueando somente alterações;
- coordenar limpeza física nas exclusões de anexos, tarefas e projetos;
- manter a escolha do storage externo de produção para a etapa de deploy.

### Alterações humanas

Cabe ao desenvolvedor:

- aplicar o patch sobre o estado efetivo da Etapa 03;
- revisar os limites e tipos permitidos conforme o ambiente de apresentação;
- configurar `backend/.env` e o volume de anexos;
- executar a migration `0004_add_attachments` em PostgreSQL;
- executar Ruff e pytest e analisar as saídas reais;
- revisar o comportamento de upload e download pelo Swagger ou cliente HTTP;
- decidir e executar o commit da etapa.

### Problemas identificados

- O MIME informado pelo cliente não é evidência suficiente do conteúdo.
- Usar o nome original como caminho permitiria colisões e path traversal.
- Excluir somente os registros do banco deixaria arquivos órfãos no storage.
- Excluir somente os arquivos antes de validar ownership poderia remover conteúdo de outra conta.
- URLs públicas diretas dificultariam manter a mesma regra de autenticação da API.
- Um filesystem sem volume persistente perderia os anexos ao recriar o container.
- A migration de downgrade remove metadados, mas não consegue apagar automaticamente os bytes de um provider externo.
- O ambiente de preparação não possuía Ruff, `python-jose`, psycopg nem PostgreSQL disponível para a suíte completa.

### Validação

Foram realizadas durante a preparação:

- compilação sintática com `python -m compileall -q backend/app backend/alembic`;
- verificação de whitespace com `git diff --check`;
- inspeção da cadeia Alembic, mantendo `0004_add_attachments` após `0003_add_relational_tags`;
- inspeção dos endpoints e das relações ORM;
- verificação estática de linhas acima do limite de 88 caracteres;
- revisão dos fluxos de limpeza de arquivo em anexo, tarefa e projeto;
- criação de testes para ownership, tipos, assinatura, tamanho, projeto arquivado, download e limpeza física.

Não foram executados com sucesso neste ambiente:

- `ruff check .` e `ruff format . --check`, porque Ruff não estava instalado;
- `pytest`, porque faltavam dependências completas e PostgreSQL;
- `alembic upgrade head` online contra PostgreSQL;
- Docker Compose.

Essas validações permanecem obrigatórias no ambiente do desenvolvedor e nenhum resultado pendente é apresentado como aprovado.

### Resultado

A Etapa 04 foi preparada com entidade `Attachment`, migration, storage local desacoplado, endpoints autenticados, integração às respostas de tarefas, validações de segurança e testes de ownership e limpeza.

A conclusão efetiva depende da aplicação do patch e do registro das validações reais pelo desenvolvedor.

---

## Etapa 05 - Fundação do frontend e autenticação

### Objetivo

Inicializar o frontend React/Vite/TypeScript e conectar o fluxo completo de autenticação ao backend, incluindo cadastro, login, sessão persistente, renovação de token, validação do usuário autenticado, rotas protegidas e logout.

### Uso da IA

A IA foi utilizada como ferramenta de apoio para:

- pesquisar a documentação oficial e a compatibilidade das bibliotecas previstas para o frontend;
- comparar alternativas de organização do cliente HTTP e do estado de autenticação;
- levantar riscos de loops de refresh, repetição de requisições e tratamento incorreto de respostas `403`;
- sugerir a separação entre armazenamento dos tokens, cliente HTTP, contexto de autenticação, páginas e proteção de rotas;
- organizar cenários de teste para validação de formulários, persistência da sessão, renovação de token e redirecionamento;
- revisar a integração entre endpoint de refresh, TanStack Query, React Hook Form, Zod e React Router;
- estruturar a documentação e os comandos de validação da etapa.

A ferramenta serviu como apoio de pesquisa e revisão. As decisões aplicadas, a implementação, a validação local e a responsabilidade técnica permanecem com o desenvolvedor.

### Sugestão inicial

A análise assistida sugeriu:

- criar `POST /api/v1/auth/refresh` validando explicitamente o tipo `refresh` do JWT;
- manter o login compatível com o Swagger por `application/x-www-form-urlencoded`;
- centralizar chamadas HTTP em um cliente baseado em `fetch`;
- tentar refresh somente para ausência, invalidade ou expiração do token, sem interceptar todo `403`;
- persistir access e refresh tokens em um módulo isolado;
- usar TanStack Query para validar `GET /auth/me` e manter o usuário autenticado em cache;
- usar React Hook Form e Zod nos formulários de login e cadastro;
- separar rotas públicas de rotas protegidas;
- limpar tokens e cache no logout ou quando a renovação falhar definitivamente;
- adicionar testes de unidade e integração dos fluxos críticos da fundação.

### Decisão do desenvolvedor

O desenvolvedor decidiu:

- implementar a renovação da sessão no backend sem criar blacklist ou revogação nesta etapa;
- emitir novamente access e refresh tokens após a validação do usuário ativo;
- usar `localStorage` como trade-off consciente do case, conforme decisão já registrada;
- manter a URL da API configurável por `VITE_API_URL`;
- usar `fetch` nativo para evitar uma dependência adicional de cliente HTTP;
- renovar a sessão apenas diante de `401` ou do detalhe específico `Invalid or expired token`;
- preservar respostas `403` de regras de negócio sem tentativa automática de refresh;
- validar a sessão no carregamento por `GET /auth/me`;
- estruturar o frontend por feature, mantendo autenticação isolada das próximas áreas de projetos e tarefas;
- adicionar um job independente de frontend na CI;
- não antecipar os fluxos funcionais de projetos, lista ou kanban nesta etapa.

### Alterações humanas

Cabe ao desenvolvedor:

- instalar as dependências npm e revisar o arquivo de lock gerado no ambiente local;
- copiar `frontend/.env.example` para `frontend/.env` quando necessário;
- executar o frontend com o backend real e validar CORS;
- testar cadastro, login, recarregamento da página, expiração do access token e logout;
- executar ESLint, TypeScript, Vitest e build;
- executar Ruff e pytest para validar o endpoint de refresh;
- revisar acessibilidade, textos e comportamento responsivo no navegador;
- decidir e realizar o commit da etapa.

### Problemas identificados

- Armazenar tokens em `localStorage` mantém exposição em caso de XSS e não é a estratégia recomendada para um produto real.
- Interceptar todo status `403` provocaria tentativas de refresh para regras de ownership ou projetos arquivados.
- Renovar a sessão sem limitar a repetição poderia gerar loop infinito quando o refresh token também expirasse.
- Permitir access token no endpoint de refresh prolongaria indevidamente a sessão.
- Limpar a sessão em qualquer erro de rede poderia desconectar o usuário durante uma indisponibilidade temporária.
- O login do backend recebe form data no campo `username`, enquanto o formulário visual trabalha com `email`.
- A ausência de `package-lock.json` antes da primeira instalação impede o uso inicial de `npm ci`; o lock deverá ser gerado e versionado pelo desenvolvedor.
- O ambiente de preparação não possuía acesso ao registry npm nem as dependências do frontend instaladas.

### Validação

Foram realizadas durante a preparação:

- pesquisa da documentação oficial do Vite, TanStack Query, React Hook Form e Vitest;
- compilação sintática do backend com `python -m compileall -q backend/app backend/alembic`;
- análise sintática dos arquivos TypeScript e TSX com a API do compilador TypeScript disponível no ambiente;
- verificação de whitespace com `git diff --check`;
- inspeção do fluxo de retry, confirmando limite de uma tentativa após refresh;
- inspeção do tratamento seletivo de falhas de autenticação e respostas `403` de negócio;
- criação de testes para refresh no backend, armazenamento de tokens, cliente HTTP, login e rota protegida;
- revisão da separação entre `docs/etapas/etapa-05-frontend-base-auth.md` e `docs/prompts/prompt-etapa-05-frontend-base-auth.md`.

Não foram executados neste ambiente:

- `npm install`;
- `npm run lint`;
- `npx tsc --noEmit` com todas as dependências instaladas;
- `npm run test`;
- `npm run build`;
- Ruff;
- pytest completo;
- validação manual no navegador com backend e PostgreSQL ativos.

Nenhum desses resultados pendentes é apresentado como aprovado.

### Resultado

A Etapa 05 foi preparada com endpoint de refresh, testes de autenticação no backend, frontend React/Vite/TypeScript, cliente HTTP com renovação seletiva, cadastro, login, validação de sessão, rotas protegidas, logout, testes iniciais e job de CI.

A conclusão efetiva depende da instalação das dependências, geração do lockfile e execução das validações reais pelo desenvolvedor.

---

## Etapa 06 - Projetos no frontend

### Objetivo

Implementar a gestão de projetos no frontend, consumindo o CRUD já existente no backend e preparando a navegação para as tarefas de cada projeto.

### Uso da IA

A IA foi utilizada como apoio para:

- revisar os contratos já existentes de projetos no backend;
- comparar formas de organizar queries, mutations e invalidação de cache no TanStack Query;
- sugerir estados de carregamento, erro, vazio e paginação;
- levantar riscos de cache desatualizado após criação, edição, arquivamento, restauração e exclusão;
- revisar a acessibilidade do formulário modal e dos filtros;
- estruturar cenários de teste para listagem, criação, edição e arquivamento;
- organizar a documentação e os comandos de validação da etapa.

A ferramenta foi usada como apoio de pesquisa, comparação e revisão. A definição da experiência, a implementação, as adaptações ao projeto, a execução dos testes e a responsabilidade pelo resultado permanecem com o desenvolvedor.

### Sugestão inicial

A análise assistida sugeriu:

- manter toda a integração de projetos em uma feature própria;
- centralizar os contratos HTTP em `features/projects/api.ts`;
- criar chaves de cache hierárquicas para listas e detalhes;
- invalidar as listas após mutations e atualizar o detalhe quando disponível;
- usar filtros explícitos para ativos e arquivados;
- enviar a busca somente após submissão, evitando request a cada tecla;
- reutilizar um único formulário para criação e edição;
- manter uma rota de workspace do projeto, deixando tarefas para a etapa seguinte;
- testar os fluxos críticos com `fireEvent`, evitando o problema de timeout identificado na Etapa 05.

### Decisão do desenvolvedor

O desenvolvedor decidiu:

- preservar integralmente o backend de projetos, pois os endpoints existentes já atendem à etapa;
- adotar cards responsivos com acesso ao workspace do projeto;
- incluir criação, edição, arquivamento, restauração e exclusão;
- manter busca, filtro por status e paginação refletidos nas chaves do TanStack Query;
- exigir confirmação explícita antes da exclusão definitiva;
- manter a criação de tarefas fora desta etapa;
- usar atualização por invalidação do cache, evitando estado remoto duplicado em componentes;
- não adicionar nova entrada ao `DECISIONS.md`, pois não houve decisão arquitetural nova de longo prazo.

### Alterações humanas

Cabe ao desenvolvedor:

- aplicar e revisar o patch no repositório real;
- executar a aplicação com a API e o PostgreSQL ativos;
- revisar textos, responsividade e experiência dos formulários no navegador;
- validar busca, paginação, criação, edição, arquivamento, restauração e exclusão com dados reais;
- executar lint, type-check, Vitest e build;
- revisar o `package-lock.json` já existente após qualquer instalação;
- realizar o commit somente depois das validações locais.

### Problemas identificados

- Mutations sem invalidação deixariam cards e contadores desatualizados.
- Busca disparada com valor vazio poderia gerar contrato inconsistente ou request desnecessária.
- Criar estado local duplicado dos projetos aumentaria o risco de divergência com o cache.
- Exclusão sem confirmação seria perigosa porque o backend remove tarefas e anexos relacionados.
- Um projeto arquivado precisa permanecer consultável e restaurável, mas suas tarefas serão somente leitura.
- Testes que consultam botões atrás de um diálogo podem encontrar elementos duplicados; por isso, as consultas do formulário são limitadas com `within(dialog)`.
- O ambiente de preparação não disponibilizou todas as dependências npm no registry interno, impedindo a execução real do frontend.

### Validação

Foram realizadas durante a preparação:

- inspeção dos contratos de projetos do backend;
- análise sintática de todos os arquivos TypeScript e TSX;
- verificação de whitespace com `git diff --check`;
- revisão das chaves de cache, filtros e invalidações;
- criação de testes para listagem, criação, edição e arquivamento;
- confirmação de que nenhum arquivo Python ou migration foi alterado;
- revisão da separação entre `docs/etapas/etapa-06-projetos-frontend.md` e `docs/prompts/prompt-etapa-06-projetos-frontend.md`.

Não foram executados neste ambiente:

- `npm run lint`;
- `npx tsc --noEmit` com todas as dependências instaladas;
- `npm run test`;
- `npm run build`;
- validação manual no navegador contra a API real.

Nenhum resultado pendente é apresentado como aprovado.

### Resultado

A Etapa 06 foi preparada com gestão completa de projetos no frontend, estados de interface, cache remoto, formulários, filtros, paginação, navegação e testes dos fluxos principais.

A conclusão efetiva depende da aplicação do patch e da execução das validações reais pelo desenvolvedor.

## Etapa 07 - Lista de tarefas e formulário completo

### Objetivo

Implementar a visualização em lista das tarefas de um projeto e os fluxos de criação, edição, exclusão, atualização de status, filtros, prazo e tags no frontend.

### Uso da IA

A IA foi utilizada como ferramenta de apoio para:

- revisar o contrato existente dos endpoints de tarefas;
- comparar formas de representar filtros, paginação e mutations no TanStack Query;
- sugerir a conversão explícita entre o campo `datetime-local` do navegador e o contrato UTC da API;
- levantar riscos de estado inconsistente quando uma mutation remove o último item da página atual;
- organizar o formulário com React Hook Form e Zod;
- revisar estados de carregamento, erro, vazio e somente leitura;
- estruturar cenários de teste para listagem, criação, mudança de status e projeto arquivado;
- revisar a separação entre a lista desta etapa e o kanban da etapa seguinte.

A ferramenta atuou como apoio de pesquisa, comparação e revisão. A definição da experiência, a implementação, as adaptações ao código real, a execução das validações e a responsabilidade técnica permanecem com o desenvolvedor.

### Sugestão inicial

A análise assistida sugeriu:

- criar uma feature `tasks` com tipos, cliente HTTP, hooks e componentes próprios;
- manter os dados remotos no TanStack Query, sem duplicar a lista em estado local;
- usar o endpoint paginado existente, filtrando sempre pelo projeto aberto;
- disponibilizar alteração rápida de status diretamente na lista;
- reutilizar um único formulário para criação e edição;
- aceitar tags separadas por vírgula nesta etapa, deixando autocomplete e gestão de anexos para a Etapa 09;
- converter o prazo local para ISO UTC antes do envio e fazer a conversão inversa na edição;
- bloquear mutations na interface quando o projeto estiver arquivado;
- corrigir a paginação no próprio fluxo da mutation, sem `setState` síncrono dentro de `useEffect`.

### Decisão do desenvolvedor

O desenvolvedor decidiu:

- preservar integralmente o backend nesta etapa, pois o contrato atual já atende à lista e ao formulário;
- implementar lista paginada com busca, status e prioridade;
- exibir título, descrições, status, prioridade, prazo, tags e quantidade de anexos;
- permitir mudança de status diretamente em cada item;
- manter anexos apenas como contador nesta etapa e implementar upload/download na Etapa 09;
- incluir o botão de kanban desabilitado somente como indicação da próxima entrega;
- tratar projetos arquivados como somente leitura também na interface;
- incorporar como baseline as correções realizadas após a Etapa 06 em `ProjectsPage.tsx`, `styles.css` e `App.tsx`;
- não adicionar entrada ao `DECISIONS.md`, porque as decisões de UTC, tags e projeto arquivado já estavam registradas.

### Alterações humanas

Cabe ao desenvolvedor:

- aplicar o patch sobre o repositório já corrigido da Etapa 06;
- revisar os textos e o layout no navegador;
- validar o horário exibido no fuso local e o valor UTC enviado à API;
- testar criação, edição, filtros, mudança de status e exclusão com dados reais;
- executar ESLint, TypeScript, Vitest e build;
- revisar e ajustar os testes caso o ambiente local tenha particularidades;
- realizar o commit somente após as validações reais.

### Problemas identificados

- `datetime-local` não inclui timezone; enviar seu valor diretamente quebraria o contrato UTC da API.
- Alterar o status de uma tarefa pode removê-la da lista quando existe filtro por status.
- Excluir o último item de uma página pode deixar o usuário em uma página vazia.
- Um formulário de tags sem normalização permitiria duplicatas por caixa e espaços.
- Mutations em projeto arquivado devem ser bloqueadas na interface, mas o backend continua sendo a proteção autoritativa.
- O kanban não deve ser antecipado sem drag-and-drop persistido e rollback, previstos para a Etapa 08.
- O ambiente de preparação não disponibilizou as dependências npm no registry interno.

### Validação

Foram realizadas durante a preparação:

- inspeção dos schemas e endpoints reais de tarefas;
- análise sintática dos arquivos TypeScript e TSX com o compilador TypeScript disponível no ambiente;
- verificação de whitespace com `git diff --check`;
- revisão da conversão entre horário local e UTC;
- revisão das chaves de cache e invalidações do TanStack Query;
- criação de testes para listagem, criação, atualização de status e modo somente leitura;
- confirmação de que nenhum arquivo Python ou migration foi alterado;
- revisão da separação entre `docs/etapas/etapa-07-lista-tarefas.md` e `docs/prompts/prompt-etapa-07-lista-tarefas.md`.

Não foram executados neste ambiente:

- `npm run lint`;
- `npx tsc --noEmit` com as dependências instaladas;
- `npm run test`;
- `npm run build`;
- validação manual no navegador com a API real.

Nenhum resultado pendente é apresentado como aprovado.

### Resultado

A Etapa 07 foi preparada com lista de tarefas, formulário completo, filtros, paginação, mudança rápida de status, prazo UTC, tags básicas, modo somente leitura e testes dos fluxos críticos.

A conclusão efetiva depende da aplicação do patch e das validações reais executadas pelo desenvolvedor.

---

## Etapa 08 - Kanban e drag-and-drop persistido

### Objetivo

Implementar a visualização kanban das tarefas, permitir a mudança de status por drag-and-drop e garantir consistência visual quando a persistência na API falhar.

### Uso da IA

A IA foi utilizada como ferramenta de apoio para:

- pesquisar a composição recomendada de `DndContext`, sensores, elementos draggable e áreas droppable;
- comparar um kanban baseado em ordenação com um quadro baseado somente em mudança de status;
- sugerir uma estratégia para carregar todas as páginas sem criar endpoint novo;
- levantar alternativas de atualização otimista e rollback com TanStack Query;
- revisar a separação entre componentes visuais, consulta completa e mutation de status;
- propor cenários de teste para paginação acumulada, persistência e restauração do cache;
- organizar a documentação e os comandos de validação.

A ferramenta não definiu autonomamente a implementação final. O desenvolvedor permaneceu responsável pela seleção da abordagem, integração com o código existente, ajustes de interface e validação no ambiente real.

### Sugestão inicial

A análise assistida apresentou duas alternativas:

1. usar `@dnd-kit/sortable` e manter ordenação interna nas colunas;
2. usar os primitives de `@dnd-kit/core`, tratando cada tarefa como draggable e cada status como droppable.

Também foi sugerido:

- manter o backend inalterado, pois `PATCH /tasks/{id}` já persiste o status;
- buscar páginas de cem itens até atingir `pages`;
- manter lista paginada e kanban completo como queries diferentes;
- atualizar os caches antes da resposta da API;
- salvar snapshots e restaurá-los em `onError`;
- disponibilizar um `select` como alternativa acessível ao arraste;
- usar handle focável e sensor de teclado.

### Decisão do desenvolvedor

O desenvolvedor decidiu:

- utilizar apenas `@dnd-kit/core`, pois o domínio não persiste ordem manual entre tarefas;
- modelar as quatro colunas como destinos de status;
- manter a ordenação recebida da API dentro de cada coluna;
- carregar todas as páginas por chamadas sucessivas ao endpoint existente, com tamanho máximo de cem itens;
- preservar prioridade e busca no kanban, removendo somente o filtro de status ao entrar no quadro;
- aplicar atualização otimista nos caches de lista, kanban e detalhe;
- restaurar exatamente os snapshots anteriores quando o PATCH falhar;
- invalidar as queries ao final para confirmar o estado autoritativo do backend;
- manter seleção de status como alternativa acessível e útil em dispositivos sem drag-and-drop preciso;
- bloquear drag, edição, exclusão e mudança de status em projetos arquivados;
- não alterar o backend ou criar migration nesta etapa.

### Alterações humanas

Cabe ao desenvolvedor:

- aplicar o patch sobre o estado real corrigido da Etapa 07;
- executar `npm install` e versionar o `package-lock.json` atualizado;
- verificar o comportamento do drag com mouse, toque e teclado;
- revisar a experiência responsiva do quadro no navegador;
- executar lint, type-check, testes e build;
- adaptar qualquer diferença provocada por alterações locais;
- decidir a aceitação e realizar o commit.

### Problemas identificados

- Uma listagem paginada comum poderia ocultar tarefas no kanban.
- O filtro de status não pode permanecer ativo no quadro, pois eliminaria colunas inteiras.
- Uma mudança apenas visual poderia divergir do PostgreSQL após falha de rede ou regra de negócio.
- Copiar os dados para estado local criaria duas fontes de verdade em relação ao TanStack Query.
- Ordenação com `sortable` introduziria uma semântica que o backend não persiste.
- O ambiente de preparação não disponibilizou `@dnd-kit/core` no registry npm interno.
- A validação real do drag depende do navegador e não pode ser substituída apenas por testes em jsdom.

### Validação

Durante a preparação foram executadas:

- análise sintática dos arquivos TypeScript e TSX pelo parser do TypeScript;
- verificação de equilíbrio das chaves CSS;
- `git diff --check`;
- inspeção do fluxo de consulta acumulada;
- inspeção do snapshot e rollback dos caches;
- aplicação limpa do patch em uma cópia do estado-base da Etapa 07.

Não foram executados neste ambiente:

- `npm install`, devido à indisponibilidade de `@dnd-kit/core` no registry interno;
- ESLint;
- type-check completo com dependências instaladas;
- Vitest;
- build do Vite;
- validação do drag no navegador.

Essas validações permanecem obrigatórias no ambiente do desenvolvedor. Nenhum resultado pendente é apresentado como aprovado.

### Resultado

A Etapa 08 foi preparada com toggle funcional, quadro completo, quatro colunas, drag-and-drop, persistência do status, atualização otimista, rollback, alternativa acessível e testes dos comportamentos críticos.

A etapa somente deve ser considerada concluída após aplicação e validação real pelo desenvolvedor.

---

## Etapa 09 - Tags e anexos no frontend

### Objetivo

Completar no frontend a experiência de tags e anexos, adicionando autocomplete de tags e os fluxos autenticados de upload, listagem, download e exclusão de arquivos por tarefa.

### Uso da IA

A IA foi utilizada como ferramenta de apoio para:

- comparar um campo livre de tags com um componente de autocomplete;
- revisar o contrato existente de `GET /tags` e dos endpoints de anexos;
- identificar que o download autenticado exige `fetch` e Blob, pois um link comum não envia o bearer token;
- sugerir a separação da gestão de anexos em um diálogo próprio;
- levantar riscos no envio de `FormData`, especialmente a definição incorreta do boundary;
- propor invalidação dos caches de lista e kanban após upload ou exclusão;
- revisar o comportamento esperado de projetos arquivados;
- estruturar cenários de teste para sugestões, upload, download, exclusão e modo somente leitura.

A ferramenta não tomou decisões autônomas nem executou a integração no ambiente do projeto. A seleção da abordagem, a implementação, as adaptações ao código existente, a validação e a responsabilidade técnica permanecem com o desenvolvedor.

### Sugestão inicial

A análise assistida sugeriu:

- manter a entrada textual de tags, adicionando uma lista de sugestões reutilizáveis;
- permitir que nomes inexistentes continuem sendo enviados e criados pelo backend;
- consultar tags somente enquanto o campo estiver em uso;
- criar um diálogo específico de anexos acessível pela lista e pelo kanban;
- usar `FormData` sem definir manualmente `Content-Type`;
- estender o cliente HTTP com parser de Blob sem duplicar a lógica de refresh token;
- invalidar lista e kanban após alterações em anexos;
- validar no navegador os tipos permitidos e o limite de 5 MB, mantendo o backend como validação autoritativa;
- permitir download em projeto arquivado e ocultar upload e exclusão.

### Decisão do desenvolvedor

O desenvolvedor decidiu:

- manter tags como nomes no payload de tarefa, preservando o contrato já existente;
- criar autocomplete que lista tags do próprio usuário e permite novos nomes;
- integrar o campo ao React Hook Form por meio de `Controller`;
- criar `TaskAttachmentsDialog` separado do formulário de tarefa;
- manter a criação de tarefa independente do upload, pois anexos exigem um `task_id` persistido;
- realizar download autenticado por Blob, reutilizando a renovação automática de sessão;
- atualizar o cache específico de anexos e invalidar as representações de tarefas;
- preservar download e consulta em projetos arquivados, bloqueando upload e exclusão;
- não alterar o backend nem criar migration;
- não adicionar entrada ao `DECISIONS.md`, pois a modelagem de tags, a abstração de storage e o modo somente leitura já estavam aprovados.

### Alterações humanas

O desenvolvedor incorporou à base desta etapa as correções identificadas durante a validação anterior:

- retenção do cache no teste de rollback do kanban;
- barra horizontal superior sincronizada para melhorar a usabilidade do quadro em largura reduzida;
- demais ajustes locais de lint, testes e imports já aplicados nas etapas anteriores.

Também cabe ao desenvolvedor:

- aplicar o patch sobre o repositório real;
- revisar os textos e o comportamento visual no navegador;
- testar arquivos JPEG, PNG, WebP e PDF reais;
- confirmar o limite de 5 MB e as mensagens retornadas pela API;
- executar lint, type-check, Vitest e build;
- corrigir diferenças do ambiente local;
- realizar o commit somente após aceitar os resultados.

### Problemas identificados

- Links diretos para anexos não enviam o token de autenticação.
- Definir manualmente `Content-Type: multipart/form-data` impede que o navegador inclua o boundary.
- Um autocomplete que consulta sempre, mesmo fechado, criaria requisições desnecessárias e interferiria em testes existentes.
- Upload durante a criação da tarefa exigiria coordenar duas operações antes de existir `task_id`.
- Atualizar apenas o diálogo deixaria contadores antigos na lista e no kanban.
- Projetos arquivados precisam permitir consulta sem permitir mutação.
- A validação do navegador melhora a experiência, mas não substitui a validação autoritativa do backend.

### Validação

Durante a preparação foram executadas:

- análise sintática dos arquivos TypeScript e TSX com o parser do TypeScript;
- verificação de equilíbrio das chaves CSS;
- `git diff --check`;
- inspeção do fluxo de `FormData`;
- inspeção do download autenticado com Blob;
- inspeção das invalidações de cache;
- aplicação das alterações sobre uma cópia do estado corrigido da Etapa 08.

Não foram executados neste ambiente:

- ESLint, porque as dependências do projeto não estavam instaladas;
- type-check completo com todas as dependências;
- Vitest, porque o registry interno não disponibilizou o pacote;
- build do Vite;
- validação com navegador e backend ativos.

Nenhum desses resultados pendentes é apresentado como aprovado.

### Resultado

A Etapa 09 foi preparada com autocomplete de tags, criação de novos nomes, diálogo de anexos, upload, listagem, download autenticado, exclusão, atualização de caches, modo somente leitura e testes dos fluxos principais.

A etapa somente deve ser considerada concluída após aplicação e validação real pelo desenvolvedor.
````

### `docs/CURRENT_STATE.md`

````markdown
# Estado atual

## Concluído

- Diagnóstico e decisões iniciais documentados.
- Baseline Alembic e contrato Taskly para tarefas implementados.
- Status `cancelled`, `short_description` e `due_at` em UTC implementados.
- Testes de ownership com dois usuários adicionados.
- Repositório organizado como monorepo com `backend/`, `frontend/` e `docs/`.
- Tags relacionais por usuário e associação many-to-many implementadas no backend.
- Anexos com storage desacoplado, ownership e limpeza física implementados no backend.
- Endpoint de refresh token e autenticação persistente implementados.
- Gestão de projetos no frontend implementada.
- Lista paginada de tarefas e formulário completo implementados.
- Quadro kanban com quatro colunas e carregamento completo implementado.
- Drag-and-drop de status com atualização otimista e rollback implementado.
- Correção do teste de rollback com retenção explícita do cache incorporada.
- Barra horizontal superior sincronizada do kanban incorporada.
- Autocomplete de tags integrado ao formulário de tarefas.
- Upload, listagem, download e exclusão de anexos implementados no frontend.
- Consulta de anexos preservada em projetos arquivados, com alterações bloqueadas.
- Testes de autocomplete e dos fluxos principais de anexos preparados.

## Em desenvolvimento

- Aplicação da Etapa 09 no repositório do desenvolvedor.
- Validação real de ESLint, TypeScript, Vitest, build e navegador.
- Revisão do fluxo de anexos com arquivos reais e API ativa.

## Pendente

- Corrigir eventuais falhas encontradas na validação local da Etapa 09.
- Executar o commit da Etapa 09.
- Consolidar e ampliar a suíte de testes na Etapa 10.
- Consolidar Docker fullstack e deploy.
- Finalizar README, SPEC, arquitetura, validação e vídeo.

## Último commit

- Etapa 09 ainda não commitada.
- Mensagem planejada: `feat: integra tags e anexos no frontend`
````

### `docs/prompts/prompt-etapa-09-tags-anexos-frontend.md`

````markdown
# Prompt da Etapa 09 — Tags e anexos no frontend

## Finalidade

Registrar o contexto em que a IA foi utilizada como ferramenta de pesquisa, comparação de alternativas e revisão técnica para a integração visual de tags e anexos, sem atribuir à ferramenta as decisões ou a implementação final.

## Contexto fornecido pelo desenvolvedor

- O backend já possui tags relacionais por usuário.
- O backend já possui upload, listagem, download e exclusão autenticada de anexos.
- A lista e o kanban de tarefas já exibem tags e quantidade de anexos.
- O formulário da Etapa 07 aceita nomes de tags separados por vírgula.
- O projeto arquivado deve permanecer somente leitura.
- O download exige autenticação e não pode depender de um link público simples.
- As correções da Etapa 08 já fazem parte da base: cache preservado no teste de rollback e barra horizontal superior sincronizada no kanban.

## Solicitação feita à IA

> Compare alternativas para autocomplete de tags e gestão de anexos no frontend. Sugira uma implementação compatível com React, TypeScript, TanStack Query, React Hook Form e os endpoints existentes. Preserve o backend, permita upload, listagem, download e exclusão, mantenha download em projetos arquivados, bloqueie alterações nesses projetos, valide tipo e tamanho antes do envio e prepare testes. A IA deve atuar como apoio; as decisões, a implementação, as adaptações, os testes e a responsabilidade final pertencem ao desenvolvedor.

## Restrições aplicadas

- Não criar migration ou alterar o backend sem necessidade comprovada.
- Não tornar o storage local acessível por URL pública sem autenticação.
- Não definir manualmente o `Content-Type` de `FormData`.
- Não permitir upload ou exclusão em projeto arquivado.
- Não impedir consulta e download em projeto arquivado.
- Não duplicar os dados remotos em estado local global.
- Não registrar validações como aprovadas sem saída real.
- Manter documento técnico e prompt em arquivos diferentes.

## Resultado utilizado pelo desenvolvedor

O material de apoio foi usado para comparar:

- campo livre de tags versus autocomplete com possibilidade de criar novos nomes;
- anexos dentro do formulário versus diálogo específico por tarefa;
- links diretos versus download autenticado em Blob;
- atualização manual de contadores versus invalidação dos caches do TanStack Query;
- validação somente no backend versus validação antecipada também no navegador.

O desenvolvedor selecionou a abordagem aplicada, integrou os componentes ao código existente e permanece responsável pela validação no ambiente real.
````

## 6. Comandos de validação

### Raiz do frontend

```powershell
cd frontend

npm install
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
```

### Testes específicos

```powershell
npx vitest run src/features/tags/components/TagAutocompleteInput.test.tsx `
  --pool=threads `
  --no-file-parallelism `
  --reporter=verbose

npx vitest run src/features/attachments/components/TaskAttachmentsDialog.test.tsx `
  --pool=threads `
  --no-file-parallelism `
  --reporter=verbose
```

### Validação manual

1. Criar ou editar uma tarefa.
2. Focar o campo de tags e selecionar uma sugestão existente.
3. Informar um nome inexistente e confirmar que ele é criado ao salvar.
4. Abrir “Anexos” pela lista.
5. Enviar JPEG, PNG, WebP e PDF válidos.
6. Confirmar que arquivos maiores que 5 MB são bloqueados antes do request.
7. Confirmar que tipos não permitidos são bloqueados.
8. Baixar um arquivo e abrir o conteúdo salvo.
9. Excluir um anexo e confirmar a atualização do contador.
10. Repetir o acesso pelo kanban.
11. Arquivar o projeto e confirmar que download permanece disponível, sem upload ou exclusão.
12. Expirar o access token e confirmar que o download utiliza refresh de sessão.

## 7. Passo a passo do commit

Execute na raiz do repositório:

```powershell
git status

git add frontend/src/api/client.ts
git add frontend/src/features/tags
git add frontend/src/features/attachments
git add frontend/src/features/tasks/components
git add frontend/src/features/projects/pages/ProjectWorkspacePage.tsx
git add frontend/src/styles.css
git add frontend/README.md README.md
git add docs/AI_USAGE.md docs/CURRENT_STATE.md
git add docs/etapas/etapa-09-tags-anexos-frontend.md
git add docs/prompts/prompt-etapa-09-tags-anexos-frontend.md

git diff --cached
git status

git commit -m "feat: integra tags e anexos no frontend"
git push origin main
```

## 8. Problemas comuns e como resolver

### Upload retorna erro de multipart

**Causa provável:** `Content-Type` foi definido manualmente.

**Correção:** envie `FormData` sem definir esse header. O navegador deve criar o boundary.

### Download abre como não autorizado

**Causa provável:** uso de link direto para o endpoint protegido.

**Correção:** mantenha o download via `apiDownload`, Blob e anchor temporário.

### Sugestões geram requests durante todos os testes

**Causa provável:** query habilitada mesmo quando o campo está fechado.

**Correção:** preserve o parâmetro `enabled` associado ao estado do autocomplete.

### Contador de anexos não atualiza

**Causa provável:** cache da tarefa não foi invalidado.

**Correção:** confirme a invalidação de `taskKeys.lists()` e `taskKeys.boards()` após upload e exclusão.

### Arquivo válido é recusado

**Causa provável:** MIME fornecido pelo navegador difere do permitido ou o arquivo ultrapassa 5 MB.

**Correção:** confira `file.type`, tamanho e a validação autoritativa retornada pelo backend.

### Projeto arquivado permite mutação

**Causa provável:** `isReadOnly` não foi propagado ao diálogo.

**Correção:** confirme que o workspace passa o status do projeto e que upload/exclusão não são renderizados.

### `URL.createObjectURL` não existe no teste

**Correção:** defina mocks de `createObjectURL`, `revokeObjectURL` e `HTMLAnchorElement.click` no cenário de download.

## 9. Checklist da etapa

- [x] Cliente HTTP suporta download Blob autenticado.
- [x] Autocomplete consulta tags do usuário.
- [x] Novos nomes continuam permitidos.
- [x] Campo integrado ao React Hook Form.
- [x] Diálogo de anexos criado.
- [x] Upload com `FormData` implementado.
- [x] Validação antecipada de tipo e tamanho implementada.
- [x] Listagem de anexos implementada.
- [x] Download autenticado implementado.
- [x] Exclusão com confirmação implementada.
- [x] Lista e kanban abrem a gestão de anexos.
- [x] Caches de tarefas são invalidados.
- [x] Projetos arquivados mantêm consulta e download.
- [x] Projetos arquivados bloqueiam upload e exclusão.
- [x] Testes dos fluxos principais preparados.
- [x] `AI_USAGE.md` atualizado.
- [x] `CURRENT_STATE.md` atualizado.
- [x] Prompt separado do documento técnico.
- [ ] ESLint executado pelo desenvolvedor.
- [ ] TypeScript executado pelo desenvolvedor.
- [ ] Vitest executado pelo desenvolvedor.
- [ ] Build executado pelo desenvolvedor.
- [ ] Fluxo validado no navegador com backend real.
- [ ] Commit executado pelo desenvolvedor.

## 10. Validações realizadas durante a preparação

Foram realizadas:

- análise sintática de 49 arquivos TypeScript e TSX;
- verificação de equilíbrio das chaves CSS;
- `git diff --check`;
- inspeção do fluxo multipart;
- inspeção do download autenticado;
- inspeção das invalidações de cache;
- reconstrução e aplicação sobre o estado corrigido da Etapa 08.

Não foram executados ESLint, type-check completo, Vitest ou build porque o ambiente de preparação não possuía as dependências npm e o registry interno não disponibilizou o Vitest. Esses resultados não são apresentados como aprovados.

## 11. Próxima etapa

**Etapa 10 — Testes e estabilização**

A próxima etapa deverá:

1. revisar toda a suíte backend e frontend;
2. consolidar testes de ownership, migrations, autenticação e CRUD;
3. ampliar testes de erros e estados vazios;
4. revisar responsividade e acessibilidade;
5. corrigir regressões encontradas;
6. registrar resultados reais em `VALIDATION.md` e `AI_USAGE.md`;
7. preparar a base estável para Docker fullstack e deploy.
