import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toDateTimeLocalValue, toUtcISOString } from '../date'
import type {
  Task,
  TaskFormSubmission,
  TaskPriority,
  TaskStatus,
} from '../types'

const taskStatuses = ['todo', 'in_progress', 'done', 'cancelled'] as const
const taskPriorities = ['low', 'medium', 'high'] as const

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

function normalizeTags(value: string): string[] {
  const uniqueTags = new Map<string, string>()

  for (const rawTag of value.split(',')) {
    const tag = rawTag.trim().replace(/\s+/g, ' ')

    if (tag) {
      uniqueTags.set(tag.toLocaleLowerCase('pt-BR'), tag)
    }
  }

  return [...uniqueTags.values()]
}

const taskFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, 'O título deve ter pelo menos 2 caracteres.')
      .max(180, 'O título deve ter no máximo 180 caracteres.'),
    shortDescription: z
      .string()
      .trim()
      .min(2, 'A descrição curta deve ter pelo menos 2 caracteres.')
      .max(280, 'A descrição curta deve ter no máximo 280 caracteres.'),
    description: z
      .string()
      .max(5000, 'A descrição completa deve ter no máximo 5000 caracteres.'),
    priority: z.enum(taskPriorities),
    status: z.enum(taskStatuses),
    dueAt: z.string(),
    tagsText: z.string(),
  })
  .superRefine((values, context) => {
    if (values.dueAt && Number.isNaN(new Date(values.dueAt).getTime())) {
      context.addIssue({
        code: 'custom',
        path: ['dueAt'],
        message: 'Informe uma data e hora válidas.',
      })
    }

    const tags = normalizeTags(values.tagsText)

    if (tags.length > 10) {
      context.addIssue({
        code: 'custom',
        path: ['tagsText'],
        message: 'Informe no máximo 10 tags.',
      })
    }

    if (tags.some((tag) => tag.length > 40)) {
      context.addIssue({
        code: 'custom',
        path: ['tagsText'],
        message: 'Cada tag deve ter no máximo 40 caracteres.',
      })
    }
  })

type TaskFormData = z.infer<typeof taskFormSchema>

interface TaskFormDialogProps {
  task?: Task
  isPending: boolean
  errorMessage?: string | null
  onClose: () => void
  onSubmit: (payload: TaskFormSubmission) => Promise<void>
}

export function TaskFormDialog({
  task,
  isPending,
  errorMessage,
  onClose,
  onSubmit,
}: TaskFormDialogProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title ?? '',
      shortDescription: task?.short_description ?? '',
      description: task?.description ?? '',
      priority: task?.priority ?? 'medium',
      status: task?.status ?? 'todo',
      dueAt: toDateTimeLocalValue(task?.due_at ?? null),
      tagsText: task?.tags.map((tag) => tag.name).join(', ') ?? '',
    },
  })

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      title: values.title.trim(),
      short_description: values.shortDescription.trim(),
      description: values.description.trim() || null,
      priority: values.priority,
      due_at: toUtcISOString(values.dueAt),
      tags: normalizeTags(values.tagsText),
      status: task ? values.status : undefined,
    })
  })

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="task-dialog-title"
        aria-modal="true"
        className="task-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">{task ? 'Editar tarefa' : 'Nova tarefa'}</span>
            <h2 id="task-dialog-title">
              {task ? 'Atualize a tarefa' : 'Planeje o próximo trabalho'}
            </h2>
          </div>
          <button
            aria-label="Fechar formulário"
            className="icon-button"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form className="task-form" onSubmit={submit} noValidate>
          <div className="field-group task-field-full">
            <label htmlFor="task-title">Título</label>
            <input
              id="task-title"
              placeholder="Ex.: Revisar fluxo de autenticação"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'task-title-error' : undefined}
              {...register('title')}
            />
            {errors.title ? (
              <span className="field-error" id="task-title-error">
                {errors.title.message}
              </span>
            ) : null}
          </div>

          <div className="field-group task-field-full">
            <label htmlFor="task-short-description">Descrição curta</label>
            <textarea
              id="task-short-description"
              placeholder="Resuma o resultado esperado desta tarefa."
              rows={3}
              aria-invalid={Boolean(errors.shortDescription)}
              aria-describedby={
                errors.shortDescription ? 'task-short-description-error' : undefined
              }
              {...register('shortDescription')}
            />
            {errors.shortDescription ? (
              <span className="field-error" id="task-short-description-error">
                {errors.shortDescription.message}
              </span>
            ) : null}
          </div>

          <div className="field-group task-field-full">
            <label htmlFor="task-description">Descrição completa</label>
            <textarea
              id="task-description"
              placeholder="Inclua contexto, critérios de aceite e observações."
              rows={6}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description ? 'task-description-error' : undefined
              }
              {...register('description')}
            />
            {errors.description ? (
              <span className="field-error" id="task-description-error">
                {errors.description.message}
              </span>
            ) : null}
          </div>

          <div className="field-group">
            <label htmlFor="task-priority">Prioridade</label>
            <select id="task-priority" {...register('priority')}>
              {taskPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priorityLabels[priority]}
                </option>
              ))}
            </select>
          </div>

          {task ? (
            <div className="field-group">
              <label htmlFor="task-status">Status</label>
              <select id="task-status" {...register('status')}>
                {taskStatuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="field-group">
            <label htmlFor="task-due-at">Prazo</label>
            <input
              id="task-due-at"
              type="datetime-local"
              aria-invalid={Boolean(errors.dueAt)}
              aria-describedby={errors.dueAt ? 'task-due-at-error' : undefined}
              {...register('dueAt')}
            />
            {errors.dueAt ? (
              <span className="field-error" id="task-due-at-error">
                {errors.dueAt.message}
              </span>
            ) : null}
          </div>

          <div className="field-group task-field-full">
            <label htmlFor="task-tags">Tags</label>
            <input
              id="task-tags"
              placeholder="frontend, urgente, revisão"
              aria-invalid={Boolean(errors.tagsText)}
              aria-describedby="task-tags-hint"
              {...register('tagsText')}
            />
            <span className="field-hint" id="task-tags-hint">
              Separe as tags por vírgula. Máximo de 10 tags.
            </span>
            {errors.tagsText ? (
              <span className="field-error">{errors.tagsText.message}</span>
            ) : null}
          </div>

          {errorMessage ? (
            <div className="form-error task-field-full" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <div className="dialog-actions task-field-full">
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button className="primary-button" type="submit" disabled={isPending}>
              {isPending
                ? 'Salvando…'
                : task
                  ? 'Salvar alterações'
                  : 'Criar tarefa'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}