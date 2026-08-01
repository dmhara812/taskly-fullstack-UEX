import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { Project, ProjectPayload } from '../types'

const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome deve ter pelo menos 2 caracteres.')
    .max(160, 'O nome deve ter no máximo 160 caracteres.'),
  description: z
    .string()
    .max(2000, 'A descrição deve ter no máximo 2000 caracteres.'),
})

type ProjectFormData = z.infer<typeof projectSchema>

interface ProjectFormDialogProps {
  project?: Project
  isPending: boolean
  errorMessage?: string | null
  onClose: () => void
  onSubmit: (payload: ProjectPayload) => Promise<void>
}

export function ProjectFormDialog({
  project,
  isPending,
  errorMessage,
  onClose,
  onSubmit,
}: ProjectFormDialogProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: project?.name ?? '',
      description: project?.description ?? '',
    },
  })

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      name: values.name.trim(),
      description: values.description.trim() || null,
    })
  })

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="project-dialog-title"
        aria-modal="true"
        className="project-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">{project ? 'Editar projeto' : 'Novo projeto'}</span>
            <h2 id="project-dialog-title">
              {project ? 'Atualize os detalhes' : 'Crie um espaço de trabalho'}
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

        <form className="project-form" onSubmit={submit} noValidate>
          <div className="field-group">
            <label htmlFor="project-name">Nome</label>
            <input
              id="project-name"
              placeholder="Ex.: Lançamento do produto"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'project-name-error' : undefined}
              {...register('name')}
            />
            {errors.name ? (
              <span className="field-error" id="project-name-error">
                {errors.name.message}
              </span>
            ) : null}
          </div>

          <div className="field-group">
            <label htmlFor="project-description">Descrição</label>
            <textarea
              id="project-description"
              placeholder="Explique brevemente o objetivo deste projeto."
              rows={5}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description ? 'project-description-error' : undefined
              }
              {...register('description')}
            />
            {errors.description ? (
              <span className="field-error" id="project-description-error">
                {errors.description.message}
              </span>
            ) : null}
          </div>

          {errorMessage ? (
            <div className="form-error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <div className="dialog-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button className="primary-button" type="submit" disabled={isPending}>
              {isPending ? 'Salvando…' : project ? 'Salvar alterações' : 'Criar projeto'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}