# Etapa 08 — Kanban com drag-and-drop persistido

## 1. Objetivo da etapa

Adicionar ao workspace de projeto uma visualização kanban completa, com quatro colunas correspondentes aos status do domínio, toggle entre lista e quadro e mudança de status por drag-and-drop persistida na API.

A etapa também deve garantir que o quadro não fique limitado à primeira página da listagem e que uma falha de persistência restaure o estado visual anterior.

Esta etapa altera exclusivamente o frontend. O backend já oferece `PATCH /api/v1/tasks/{task_id}` e os quatro status exigidos.

## 2. O que foi feito e por quê

Foram implementados:

- dependência `@dnd-kit/core`;
- toggle funcional entre lista e kanban;
- quatro colunas: Não iniciada, Em andamento, Concluída e Cancelada;
- cards draggable e colunas droppable;
- handle de arraste focável;
- sensores de ponteiro e teclado;
- alternativa de mudança de coluna por `select`;
- carregamento sucessivo de todas as páginas, com cem itens por requisição;
- query específica do kanban separada da lista paginada;
- atualização otimista dos caches do TanStack Query;
- snapshot e rollback em falha do `PATCH`;
- invalidação posterior para confirmação pelo backend;
- bloqueio das interações em projeto arquivado;
- filtros de prioridade e busca no quadro;
- remoção do filtro de status ao entrar no kanban;
- edição e exclusão também disponíveis nos cards;
- layout horizontal responsivo;
- testes para carregamento de múltiplas páginas, persistência e rollback.

## 3. Decisões técnicas tomadas

### 3.1. Primitives em vez de sortable

**Alternativas consideradas:**

1. usar `@dnd-kit/sortable` e permitir ordenação dentro das colunas;
2. usar `@dnd-kit/core`, tratando tarefas como draggable e status como droppable.

**Decisão do desenvolvedor:** adotar a segunda alternativa.

**Motivo:** o domínio atual persiste status, mas não possui campo de ordenação. Uma interface sortable sugeriria ao usuário uma ordem que seria perdida após recarregar. O quadro mantém a ordem retornada pela API e persiste somente a mudança de coluna.

### 3.2. Quadro completo sobre endpoint paginado

O backend limita cada página a cem registros.

**Decisão do desenvolvedor:** criar `listAllProjectTasks`, que busca a primeira página, lê `pages` e continua até obter todas as páginas.

**Motivo:** evita criar endpoint específico sem necessidade e impede que o kanban oculte tarefas.

### 3.3. Queries distintas para lista e kanban

A lista permanece paginada. O kanban usa uma query cujo resultado é `Task[]` completo.

**Motivo:** cada visualização conserva seu contrato natural sem duplicar os dados em estado local do componente.

### 3.4. Atualização otimista com rollback

Antes do PATCH, a mutation:

1. cancela refetches de lista, quadro e detalhe;
2. salva snapshots dos caches;
3. altera o status em todos os caches relevantes;
4. persiste a mudança;
5. restaura snapshots em `onError`;
6. invalida lista e quadro em `onSettled`.

**Motivo:** o card responde imediatamente ao arraste, mas não permanece na coluna errada se a API rejeitar a alteração.

### 3.5. Acessibilidade e alternativa ao drag

O handle recebe foco, atributos e listeners do `useDraggable`. Também existe um `select` de status em cada card.

**Motivo:** drag-and-drop não deve ser a única forma de executar uma operação essencial, especialmente em teclado e dispositivos de toque.

### 3.6. Filtros no kanban

Prioridade e busca permanecem disponíveis. O filtro de status é limpo e escondido no quadro.

**Motivo:** o status já é representado pelas quatro colunas; manter o filtro poderia criar um kanban incompleto e contraditório.

### 3.7. Projeto arquivado

Draggable, droppable, select, edição e exclusão ficam desabilitados.

**Motivo:** preserva a regra de somente leitura já adotada no backend e nas etapas anteriores.

### 3.8. `DECISIONS.md`

Não foi criada nova entrada. O carregamento completo do kanban e a atualização otimista com rollback já haviam sido aprovados no diagnóstico inicial. A etapa apenas concretiza essas decisões.

## 4. Dependências entre arquivos e ordem de criação

1. `package.json` adiciona o dnd-kit.
2. `types.ts` define os filtros específicos do quadro.
3. `api.ts` implementa a consulta acumulada.
4. `hooks.ts` cria a query do quadro e a mutation otimista.
5. `KanbanTaskCard.tsx` conecta cada tarefa ao `useDraggable`.
6. `KanbanColumn.tsx` conecta cada status ao `useDroppable`.
7. `KanbanBoard.tsx` coordena contexto, sensores, overlay e drop.
8. `ProjectWorkspacePage.tsx` integra toggle, filtros, queries e mutations.
9. Os testes validam paginação acumulada, PATCH e rollback.
10. `styles.css` implementa layout, estados de drop e responsividade.
11. READMEs e documentos globais refletem o novo estado.

## 5. Conteúdo completo dos arquivos criados ou alterados

O conteúdo deste documento não é repetido dentro dele para evitar recursão. Os demais arquivos são reproduzidos abaixo.

### `frontend/package.json`

````json
{
  "name": "taskly-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@hookform/resolvers": "^5.2.1",
    "@tanstack/react-query": "^5.101.4",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "react-hook-form": "^7.82.0",
    "react-router-dom": "^7.18.1",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^24.10.1",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.4",
    "eslint": "^9.39.1",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24",
    "globals": "^16.5.0",
    "jsdom": "^27.2.0",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.48.0",
    "vite": "^8.1.5",
    "vitest": "^4.1.10"
  },
  "engines": {
    "node": ">=20.19.0"
  }
}

````

### `frontend/src/features/tasks/types.ts`

````typescript
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface TaskTag {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface TaskAttachment {
  id: string
  task_id: string
  name: string
  url: string
  content_type: string
  size_bytes: number
  created_at: string
}

export interface Task {
  id: string
  project_id: string
  title: string
  short_description: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_at: string | null
  tags: TaskTag[]
  attachments: TaskAttachment[]
  created_at: string
  updated_at: string
}

export interface PaginatedTasks {
  items: Task[]
  total: number
  page: number
  size: number
  pages: number
}

export interface TaskBoardFilters {
  projectId: string
  priority?: TaskPriority
  search?: string
}

export interface TaskFilters {
  projectId: string
  page: number
  size: number
  status?: TaskStatus
  priority?: TaskPriority
  search?: string
}

export interface TaskCreatePayload {
  project_id: string
  title: string
  short_description: string
  description: string | null
  priority: TaskPriority
  due_at: string | null
  tags: string[]
}

export interface TaskUpdatePayload {
  title?: string
  short_description?: string
  description?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  due_at?: string | null
  tags?: string[]
}

export interface TaskFormSubmission {
  title: string
  short_description: string
  description: string | null
  priority: TaskPriority
  due_at: string | null
  tags: string[]
  status?: TaskStatus
}

````

### `frontend/src/features/tasks/api.ts`

````typescript
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

````

### `frontend/src/features/tasks/hooks.ts`

````typescript
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
  onStatusChange?: (task: Task, status: TaskStatus) => void
}

export function KanbanTaskCardContent({
  task,
  isOverlay = false,
  isBusy = false,
  isReadOnly = false,
  onEdit,
  onDelete,
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
  onStatusChange: (task: Task, status: TaskStatus) => void
}

export function KanbanTaskCard({
  task,
  isBusy,
  isReadOnly,
  onEdit,
  onDelete,
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
import { useState } from 'react'
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
  onStatusChange,
}: KanbanBoardProps) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor),
  )

  const activeTask = activeTaskId
    ? tasks.find((task) => task.id === activeTaskId) ?? null
    : null

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null)

    const task = tasks.find((item) => item.id === event.active.id)
    const targetStatus = event.over?.data.current?.status

    if (!task || !isTaskStatus(targetStatus) || task.status === targetStatus) {
      return
    }

    onStatusChange(task, targetStatus)
  }

  return (
    <div className="kanban-scroll" aria-label="Quadro kanban de tarefas">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragCancel={() => setActiveTaskId(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-board">
          {columns.map((column) => (
            <KanbanColumn
              key={column.status}
              status={column.status}
              title={column.title}
              tasks={tasks.filter((task) => task.status === column.status)}
              isBusy={isBusy}
              isReadOnly={isReadOnly}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="kanban-task-card kanban-task-overlay">
              <KanbanTaskCardContent task={activeTask} isOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

````

### `frontend/src/features/projects/pages/ProjectWorkspacePage.tsx`

````tsx
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../../api/client'
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
    </main>
  )
}

````

### `frontend/src/features/projects/pages/ProjectWorkspacePage.test.tsx`

````tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { Project } from '../types'
import { ProjectWorkspacePage } from './ProjectWorkspacePage'
import type { Task } from '../../tasks/types'

const activeProject: Project = {
  id: 'project-1',
  owner_id: 'user-1',
  name: 'Portal do cliente',
  description: 'Nova área autenticada.',
  status: 'active',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
}

function taskFixture(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    project_id: 'project-1',
    title: 'Revisar autenticação',
    short_description: 'Validar o fluxo de sessão persistente.',
    description: 'Confirmar login, refresh e logout em todos os cenários.',
    status: 'todo',
    priority: 'high',
    due_at: '2026-08-05T18:30:00Z',
    tags: [
      {
        id: 'tag-1',
        name: 'frontend',
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
    ],
    attachments: [],
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function requestDetails(input: RequestInfo | URL, init?: RequestInit) {
  if (input instanceof Request) {
    return { url: input.url, method: input.method }
  }

  return { url: String(input), method: init?.method ?? 'GET' }
}

function installApiMock({
  project = activeProject,
  initialTasks = [taskFixture()],
  kanbanPages,
}: {
  project?: Project
  initialTasks?: Task[]
  kanbanPages?: Task[][]
} = {}) {
  let tasks = [...initialTasks]

  return vi.spyOn(window, 'fetch').mockImplementation(async (input, init) => {
    const { url, method } = requestDetails(input, init)

    if (url.endsWith('/projects/project-1') && method === 'GET') {
      return jsonResponse(project)
    }

    if (url.includes('/tasks?') && method === 'GET') {
      const parsedUrl = new URL(url)
      const requestedPage = Number(parsedUrl.searchParams.get('page') ?? '1')
      const requestedSize = Number(parsedUrl.searchParams.get('size') ?? '8')

      if (requestedSize === 100 && kanbanPages) {
        const pageItems = kanbanPages[requestedPage - 1] ?? []
        const total = kanbanPages.reduce(
          (sum, currentPage) => sum + currentPage.length,
          0,
        )

        return jsonResponse({
          items: pageItems,
          total,
          page: requestedPage,
          size: requestedSize,
          pages: kanbanPages.length,
        })
      }

      return jsonResponse({
        items: tasks,
        total: tasks.length,
        page: requestedPage,
        size: requestedSize,
        pages: tasks.length > 0 ? 1 : 0,
      })
    }

    if (url.endsWith('/tasks') && method === 'POST') {
      const payload = JSON.parse(String(init?.body)) as Record<string, unknown>
      const createdTask = taskFixture({
        id: 'task-created',
        title: String(payload.title),
        short_description: String(payload.short_description),
        description: payload.description as string | null,
        priority: payload.priority as Task['priority'],
        due_at: payload.due_at as string | null,
        tags: (payload.tags as string[]).map((name, index) => ({
          id: `tag-created-${index}`,
          name,
          created_at: '2026-08-01T00:00:00Z',
          updated_at: '2026-08-01T00:00:00Z',
        })),
      })
      tasks = [createdTask, ...tasks]
      return jsonResponse(createdTask, 201)
    }

    if (url.endsWith('/tasks/task-1') && method === 'PATCH') {
      const payload = JSON.parse(String(init?.body)) as Partial<Task>
      tasks = tasks.map((task) =>
        task.id === 'task-1' ? { ...task, ...payload } : task,
      )
      return jsonResponse(tasks.find((task) => task.id === 'task-1'))
    }

    throw new Error(`Requisição não simulada: ${method} ${url}`)
  })
}

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app/projects/project-1']}>
        <Routes>
          <Route
            path="/app/projects/:projectId"
            element={<ProjectWorkspacePage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProjectWorkspacePage', () => {
  it('renders the project tasks with status, priority, tags and due date', async () => {
    installApiMock()
    renderWorkspace()

    expect(await screen.findByRole('heading', { name: 'Portal do cliente' })).toBeVisible()
    expect(await screen.findByText('Revisar autenticação')).toBeVisible()
    expect(screen.getByText('Prioridade alta')).toBeVisible()
    expect(screen.getByText('frontend')).toBeVisible()
    expect(screen.getByText(/Prazo:/)).toBeVisible()
  })

  it('creates a task and sends the local deadline normalized as an ISO instant', async () => {
    const fetchSpy = installApiMock({ initialTasks: [] })
    renderWorkspace()

    fireEvent.click(await screen.findByRole('button', { name: 'Criar tarefa' }))
    const dialog = screen.getByRole('dialog', { name: 'Planeje o próximo trabalho' })

    fireEvent.change(within(dialog).getByLabelText('Título'), {
      target: { value: 'Preparar demonstração' },
    })
    fireEvent.change(within(dialog).getByLabelText('Descrição curta'), {
      target: { value: 'Organizar o roteiro funcional do Taskly.' },
    })
    fireEvent.change(within(dialog).getByLabelText('Descrição completa'), {
      target: { value: 'Mostrar autenticação, projetos e tarefas.' },
    })
    fireEvent.change(within(dialog).getByLabelText('Prioridade'), {
      target: { value: 'high' },
    })
    fireEvent.change(within(dialog).getByLabelText('Prazo'), {
      target: { value: '2026-08-06T14:30' },
    })
    fireEvent.change(within(dialog).getByLabelText('Tags'), {
      target: { value: 'demo, frontend, demo' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar tarefa' }))

    expect(await screen.findByText('Preparar demonstração')).toBeVisible()

    const postCall = fetchSpy.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(postCall).toBeDefined()

    const payload = JSON.parse(String(postCall?.[1]?.body)) as {
      due_at: string
      tags: string[]
    }
    expect(new Date(payload.due_at).toISOString()).toBe(payload.due_at)
    expect(payload.tags).toEqual(['demo', 'frontend'])
  })

  it('updates the task status directly from the list', async () => {
    const fetchSpy = installApiMock()
    renderWorkspace()

    const statusSelect = await screen.findByRole('combobox', {
      name: 'Status de Revisar autenticação',
    })
    fireEvent.change(statusSelect, { target: { value: 'done' } })

    await waitFor(() => expect(statusSelect).toHaveValue('done'))

    const patchCall = fetchSpy.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(patchCall?.[1]?.body).toBe(JSON.stringify({ status: 'done' }))
  })

  it('loads every API page when the kanban view is opened', async () => {
    const secondTask = taskFixture({
      id: 'task-2',
      title: 'Publicar ambiente',
      short_description: 'Disponibilizar a aplicação para validação.',
      status: 'done',
    })
    const fetchSpy = installApiMock({
      kanbanPages: [[taskFixture()], [secondTask]],
    })
    renderWorkspace()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Kanban' }),
    )

    expect(await screen.findByText('Publicar ambiente')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Não iniciada' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Concluída' })).toBeVisible()

    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some(([input]) => {
          const url = input instanceof Request ? input.url : String(input)
          return url.includes('page=2') && url.includes('size=100')
        }),
      ).toBe(true)
    })
  })

  it('persists a status change made from the kanban card', async () => {
    const fetchSpy = installApiMock({
      kanbanPages: [[taskFixture()]],
    })
    renderWorkspace()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Kanban' }),
    )

    const moveSelect = await screen.findByRole('combobox', {
      name: 'Mover Revisar autenticação para outra coluna',
    })
    fireEvent.change(moveSelect, { target: { value: 'in_progress' } })

    await waitFor(() => {
      const patchCall = fetchSpy.mock.calls.find(([, init]) => init?.method === 'PATCH')
      expect(patchCall?.[1]?.body).toBe(JSON.stringify({ status: 'in_progress' }))
    })
  })

  it('keeps an archived project in read-only mode', async () => {
    installApiMock({
      project: { ...activeProject, status: 'archived' },
    })
    renderWorkspace()

    expect(await screen.findByText(/somente leitura/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: '+ Nova tarefa' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: 'Status de Revisar autenticação' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeDisabled()
  })
})

````

### `frontend/src/features/tasks/hooks.test.tsx`

````tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import * as tasksApi from './api'
import { taskKeys, useMoveTaskStatus } from './hooks'
import type { PaginatedTasks, Task, TaskBoardFilters, TaskFilters } from './types'

function taskFixture(): Task {
  return {
    id: 'task-1',
    project_id: 'project-1',
    title: 'Revisar autenticação',
    short_description: 'Validar o fluxo de sessão persistente.',
    description: null,
    status: 'todo',
    priority: 'high',
    due_at: null,
    tags: [],
    attachments: [],
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  }
}

describe('useMoveTaskStatus', () => {
  it('restores list and board caches when status persistence fails', async () => {
    const task = taskFixture()
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    })
    const listFilters: TaskFilters = {
      projectId: 'project-1',
      page: 1,
      size: 8,
    }
    const boardFilters: TaskBoardFilters = {
      projectId: 'project-1',
    }
    const listData: PaginatedTasks = {
      items: [task],
      total: 1,
      page: 1,
      size: 8,
      pages: 1,
    }

    queryClient.setQueryData(taskKeys.list(listFilters), listData)
    queryClient.setQueryData(taskKeys.board(boardFilters), [task])
    queryClient.setQueryData(taskKeys.detail(task.id), task)

    let rejectRequest: ((reason?: unknown) => void) | undefined
    vi.spyOn(tasksApi, 'updateTask').mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject
        }),
    )

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useMoveTaskStatus(), { wrapper })

    let mutationPromise: Promise<Task> | undefined
    act(() => {
      mutationPromise = result.current.mutateAsync({
        task,
        status: 'done',
      })
    })

    await waitFor(() => {
      const board = queryClient.getQueryData<Task[]>(
        taskKeys.board(boardFilters),
      )
      expect(board?.[0].status).toBe('done')
    })

    act(() => {
      rejectRequest?.(new Error('Falha simulada'))
    })
    await expect(mutationPromise).rejects.toThrow('Falha simulada')

    await waitFor(() => {
      const board = queryClient.getQueryData<Task[]>(
        taskKeys.board(boardFilters),
      )
      const list = queryClient.getQueryData<PaginatedTasks>(
        taskKeys.list(listFilters),
      )
      expect(board?.[0].status).toBe('todo')
      expect(list?.items[0].status).toBe('todo')
    })
  })
})

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

.kanban-scroll {
  width: 100%;
  overflow-x: auto;
  padding: 3px 3px 14px;
  scrollbar-color: #c5c0ed transparent;
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
- tags básicas no formulário e na listagem;
- toggle entre lista e kanban;
- carregamento completo das páginas no quadro;
- drag-and-drop de status com atualização otimista e rollback.

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

O frontend possui autenticação persistente, gestão de projetos, lista de tarefas e quadro kanban com drag-and-drop persistido. A gestão visual de anexos e o autocomplete de tags serão implementados na Etapa 09.

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
- Tags relacionais por usuário e associação many-to-many implementadas.
- Anexos com storage desacoplado, ownership e limpeza física implementados.
- Endpoint de refresh token e autenticação persistente no frontend implementados.
- Rotas públicas e protegidas implementadas.
- Gestão completa de projetos no frontend implementada.
- Correções locais das Etapas 05 e 06 incorporadas ao estado-base.
- Lista paginada de tarefas implementada.
- Busca e filtros por status e prioridade implementados.
- Criação, edição, exclusão e mudança rápida de status implementadas.
- Prazo local convertido para UTC no envio e para horário local na edição.
- Tags básicas implementadas no formulário e na lista.
- Modo somente leitura para projetos arquivados implementado no frontend.
- Toggle entre lista e kanban preparado.
- Quadro com quatro colunas implementado.
- Carregamento acumulado de todas as páginas do projeto implementado.
- Drag-and-drop de status com `dnd-kit` implementado.
- Atualização otimista e rollback dos caches implementados.
- Alternativa acessível para mudança de coluna implementada.
- Testes de paginação do kanban, persistência e rollback preparados.

## Em desenvolvimento

- Aplicação da Etapa 08 no repositório do desenvolvedor.
- Instalação de `@dnd-kit/core` e geração do `package-lock.json`.
- Validação real de lint, TypeScript, Vitest, build e navegador.

## Pendente

- Corrigir eventuais falhas encontradas na validação local da Etapa 08.
- Executar o commit da Etapa 08.
- Implementar autocomplete de tags e gestão visual de anexos.
- Consolidar testes e estabilização geral.
- Consolidar Docker fullstack e deploy.
- Finalizar README, SPEC, arquitetura, validação e vídeo.

## Último commit

- Etapa 08 ainda não commitada.
- Mensagem planejada: `feat: implementa kanban com drag-and-drop persistido`

````

### `docs/prompts/prompt-etapa-08-kanban-drag-and-drop.md`

````markdown
# Prompt da Etapa 08 — Kanban e drag-and-drop

## Finalidade

Registrar o contexto em que a IA foi utilizada como apoio de pesquisa, comparação e revisão para a implementação do kanban do Taskly.

## Contexto fornecido pelo desenvolvedor

- Etapas 01 a 07 aplicadas ou preparadas.
- Backend já possui quatro status e endpoint `PATCH /tasks/{task_id}`.
- Frontend já possui lista, formulário, filtros, TanStack Query e mutation de atualização.
- A lista da API é paginada e o kanban precisa representar o projeto completo.
- O projeto arquivado deve permanecer somente leitura.
- A implementação deve usar `dnd-kit`.
- Toda falha de persistência deve restaurar o estado visual anterior.
- Documento técnico e prompt devem permanecer em arquivos distintos.

## Solicitação feita à IA

> Analise o estado consolidado da Etapa 07 e apresente uma implementação para a Etapa 08 com toggle lista/kanban, quatro colunas, carregamento de todas as páginas do projeto, drag-and-drop persistindo o status e rollback em caso de falha. Preserve a arquitetura existente, não altere o backend sem necessidade e prepare testes e documentação. Trate a IA como ferramenta de pesquisa e revisão; decisões, implementação, adaptações e validação pertencem ao desenvolvedor.

## Restrições aplicadas

- Não criar ordenação persistida que não exista no domínio.
- Não carregar somente a primeira página.
- Não manter estado remoto duplicado sem necessidade.
- Não esconder falhas do PATCH.
- Não permitir mutações em projeto arquivado.
- Não afirmar que npm, Vitest, lint ou build foram executados sem saída real.
- Não antecipar a gestão visual de anexos da Etapa 09.

## Resultado utilizado pelo desenvolvedor

O material de apoio foi usado para comparar primitives e sortable, estruturar a query acumulada, organizar os componentes do quadro e revisar o rollback do TanStack Query.

A decisão adotada pelo desenvolvedor foi usar `@dnd-kit/core`, sem ordenação interna persistida, com cada coluna representando um status e cada mudança persistida pelo endpoint já existente.

````

## 6. Comandos de validação

### 6.1. Instalação da dependência

Na raiz do frontend:

```powershell
cd frontend
npm install
```

O comando deve instalar `@dnd-kit/core` e gerar ou atualizar `frontend/package-lock.json`. O lockfile deve ser versionado.

### 6.2. Validações obrigatórias do frontend

```powershell
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
```

Teste isolado do workspace:

```powershell
npx vitest run src/features/projects/pages/ProjectWorkspacePage.test.tsx `
  --pool=threads `
  --no-file-parallelism `
  --reporter=verbose
```

Teste isolado do rollback:

```powershell
npx vitest run src/features/tasks/hooks.test.tsx `
  --pool=threads `
  --no-file-parallelism `
  --reporter=verbose
```

### 6.3. Validação manual

1. criar tarefas em todos os status;
2. criar mais de cem tarefas por API ou ajustar temporariamente a massa de teste e confirmar o carregamento de páginas sucessivas;
3. alternar entre lista e kanban;
4. arrastar uma tarefa entre todas as colunas;
5. atualizar a página e confirmar que o status persistiu;
6. alterar status pelo `select` do card;
7. desligar o backend e tentar mover uma tarefa;
8. confirmar que o card retorna à coluna original e que o erro aparece;
9. testar busca e prioridade no kanban;
10. abrir projeto arquivado e confirmar que os handles e ações estão desabilitados;
11. testar o quadro em largura reduzida e confirmar rolagem horizontal;
12. testar o handle com teclado.

Não registrar os comandos como aprovados antes de executá-los e guardar a saída real.

## 7. Passo a passo do commit

Na raiz do repositório:

```powershell
git status

git add frontend/package.json
git add frontend/package-lock.json
git add frontend/src/features/tasks
git add frontend/src/features/projects/pages/ProjectWorkspacePage.tsx
git add frontend/src/features/projects/pages/ProjectWorkspacePage.test.tsx
git add frontend/src/styles.css
git add frontend/README.md README.md
git add docs/AI_USAGE.md docs/CURRENT_STATE.md
git add docs/etapas/etapa-08-kanban-drag-and-drop.md
git add docs/prompts/prompt-etapa-08-kanban-drag-and-drop.md

git diff --cached
git status

git commit -m "feat: implementa kanban com drag-and-drop persistido"
git push origin main
```

Caso o `package-lock.json` ainda não existisse, confirme que ele foi criado pelo `npm install` antes do commit.

## 8. Problemas comuns e como resolver

### `Cannot find module '@dnd-kit/core'`

Execute `npm install` na pasta `frontend/` e confirme a dependência no `package.json`.

### O card volta para a coluna anterior

Isso é esperado quando o PATCH falha. Verifique a mensagem exibida, a API, o token e se o projeto está ativo.

### O card muda de coluna, mas volta depois do refetch

O backend não aceitou ou não persistiu o status retornado. Inspecione a resposta do PATCH e os logs da API.

### O kanban mostra somente cem tarefas

Confirme que `listAllProjectTasks` está usando `response.pages` e incrementando `currentPage` até a última página.

### O filtro de status desaparece no kanban

É intencional. As próprias colunas representam os quatro status.

### O drag não inicia ao clicar no conteúdo

O arraste é iniciado pelo handle `⋮⋮`. Isso evita conflito com botões, links e seleção de texto dentro do card.

### Projeto arquivado não permite arrastar

É a regra de somente leitura. Restaure o projeto para fazer alterações.

### Vitest não consegue simular o movimento físico do ponteiro

Os testes automatizados cobrem consulta completa, mutation e rollback. O gesto real deve ser validado no navegador, pois jsdom não implementa layout e colisão como um browser.

### Registry não encontra o pacote

Confirme o registry npm do ambiente:

```powershell
npm config get registry
```

Em uma máquina com acesso ao npm público, o pacote deve ser instalado normalmente. Não altere permanentemente configurações corporativas sem autorização.

## 9. Checklist

- [x] Dependência do dnd-kit adicionada.
- [x] Toggle lista/kanban habilitado.
- [x] Quatro colunas implementadas.
- [x] Cards draggable implementados.
- [x] Colunas droppable implementadas.
- [x] Drag overlay implementado.
- [x] Sensor de ponteiro implementado.
- [x] Sensor de teclado implementado.
- [x] Alternativa por select implementada.
- [x] Consulta de todas as páginas implementada.
- [x] Busca e prioridade preservadas no quadro.
- [x] Atualização otimista implementada.
- [x] Rollback implementado.
- [x] Projeto arquivado permanece somente leitura.
- [x] Testes preparados.
- [x] Documento de etapa separado do prompt.
- [ ] `npm install` executado pelo desenvolvedor.
- [ ] `package-lock.json` atualizado e versionado.
- [ ] ESLint aprovado.
- [ ] TypeScript aprovado.
- [ ] Vitest aprovado.
- [ ] Build aprovado.
- [ ] Fluxo real de drag validado no navegador.
- [ ] Commit executado.

## 10. Próxima etapa

**Etapa 09 — Tags e anexos no frontend**

A próxima etapa deverá:

1. consumir `GET /tags` para sugestões e autocomplete;
2. melhorar a seleção e remoção visual das tags;
3. listar anexos da tarefa;
4. enviar imagens e PDF;
5. permitir download e exclusão;
6. apresentar progresso, erros e limites de upload;
7. respeitar o modo somente leitura;
8. atualizar testes e documentação.
