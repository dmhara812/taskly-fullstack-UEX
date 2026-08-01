import { useAuth } from '../features/auth/auth-context'

export function DashboardPage() {
  const { user } = useAuth()

  return (
    <main className="dashboard-page">
      <section className="dashboard-welcome">
        <span className="eyebrow">Sessão autenticada</span>
        <h1>Olá, {user?.name.split(' ')[0]}.</h1>
        <p>
          A fundação do frontend está pronta. Na próxima etapa, este espaço
          receberá seus projetos e os primeiros fluxos de gerenciamento.
        </p>
      </section>

      <section className="foundation-grid" aria-label="Recursos da fundação">
        <article>
          <span>01</span>
          <h2>Sessão persistente</h2>
          <p>Access e refresh tokens mantêm o login entre recarregamentos.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Rotas protegidas</h2>
          <p>Conteúdo privado só é exibido após a validação do usuário.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Base para dados</h2>
          <p>TanStack Query está configurado para projetos, tarefas e tags.</p>
        </article>
      </section>
    </main>
  )
}