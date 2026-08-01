import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../../api/client'
import { useProject } from '../hooks'

function getErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.detail
    : 'Não foi possível carregar o projeto.'
}

export function ProjectWorkspacePage() {
  const { projectId = '' } = useParams()
  const projectQuery = useProject(projectId)

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

  const project = projectQuery.data

  return (
    <main className="project-workspace">
      <Link className="back-link" to="/app">
        ← Todos os projetos
      </Link>
      <section className="workspace-heading">
        <div>
          <span className={`status-badge status-${project.status}`}>
            {project.status === 'archived' ? 'Arquivado' : 'Ativo'}
          </span>
          <h1>{project.name}</h1>
          <p>{project.description || 'Projeto sem descrição.'}</p>
        </div>
      </section>
      <section className="workspace-placeholder">
        <span className="eyebrow">Próxima etapa</span>
        <h2>Tarefas do projeto</h2>
        <p>
          A estrutura do projeto já está pronta. A Etapa 07 adicionará criação,
          edição e visualização das tarefas em lista.
        </p>
      </section>
    </main>
  )
}