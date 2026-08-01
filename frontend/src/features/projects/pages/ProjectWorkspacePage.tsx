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