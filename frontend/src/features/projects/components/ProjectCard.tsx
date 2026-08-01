import { Link } from 'react-router-dom'
import type { Project } from '../types'

interface ProjectCardProps {
  project: Project
  isBusy: boolean
  onEdit: (project: Project) => void
  onArchive: (project: Project) => void
  onRestore: (project: Project) => void
  onDelete: (project: Project) => void
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function ProjectCard({
  project,
  isBusy,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: ProjectCardProps) {
  const isArchived = project.status === 'archived'

  return (
    <article className="project-card">
      <div className="project-card-topline">
        <span className={`status-badge status-${project.status}`}>
          {isArchived ? 'Arquivado' : 'Ativo'}
        </span>
        <span className="project-updated">
          Atualizado em {dateFormatter.format(new Date(project.updated_at))}
        </span>
      </div>

      <div className="project-card-content">
        <h2>{project.name}</h2>
        <p>{project.description || 'Projeto sem descrição.'}</p>
      </div>

      <div className="project-card-footer">
        <Link className="project-open-link" to={`/app/projects/${project.id}`}>
          Abrir projeto <span aria-hidden="true">→</span>
        </Link>

        <div className="project-actions" aria-label={`Ações de ${project.name}`}>
          <button type="button" onClick={() => onEdit(project)} disabled={isBusy}>
            Editar
          </button>
          {isArchived ? (
            <button type="button" onClick={() => onRestore(project)} disabled={isBusy}>
              Restaurar
            </button>
          ) : (
            <button type="button" onClick={() => onArchive(project)} disabled={isBusy}>
              Arquivar
            </button>
          )}
          <button
            className="danger-text-button"
            type="button"
            onClick={() => onDelete(project)}
            disabled={isBusy}
          >
            Excluir
          </button>
        </div>
      </div>
    </article>
  )
}