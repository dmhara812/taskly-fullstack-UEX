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
  onStatusChange: (task: Task, status: TaskStatus) => void
}

export function TaskListItem({
  task,
  isBusy,
  isReadOnly,
  onEdit,
  onDelete,
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