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
