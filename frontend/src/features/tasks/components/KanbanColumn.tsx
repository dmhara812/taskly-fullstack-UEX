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