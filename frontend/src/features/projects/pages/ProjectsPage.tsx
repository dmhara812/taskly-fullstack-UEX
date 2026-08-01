import { useState, type FormEvent } from 'react'
import { ApiError } from '../../../api/client'
import { useAuth } from '../../auth/auth-context'
import { ProjectCard } from '../components/ProjectCard'
import { ProjectFormDialog } from '../components/ProjectFormDialog'
import {
  useArchiveProject,
  useCreateProject,
  useDeleteProject,
  useProjects,
  useRestoreProject,
  useUpdateProject,
} from '../hooks'
import type { Project, ProjectPayload, ProjectStatus } from '../types'

const PAGE_SIZE = 9

interface ProjectActionOptions {
  removesItemFromCurrentPage?: boolean
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.detail
  }

  return 'Não foi possível concluir a ação. Tente novamente.'
}

export function ProjectsPage() {
  const { user } = useAuth()

  const [status, setStatus] = useState<ProjectStatus>('active')
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const projectsQuery = useProjects({
    page,
    size: PAGE_SIZE,
    status,
    search: search || undefined,
  })

  const createMutation = useCreateProject()
  const updateMutation = useUpdateProject()
  const archiveMutation = useArchiveProject()
  const restoreMutation = useRestoreProject()
  const deleteMutation = useDeleteProject()

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    archiveMutation.isPending ||
    restoreMutation.isPending ||
    deleteMutation.isPending

  const closeDialog = () => {
    if (isMutating) {
      return
    }

    setIsCreating(false)
    setEditingProject(null)
    setActionError(null)
  }

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setSearch(searchInput.trim())
    setPage(1)
  }

  const changeStatus = (nextStatus: ProjectStatus) => {
    setStatus(nextStatus)
    setPage(1)
    setActionError(null)
  }

  const submitProject = async (payload: ProjectPayload) => {
    setActionError(null)

    try {
      if (editingProject) {
        await updateMutation.mutateAsync({
          projectId: editingProject.id,
          payload,
        })
      } else {
        await createMutation.mutateAsync(payload)

        // Projetos novos sempre são criados como ativos. A interface volta para
        // a primeira página sem filtros para que o novo registro fique visível.
        setStatus('active')
        setPage(1)
        setSearchInput('')
        setSearch('')
      }

      setEditingProject(null)
      setIsCreating(false)
    } catch (error) {
      setActionError(getErrorMessage(error))
    }
  }

  const runProjectAction = async (
    action: () => Promise<unknown>,
    options: ProjectActionOptions = {},
  ) => {
    setActionError(null)

    // A correção da página é determinada antes da mutation, usando os itens
    // atualmente exibidos. Assim, não é necessário sincronizar estados React
    // com um useEffect que chama setState imediatamente.
    const shouldReturnToPreviousPage =
      options.removesItemFromCurrentPage === true &&
      page > 1 &&
      (projectsQuery.data?.items.length ?? 0) === 1

    try {
      await action()

      if (shouldReturnToPreviousPage) {
        setPage((currentPage) => Math.max(currentPage - 1, 1))
      }
    } catch (error) {
      setActionError(getErrorMessage(error))
    }
  }

  const deleteProject = (project: Project) => {
    const confirmed = window.confirm(
      `Excluir o projeto “${project.name}” e todas as suas tarefas? Esta ação não pode ser desfeita.`,
    )

    if (!confirmed) {
      return
    }

    void runProjectAction(
      () => deleteMutation.mutateAsync(project.id),
      { removesItemFromCurrentPage: true },
    )
  }

  const projects = projectsQuery.data?.items ?? []
  const total = projectsQuery.data?.total ?? 0
  const pages = projectsQuery.data?.pages ?? 0

  return (
    <main className="projects-page">
      <section className="projects-hero">
        <div>
          <span className="eyebrow">Visão geral</span>

          <h1>Projetos</h1>

          <p>
            Olá, {user?.name.split(' ')[0]}. Organize cada iniciativa em um
            espaço próprio e acompanhe o trabalho até a conclusão.
          </p>
        </div>

        <button
          className="primary-button"
          type="button"
          onClick={() => {
            setActionError(null)
            setIsCreating(true)
          }}
        >
          + Novo projeto
        </button>
      </section>

      <section
        className="projects-toolbar"
        aria-label="Filtros de projetos"
      >
        <div
          className="project-tabs"
          role="group"
          aria-label="Status dos projetos"
        >
          <button
            className={status === 'active' ? 'is-active' : undefined}
            type="button"
            aria-pressed={status === 'active'}
            onClick={() => changeStatus('active')}
          >
            Ativos
          </button>

          <button
            className={status === 'archived' ? 'is-active' : undefined}
            type="button"
            aria-pressed={status === 'archived'}
            onClick={() => changeStatus('archived')}
          >
            Arquivados
          </button>
        </div>

        <form
          className="project-search"
          role="search"
          onSubmit={submitSearch}
        >
          <label
            className="sr-only"
            htmlFor="project-search-input"
          >
            Buscar projetos
          </label>

          <input
            id="project-search-input"
            type="search"
            placeholder="Buscar pelo nome"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />

          <button
            className="secondary-button"
            type="submit"
          >
            Buscar
          </button>

          {search ? (
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setSearchInput('')
                setSearch('')
                setPage(1)
              }}
            >
              Limpar
            </button>
          ) : null}
        </form>
      </section>

      {actionError ? (
        <div
          className="page-alert"
          role="alert"
        >
          <span>{actionError}</span>

          <button
            type="button"
            onClick={() => setActionError(null)}
          >
            Fechar
          </button>
        </div>
      ) : null}

      {projectsQuery.isPending ? (
        <section
          className="projects-state"
          role="status"
        >
          <div
            className="loading-orb"
            aria-hidden="true"
          />

          <h2>Carregando projetos</h2>

          <p>Estamos preparando seu espaço de trabalho.</p>
        </section>
      ) : projectsQuery.isError ? (
        <section
          className="projects-state projects-state-error"
          role="alert"
        >
          <span aria-hidden="true">!</span>

          <h2>Não foi possível carregar os projetos</h2>

          <p>{getErrorMessage(projectsQuery.error)}</p>

          <button
            className="secondary-button"
            type="button"
            onClick={() => void projectsQuery.refetch()}
          >
            Tentar novamente
          </button>
        </section>
      ) : projects.length === 0 ? (
        <section className="projects-state projects-empty">
          <span aria-hidden="true">
            {status === 'active' ? '◇' : '□'}
          </span>

          <h2>
            {search
              ? 'Nenhum projeto encontrado'
              : status === 'active'
                ? 'Crie seu primeiro projeto'
                : 'Nenhum projeto arquivado'}
          </h2>

          <p>
            {search
              ? 'Revise o termo pesquisado ou limpe o filtro para ver todos os projetos.'
              : status === 'active'
                ? 'Separe iniciativas, tarefas e prazos em espaços organizados.'
                : 'Projetos arquivados aparecerão aqui e poderão ser restaurados.'}
          </p>

          {!search && status === 'active' ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setActionError(null)
                setIsCreating(true)
              }}
            >
              Criar projeto
            </button>
          ) : null}
        </section>
      ) : (
        <>
          <div className="projects-summary">
            <strong>{total}</strong>{' '}
            {total === 1 ? 'projeto' : 'projetos'}

            {search ? <span> para “{search}”</span> : null}
          </div>

          <section
            className="projects-grid"
            aria-label="Lista de projetos"
          >
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isBusy={isMutating}
                onEdit={(selectedProject) => {
                  setActionError(null)
                  setEditingProject(selectedProject)
                }}
                onArchive={(selectedProject) => {
                  void runProjectAction(
                    () =>
                      archiveMutation.mutateAsync(selectedProject.id),
                    { removesItemFromCurrentPage: true },
                  )
                }}
                onRestore={(selectedProject) => {
                  void runProjectAction(
                    () =>
                      restoreMutation.mutateAsync(selectedProject.id),
                    { removesItemFromCurrentPage: true },
                  )
                }}
                onDelete={deleteProject}
              />
            ))}
          </section>

          {pages > 1 ? (
            <nav
              className="pagination"
              aria-label="Paginação de projetos"
            >
              <button
                className="secondary-button"
                type="button"
                disabled={page === 1 || projectsQuery.isFetching}
                onClick={() =>
                  setPage((currentPage) =>
                    Math.max(1, currentPage - 1),
                  )
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
                disabled={page >= pages || projectsQuery.isFetching}
                onClick={() =>
                  setPage((currentPage) => currentPage + 1)
                }
              >
                Próxima
              </button>
            </nav>
          ) : null}
        </>
      )}

      {isCreating || editingProject ? (
        <ProjectFormDialog
          project={editingProject ?? undefined}
          isPending={
            createMutation.isPending || updateMutation.isPending
          }
          errorMessage={actionError}
          onClose={closeDialog}
          onSubmit={submitProject}
        />
      ) : null}
    </main>
  )
}