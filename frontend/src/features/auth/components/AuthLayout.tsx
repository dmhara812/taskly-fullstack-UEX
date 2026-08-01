import type { PropsWithChildren } from 'react'

interface AuthLayoutProps extends PropsWithChildren {
  eyebrow: string
  title: string
  description: string
}

export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
}: AuthLayoutProps) {
  return (
    <main className="auth-page">
      <section className="auth-hero" aria-label="Apresentação do Taskly">
        <a className="brand" href="/" aria-label="Taskly, página inicial">
          <span className="brand-mark" aria-hidden="true">
            T
          </span>
          <span>Taskly</span>
        </a>

        <div className="hero-copy">
          <span className="hero-kicker">Organização sem atrito</span>
          <h1>Projetos claros. Prioridades visíveis. Trabalho em movimento.</h1>
          <p>
            Centralize tarefas, prazos, tags e anexos em uma experiência criada
            para alternar naturalmente entre lista e kanban.
          </p>
        </div>

        <div className="hero-preview" aria-hidden="true">
          <div className="preview-column">
            <span>Não iniciada</span>
            <div className="preview-card preview-card-large" />
            <div className="preview-card" />
          </div>
          <div className="preview-column">
            <span>Em andamento</span>
            <div className="preview-card preview-card-accent" />
          </div>
          <div className="preview-column">
            <span>Concluída</span>
            <div className="preview-card preview-card-done" />
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-heading">
            <span className="eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  )
}