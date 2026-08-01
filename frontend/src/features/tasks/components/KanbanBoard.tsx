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