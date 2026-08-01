import { useState } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'

interface PasswordFieldProps {
  id: string
  label: string
  autoComplete: string
  registration: UseFormRegisterReturn
  error?: string
}

export function PasswordField({
  id,
  label,
  autoComplete,
  registration,
  error,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="field-group">
      <label htmlFor={id}>{label}</label>
      <div className="password-field">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          {...registration}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {error ? (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      ) : null}
    </div>
  )
}