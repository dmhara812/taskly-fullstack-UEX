import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ApiError } from '../../../api/client'
import { AuthLayout } from '../components/AuthLayout'
import { PasswordField } from '../components/PasswordField'
import { useAuth } from '../auth-context'

const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
})

type LoginFormData = z.infer<typeof loginSchema>

function getMutationError(error: Error | null): string | null {
  if (!error) {
    return null
  }

  if (error instanceof ApiError) {
    return error.detail === 'Invalid credentials'
      ? 'E-mail ou senha incorretos.'
      : error.detail
  }

  return error.message || 'Não foi possível entrar. Tente novamente.'
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destination =
    (location.state as { from?: string } | null)?.from ?? '/app'

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: () => navigate(destination, { replace: true }),
  })

  const mutationError = getMutationError(loginMutation.error)

  return (
    <AuthLayout
      eyebrow="Bem-vindo de volta"
      title="Entre na sua conta"
      description="Acesse seus projetos e continue exatamente de onde parou."
    >
      <form
        className="auth-form"
        onSubmit={handleSubmit((data) => loginMutation.mutate(data))}
        noValidate
      >
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
          autoComplete="current-password"
          registration={register('password')}
          error={errors.password?.message}
        />

        {mutationError ? (
          <div className="form-error" role="alert">
            {mutationError}
          </div>
        ) : null}

        <button
          className="primary-button"
          type="submit"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p className="auth-switch">
        Ainda não tem uma conta? <Link to="/register">Criar conta</Link>
      </p>
    </AuthLayout>
  )
}