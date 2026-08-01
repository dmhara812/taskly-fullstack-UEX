import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Task } from '../types'
import { KanbanBoard } from './KanbanBoard'

function taskFixture(): Task {
  return {
    id: 'task-1',
    project_id: 'project-1',
    title: 'Revisar quadro',
    short_description: 'Validar rolagem e modo somente leitura.',
    description: null,
    status: 'todo',
    priority: 'medium',
    due_at: null,
    tags: [],
    attachments: [],
    created_at: '2026-08-01T12:00:00Z',
    updated_at: '2026-08-01T12:00:00Z',
  }
}

function renderBoard(isReadOnly = false) {
  return render(
    <KanbanBoard
      tasks={[taskFixture()]}
      isBusy={false}
      isReadOnly={isReadOnly}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onAttachments={vi.fn()}
      onStatusChange={vi.fn()}
    />,
  )
}

describe('KanbanBoard', () => {
  it('synchronizes the top scrollbar with the board viewport', () => {
    renderBoard()

    const topScroll = screen.getByRole('region', {
      name: 'Rolagem horizontal do quadro kanban',
    })
    const boardScroll = screen.getByLabelText('Quadro kanban de tarefas')

    topScroll.scrollLeft = 180
    fireEvent.scroll(topScroll)
    expect(boardScroll.scrollLeft).toBe(180)

    boardScroll.scrollLeft = 45
    fireEvent.scroll(boardScroll)
    expect(topScroll.scrollLeft).toBe(45)
  })

  it('keeps reading attachments available in archived projects', () => {
    renderBoard(true)

    expect(
      screen.getByRole('button', { name: 'Arrastar tarefa Revisar quadro' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('combobox', {
        name: 'Mover Revisar quadro para outra coluna',
      }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Anexos' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled()
  })
})