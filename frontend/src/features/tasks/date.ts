const dueDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDueAt(value: string): string {
  return dueDateFormatter.format(new Date(value))
}

export function toDateTimeLocalValue(value: string | null): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

export function toUtcISOString(value: string): string | null {
  if (!value) {
    return null
  }

  return new Date(value).toISOString()
}

export function isTaskOverdue(
  dueAt: string | null,
  status: 'todo' | 'in_progress' | 'done' | 'cancelled',
): boolean {
  if (!dueAt || status === 'done' || status === 'cancelled') {
    return false
  }

  return new Date(dueAt).getTime() < Date.now()
}