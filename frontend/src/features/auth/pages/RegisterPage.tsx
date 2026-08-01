import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ApiError } from '../../../api/client'
import { AuthLayout } from '../components/AuthLayout'
import { PasswordField } from '../components/PasswordField'
import { useAuth } from '../auth-context'

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Informe seu nome completo.'),
    email: z.string().email('Informe um e-mail válido.'),
    password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'As senhas precisam ser iguais.',
    path: ['passwordConfirmation'],
  })

type RegisterFormData = z.infer<typeof registerSchema>

function getMutationError(error: Error | null): string | null {
  if (!error) {
    return null
  }

  if (error instanceof ApiError) {
    return error.detail === 'Email already registered'
      ? 'Já existe uma conta com este e-mail.'
      : error.detail
  }

  return error.message || 'Não foi possível criar sua conta.'
}

export function RegisterPage() {
  const { register: createAccount } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      passwordConfirmation: '',
    },
  })

  const registerMutation = useMutation({
    mutationFn: async (formData: RegisterFormData) =>
      createAccount({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      }),
    onSuccess: () => navigate('/app', { replace: true }),
  })

  const mutationError = getMutationError(registerMutation.error)

  return (
    <AuthLayout
      eyebrow="Comece agora"
      title="Crie sua conta"
      description="Em poucos passos, seu espaço de trabalho estará pronto."
    >
      <form
        className="auth-form"
        onSubmit={handleSubmit((data) => registerMutation.mutate(data))}
        noValidate
      >
        <div className="field-group">
          <label htmlFor="name">Nome</label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Seu nome completo"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'name-error' : undefined}
            {...register('name')}
          />
          {errors.name ? (
            <span id="name-error" className="field-error">
              {errors.name.message}
            </span>
          ) : null}
        </div>

        <div className="field-group">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
          {errors.email ? (
            <span id="email-error" className="field-error">
              {errors.email.message}
            </span>
          ) : null}
        </div>

        <PasswordField
          id="password"
          label="Senha"
          autoComplete="new-password"
          registration={register('password')}
          error={errors.password?.message}
        />

        <PasswordField
          id="password-confirmation"
          label="Confirmar senha"
          autoComplete="new-password"
          registration={register('passwordConfirmation')}
          error={errors.passwordConfirmation?.message}
        />

        {mutationError ? (
          <div className="form-error" role="alert">
            {mutationError}
          </div>
        ) : null}

        <button
          className="primary-button"
          type="submit"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      <p className="auth-switch">
        Já possui uma conta? <Link to="/login">Entrar</Link>
      </p>
    </AuthLayout>
  )
}