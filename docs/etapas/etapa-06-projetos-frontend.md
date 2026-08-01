# Etapa 06 — Projetos no frontend

## 1. Título e objetivo da etapa

Implementar a gestão de projetos no frontend do Taskly, consumindo o CRUD já existente no backend e preparando a navegação para as tarefas de cada projeto.

A etapa entrega listagem, busca, filtro por status, paginação, criação, edição, arquivamento, restauração, exclusão e estados de carregamento, erro e vazio. Nenhum arquivo Python, migration ou contrato do backend foi alterado.

## 2. O que foi feito e por quê

### 2.1. Integração HTTP de projetos

Foi criada a feature `frontend/src/features/projects/`, isolando:

- tipos e contratos;
- funções de acesso à API;
- queries e mutations do TanStack Query;
- componentes de apresentação;
- páginas e testes.

O backend já fornecia todos os endpoints necessários. Reutilizá-los preserva a arquitetura existente e evita mudanças sem justificativa.

### 2.2. Gestão dos projetos

A página principal autenticada passou a oferecer:

- listagem dos projetos ativos;
- alternância para projetos arquivados;
- pesquisa por nome submetida pelo usuário;
- paginação de nove itens;
- criação e edição em formulário modal;
- arquivamento e restauração;
- exclusão com confirmação explícita;
- acesso ao workspace de cada projeto.

### 2.3. Cache e sincronização

As listas e detalhes possuem chaves hierárquicas no TanStack Query. Após cada mutation:

- a lista é invalidada e consultada novamente;
- o detalhe do projeto é atualizado quando a resposta da API está disponível;
- detalhes excluídos são removidos do cache.

Essa abordagem evita manter cópias locais dos dados remotos e reduz o risco de cards desatualizados.

### 2.4. Estados de interface

Foram criados estados visuais e acessíveis para:

- carregamento;
- falha da API com tentativa novamente;
- ausência de projetos ativos;
- ausência de projetos arquivados;
- ausência de resultados da pesquisa;
- falhas nas mutations.

### 2.5. Preparação para tarefas

A rota `/app/projects/:projectId` consulta o projeto e apresenta um workspace inicial. A página ainda não cria tarefas; ela apenas estabelece a navegação que será utilizada na Etapa 07.

### 2.6. Testes

Os testes cobrem:

- renderização da lista retornada pela API;
- criação e atualização da listagem;
- edição de projeto;
- arquivamento e remoção do card da lista ativa.

Foi mantida a estratégia de `fireEvent` e consultas limitadas ao diálogo com `within`, incorporando o aprendizado do timeout ocorrido na Etapa 05.

## 3. Decisões técnicas tomadas

### 3.1. Reutilizar o backend sem alterações

**Alternativa:** criar endpoints específicos para o frontend.

**Decisão do desenvolvedor:** consumir os endpoints já existentes.

**Justificativa:** o CRUD atual já oferece ownership, paginação, busca, status, arquivamento e exclusão. Uma nova API duplicaria contratos sem benefício para esta etapa.

### 3.2. Estado remoto no TanStack Query

**Alternativa:** copiar os projetos para `useState` e sincronizar manualmente após mutations.

**Decisão do desenvolvedor:** usar o cache do TanStack Query como fonte de verdade.

**Prós:** menos estado duplicado, invalidação centralizada e reaproveitamento futuro no workspace.
**Contras:** exige cuidado com chaves e invalidações.

### 3.3. Busca submetida

**Alternativa:** request a cada caractere digitado.

**Decisão do desenvolvedor:** aplicar a pesquisa somente no submit.

**Justificativa:** reduz chamadas desnecessárias e evita implementar debounce antes de existir necessidade medida.

### 3.4. Formulário único

Criação e edição compartilham `ProjectFormDialog`, com valores iniciais diferentes e o mesmo schema Zod. Isso evita divergência de validação entre os dois fluxos.

### 3.5. Exclusão explícita

A exclusão exige `window.confirm`, pois o backend remove também tarefas e anexos relacionados. O fluxo destrutivo não é executado por clique acidental.

### 3.6. `DECISIONS.md`

Não foi alterado. A etapa não introduziu decisão arquitetural de longo prazo; apenas aplicou padrões já aprovados de feature, cliente HTTP e TanStack Query.

## 4. Dependências entre arquivos e ordem de criação/alteração

1. `features/projects/types.ts`: contratos TypeScript.
2. `features/projects/api.ts`: chamadas aos endpoints existentes.
3. `features/projects/hooks.ts`: queries, mutations e cache.
4. `ProjectFormDialog.tsx`: criação e edição.
5. `ProjectCard.tsx`: apresentação e ações.
6. `ProjectsPage.tsx`: coordenação dos filtros, estados e mutations.
7. `ProjectWorkspacePage.tsx`: navegação para o projeto.
8. `App.tsx` e `AppShell.tsx`: rotas e navegação interna.
9. `styles.css`: responsividade e estados visuais.
10. `ProjectsPage.test.tsx`: fluxos críticos.
11. `AI_USAGE.md`, `CURRENT_STATE.md`, prompt e este documento.

## 5. Conteúdo completo de cada arquivo alterado

O conteúdo deste próprio documento não é repetido dentro dele para evitar recursão.

O arquivo `frontend/src/routes/DashboardPage.tsx` foi removido, pois a página provisória da fundação foi substituída por `ProjectsPage`.


### `frontend/src/App.tsx`

`````tsx
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './features/auth/pages/LoginPage'
import { RegisterPage } from './features/auth/pages/RegisterPage'
import { ProjectsPage } from './features/projects/pages/ProjectsPage'
import { ProjectWorkspacePage } from './features/projects/pages/ProjectWorkspacePage'
import { AppShell } from './routes/AppShell'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { PublicOnlyRoute } from './routes/PublicOnlyRoute'

export function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectWorkspacePage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
`````


### `frontend/src/routes/AppShell.tsx`

`````tsx
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/auth-context'

export function AppShell() {
  const { user, logout } = useAuth()

  return (
    <div className="application-shell">
      <header className="app-header">
        <Link className="brand brand-dark" to="/app">
          <span className="brand-mark" aria-hidden="true">
            T
          </span>
          <span>Taskly</span>
        </Link>
        <div className="user-actions">
          <div className="user-summary">
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
          </div>
          <button className="secondary-button" type="button" onClick={logout}>
            Sair
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
`````


### `frontend/src/styles.css`

`````css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');

:root {
  font-family: 'DM Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
    sans-serif;
  color: #172033;
  background: #f4f6fb;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  --ink: #172033;
  --muted: #687087;
  --line: #dfe4ef;
  --surface: #ffffff;
  --primary: #6556e8;
  --primary-dark: #4f42c8;
  --primary-soft: #efedff;
  --danger: #b42318;
  --danger-soft: #fff1f0;
  --success: #16835f;
  --shadow: 0 24px 70px rgba(44, 47, 88, 0.13);
}

* {
  box-sizing: border-box;
}

html {
  min-width: 320px;
  min-height: 100%;
}

body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
}

button,
input,
textarea {
  font: inherit;
}

button,
a {
  -webkit-tap-highlight-color: transparent;
}

a {
  color: inherit;
}

.auth-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(420px, 0.92fr);
  background: var(--surface);
}

.auth-hero {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: clamp(28px, 4vw, 64px);
  color: #ffffff;
  background:
    radial-gradient(circle at 15% 15%, rgba(173, 161, 255, 0.45), transparent 31%),
    radial-gradient(circle at 88% 81%, rgba(86, 209, 207, 0.22), transparent 30%),
    linear-gradient(145deg, #332979 0%, #5243be 46%, #6556e8 100%);
}

.auth-hero::after {
  content: '';
  position: absolute;
  width: 320px;
  height: 320px;
  right: -135px;
  top: 8%;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 50%;
  box-shadow:
    0 0 0 70px rgba(255, 255, 255, 0.035),
    0 0 0 140px rgba(255, 255, 255, 0.022);
}

.brand {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 11px;
  width: fit-content;
  color: #ffffff;
  text-decoration: none;
  font-family: 'Manrope', sans-serif;
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  color: #4f42c8;
  background: #ffffff;
  box-shadow: 0 10px 25px rgba(16, 12, 57, 0.2);
}

.brand-dark {
  color: var(--ink);
}

.brand-dark .brand-mark {
  color: #ffffff;
  background: var(--primary);
}

.hero-copy {
  position: relative;
  z-index: 1;
  width: min(640px, 92%);
  margin: auto 0 42px;
}

.hero-kicker,
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--primary);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.hero-kicker {
  color: rgba(255, 255, 255, 0.78);
}

.hero-copy h1 {
  max-width: 650px;
  margin: 18px 0 22px;
  font-family: 'Manrope', sans-serif;
  font-size: clamp(2.6rem, 5vw, 5.3rem);
  line-height: 0.98;
  letter-spacing: -0.065em;
}

.hero-copy p {
  max-width: 570px;
  margin: 0;
  color: rgba(255, 255, 255, 0.75);
  font-size: clamp(1rem, 1.3vw, 1.2rem);
  line-height: 1.65;
}

.hero-preview {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 22px;
  background: rgba(25, 20, 79, 0.28);
  box-shadow: 0 28px 60px rgba(19, 14, 65, 0.2);
  backdrop-filter: blur(16px);
}

.preview-column {
  min-height: 138px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.07);
}

.preview-column > span {
  display: block;
  margin-bottom: 12px;
  color: rgba(255, 255, 255, 0.68);
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
}

.preview-card {
  height: 34px;
  margin-top: 8px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.82);
}

.preview-card-large {
  height: 48px;
}

.preview-card-accent {
  height: 72px;
  background: #bbb3ff;
}

.preview-card-done {
  background: #81dfc3;
}

.auth-panel {
  display: grid;
  place-items: center;
  padding: clamp(28px, 6vw, 92px);
  background:
    linear-gradient(rgba(255, 255, 255, 0.91), rgba(255, 255, 255, 0.91)),
    radial-gradient(circle at 100% 0, #eae7ff, transparent 40%);
}

.auth-card {
  width: min(100%, 460px);
}

.auth-heading {
  margin-bottom: 34px;
}

.auth-heading h2,
.dashboard-welcome h1 {
  margin: 12px 0 12px;
  font-family: 'Manrope', sans-serif;
  font-size: clamp(2rem, 3vw, 3rem);
  line-height: 1.08;
  letter-spacing: -0.05em;
}

.auth-heading p,
.dashboard-welcome p {
  margin: 0;
  color: var(--muted);
  line-height: 1.65;
}

.auth-form {
  display: grid;
  gap: 20px;
}

.field-group {
  display: grid;
  gap: 8px;
}

.field-group label {
  color: #30384c;
  font-size: 0.88rem;
  font-weight: 700;
}

.field-group input {
  width: 100%;
  height: 52px;
  padding: 0 15px;
  border: 1px solid var(--line);
  border-radius: 13px;
  outline: none;
  color: var(--ink);
  background: #ffffff;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.field-group input::placeholder {
  color: #a1a8b8;
}

.field-group input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px var(--primary-soft);
}

.field-group input[aria-invalid='true'] {
  border-color: #e38a82;
}

.password-field {
  position: relative;
}

.password-field input {
  padding-right: 86px;
}

.password-toggle {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  border: 0;
  color: var(--primary);
  background: transparent;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

.field-error {
  color: var(--danger);
  font-size: 0.78rem;
}

.form-error {
  padding: 12px 14px;
  border: 1px solid #ffd2cd;
  border-radius: 12px;
  color: var(--danger);
  background: var(--danger-soft);
  font-size: 0.86rem;
}

.primary-button,
.secondary-button {
  min-height: 50px;
  border-radius: 13px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 160ms ease,
    background-color 160ms ease,
    opacity 160ms ease;
}

.primary-button {
  border: 0;
  color: #ffffff;
  background: var(--primary);
  box-shadow: 0 14px 30px rgba(101, 86, 232, 0.25);
}

.primary-button:hover:not(:disabled) {
  transform: translateY(-1px);
  background: var(--primary-dark);
}

.primary-button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.secondary-button {
  padding: 0 18px;
  border: 1px solid var(--line);
  color: var(--ink);
  background: #ffffff;
}

.secondary-button:hover {
  background: #f7f8fc;
}

.auth-switch {
  margin: 26px 0 0;
  color: var(--muted);
  text-align: center;
  font-size: 0.9rem;
}

.auth-switch a {
  color: var(--primary);
  font-weight: 700;
  text-decoration: none;
}

.loading-screen {
  min-height: 100vh;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 14px;
  color: var(--muted);
}

.loading-spinner {
  width: 34px;
  height: 34px;
  border: 3px solid #ddd9ff;
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 700ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.application-shell {
  min-height: 100vh;
  background: #f4f6fb;
}

.app-header {
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 clamp(22px, 5vw, 72px);
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(14px);
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 18px;
}

.user-summary {
  display: grid;
  justify-items: end;
  font-size: 0.82rem;
}

.user-summary span {
  color: var(--muted);
}

.dashboard-page {
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
  padding: clamp(54px, 8vw, 100px) 0;
}

.dashboard-welcome {
  max-width: 700px;
}

.foundation-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-top: 48px;
}

.foundation-grid article {
  min-height: 210px;
  padding: 28px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 12px 40px rgba(48, 52, 84, 0.06);
}

.foundation-grid article > span {
  color: var(--primary);
  font-family: 'Manrope', sans-serif;
  font-size: 0.8rem;
  font-weight: 800;
}

.foundation-grid h2 {
  margin: 34px 0 10px;
  font-family: 'Manrope', sans-serif;
  font-size: 1.2rem;
  letter-spacing: -0.03em;
}

.foundation-grid p {
  margin: 0;
  color: var(--muted);
  line-height: 1.55;
}

@media (max-width: 980px) {
  .auth-page {
    grid-template-columns: 1fr;
  }

  .auth-hero {
    min-height: auto;
    padding-bottom: 42px;
  }

  .hero-copy {
    margin: 90px 0 34px;
  }

  .hero-preview {
    display: none;
  }

  .auth-panel {
    min-height: 620px;
  }
}

@media (max-width: 720px) {
  .auth-hero {
    padding: 24px;
  }

  .hero-copy {
    width: 100%;
    margin-top: 70px;
  }

  .hero-copy h1 {
    font-size: clamp(2.45rem, 13vw, 4rem);
  }

  .auth-panel {
    min-height: auto;
    padding: 48px 24px 64px;
  }

  .app-header {
    height: auto;
    align-items: flex-start;
    padding-top: 18px;
    padding-bottom: 18px;
  }

  .user-summary {
    display: none;
  }

  .foundation-grid {
    grid-template-columns: 1fr;
  }
}


/* Project management */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.projects-page,
.project-workspace {
  width: min(1240px, calc(100% - 40px));
  margin: 0 auto;
  padding: clamp(38px, 6vw, 72px) 0 80px;
}

.projects-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
}

.projects-hero > div {
  max-width: 720px;
}

.projects-hero h1,
.workspace-heading h1 {
  margin: 10px 0 10px;
  font-family: 'Manrope', sans-serif;
  font-size: clamp(2.4rem, 5vw, 4.4rem);
  line-height: 1;
  letter-spacing: -0.06em;
}

.projects-hero p,
.workspace-heading p,
.workspace-placeholder p {
  margin: 0;
  color: var(--muted);
  line-height: 1.65;
}

.projects-hero > .primary-button,
.projects-empty .primary-button {
  padding: 0 22px;
  white-space: nowrap;
}

.projects-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin: 38px 0 26px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 10px 35px rgba(48, 52, 84, 0.05);
}

.project-tabs {
  display: inline-flex;
  gap: 6px;
  padding: 4px;
  border-radius: 13px;
  background: #f0f2f8;
}

.project-tabs button,
.text-button,
.project-actions button,
.icon-button,
.page-alert button {
  border: 0;
  cursor: pointer;
  font-weight: 700;
}

.project-tabs button {
  min-height: 40px;
  padding: 0 17px;
  border-radius: 10px;
  color: var(--muted);
  background: transparent;
}

.project-tabs button.is-active {
  color: var(--primary-dark);
  background: #ffffff;
  box-shadow: 0 5px 16px rgba(48, 52, 84, 0.08);
}

.project-search {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: min(100%, 480px);
}

.project-search input {
  min-width: 0;
  flex: 1;
  height: 46px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  outline: none;
  color: var(--ink);
  background: #ffffff;
}

.project-search input:focus,
.project-form input:focus,
.project-form textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px rgba(101, 86, 232, 0.12);
}

.project-search .secondary-button {
  min-height: 46px;
}

.text-button {
  padding: 8px;
  color: var(--primary-dark);
  background: transparent;
}

.page-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
  padding: 14px 16px;
  border: 1px solid #ffd2cd;
  border-radius: 14px;
  color: var(--danger);
  background: var(--danger-soft);
}

.page-alert button {
  color: inherit;
  background: transparent;
}

.projects-summary {
  margin-bottom: 16px;
  color: var(--muted);
  font-size: 0.9rem;
}

.projects-summary strong {
  color: var(--ink);
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.project-card {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--surface);
  box-shadow: 0 14px 45px rgba(48, 52, 84, 0.055);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease;
}

.project-card:hover {
  transform: translateY(-2px);
  border-color: #cbc5ff;
  box-shadow: 0 20px 55px rgba(48, 52, 84, 0.1);
}

.project-card-topline,
.project-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.status-badge {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
}

.status-active {
  color: #0e6f50;
  background: #e8f8f1;
}

.status-archived {
  color: #626a7d;
  background: #eef0f5;
}

.project-updated {
  color: #8a91a3;
  font-size: 0.74rem;
}

.project-card-content {
  flex: 1;
  padding: 27px 0 24px;
}

.project-card-content h2 {
  margin: 0 0 10px;
  font-family: 'Manrope', sans-serif;
  font-size: 1.25rem;
  letter-spacing: -0.035em;
}

.project-card-content p {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--muted);
  line-height: 1.58;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.project-card-footer {
  align-items: flex-end;
  padding-top: 16px;
  border-top: 1px solid #edf0f5;
}

.project-open-link,
.back-link,
.link-button {
  color: var(--primary-dark);
  font-weight: 800;
  text-decoration: none;
}

.project-open-link:hover,
.back-link:hover {
  text-decoration: underline;
}

.project-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 5px;
}

.project-actions button {
  padding: 6px;
  color: var(--muted);
  background: transparent;
  font-size: 0.76rem;
}

.project-actions button:hover:not(:disabled) {
  color: var(--primary-dark);
}

.project-actions .danger-text-button:hover:not(:disabled) {
  color: var(--danger);
}

.project-actions button:disabled {
  cursor: wait;
  opacity: 0.5;
}

.projects-state {
  min-height: 360px;
  display: grid;
  place-content: center;
  justify-items: center;
  padding: 40px;
  border: 1px dashed #ccd2df;
  border-radius: 22px;
  color: var(--muted);
  text-align: center;
  background: rgba(255, 255, 255, 0.6);
}

.projects-state > span {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 18px;
  color: var(--primary);
  background: var(--primary-soft);
  font-size: 1.5rem;
  font-weight: 800;
}

.projects-state h2 {
  margin: 18px 0 8px;
  color: var(--ink);
  font-family: 'Manrope', sans-serif;
  letter-spacing: -0.035em;
}

.projects-state p {
  max-width: 480px;
  margin: 0 0 20px;
  line-height: 1.6;
}

.loading-orb {
  width: 38px;
  height: 38px;
  border: 3px solid #ddd9ff;
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 700ms linear infinite;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin-top: 30px;
  color: var(--muted);
  font-size: 0.88rem;
}

.pagination .secondary-button {
  min-height: 42px;
}

.pagination button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.dialog-backdrop {
  position: fixed;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(23, 32, 51, 0.52);
  backdrop-filter: blur(5px);
}

.project-dialog {
  width: min(100%, 590px);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  padding: 28px;
  border-radius: 22px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.dialog-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 25px;
}

.dialog-heading h2 {
  margin: 8px 0 0;
  font-family: 'Manrope', sans-serif;
  font-size: 1.65rem;
  letter-spacing: -0.045em;
}

.icon-button {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  color: var(--muted);
  background: #f2f4f8;
  font-size: 1.4rem;
}

.project-form {
  display: grid;
  gap: 20px;
}

.project-form input,
.project-form textarea {
  width: 100%;
  padding: 14px 15px;
  border: 1px solid var(--line);
  border-radius: 13px;
  outline: none;
  color: var(--ink);
  background: #ffffff;
  resize: vertical;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}

.dialog-actions .primary-button {
  padding: 0 22px;
}

.project-workspace .back-link {
  display: inline-flex;
  margin-bottom: 30px;
}

.workspace-heading {
  padding: clamp(28px, 5vw, 54px);
  border: 1px solid var(--line);
  border-radius: 24px;
  background:
    radial-gradient(circle at 100% 0, rgba(101, 86, 232, 0.13), transparent 36%),
    #ffffff;
  box-shadow: 0 16px 50px rgba(48, 52, 84, 0.06);
}

.workspace-heading p {
  max-width: 720px;
}

.workspace-placeholder {
  margin-top: 22px;
  padding: 34px;
  border: 1px dashed #cfd4e0;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.58);
}

.workspace-placeholder h2 {
  margin: 9px 0 8px;
  font-family: 'Manrope', sans-serif;
  letter-spacing: -0.04em;
}

.project-workspace-state {
  min-height: 460px;
  display: grid;
  place-content: center;
  justify-items: center;
  text-align: center;
}

.link-button {
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  padding: 0 18px;
}

@media (max-width: 1020px) {
  .projects-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .projects-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .project-search {
    min-width: 0;
    width: 100%;
  }
}

@media (max-width: 700px) {
  .projects-page,
  .project-workspace {
    width: min(100% - 28px, 1240px);
    padding-top: 30px;
  }

  .projects-hero {
    align-items: stretch;
    flex-direction: column;
  }

  .projects-hero > .primary-button {
    width: 100%;
  }

  .projects-grid {
    grid-template-columns: 1fr;
  }

  .project-search {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .project-search input {
    flex-basis: 100%;
  }

  .project-search .secondary-button {
    flex: 1;
  }

  .project-card-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .project-actions {
    justify-content: flex-start;
  }

  .dialog-actions {
    flex-direction: column-reverse;
  }

  .dialog-actions button {
    width: 100%;
  }
}
`````


### `frontend/src/features/projects/types.ts`

`````typescript
export type ProjectStatus = 'active' | 'archived'

export interface Project {
  id: string
  owner_id: string
  name: string
  description: string | null
  status: ProjectStatus
  created_at: string
  updated_at: string
}

export interface PaginatedProjects {
  items: Project[]
  total: number
  page: number
  size: number
  pages: number
}

export interface ProjectFilters {
  page: number
  size: number
  status: ProjectStatus
  search?: string
}

export interface ProjectPayload {
  name: string
  description: string | null
}

export interface ProjectUpdatePayload {
  name?: string
  description?: string | null
  status?: ProjectStatus
}
`````


### `frontend/src/features/projects/api.ts`

`````typescript
import { apiRequest } from '../../api/client'
import type {
  PaginatedProjects,
  Project,
  ProjectFilters,
  ProjectPayload,
  ProjectUpdatePayload,
} from './types'

export function listProjects(filters: ProjectFilters): Promise<PaginatedProjects> {
  const params = new URLSearchParams({
    page: String(filters.page),
    size: String(filters.size),
    status: filters.status,
  })

  if (filters.search) {
    params.set('search', filters.search)
  }

  return apiRequest<PaginatedProjects>(`/projects?${params.toString()}`)
}

export function getProject(projectId: string): Promise<Project> {
  return apiRequest<Project>(`/projects/${projectId}`)
}

export function createProject(payload: ProjectPayload): Promise<Project> {
  return apiRequest<Project>('/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateProject(
  projectId: string,
  payload: ProjectUpdatePayload,
): Promise<Project> {
  return apiRequest<Project>(`/projects/${projectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function archiveProject(projectId: string): Promise<Project> {
  return apiRequest<Project>(`/projects/${projectId}/archive`, {
    method: 'PATCH',
  })
}

export function deleteProject(projectId: string): Promise<void> {
  return apiRequest<void>(`/projects/${projectId}`, {
    method: 'DELETE',
  })
}
`````


### `frontend/src/features/projects/hooks.ts`

`````typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as projectsApi from './api'
import type {
  Project,
  ProjectFilters,
  ProjectPayload,
  ProjectUpdatePayload,
} from './types'

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: ProjectFilters) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (projectId: string) => [...projectKeys.details(), projectId] as const,
}

export function useProjects(filters: ProjectFilters) {
  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: () => projectsApi.listProjects(filters),
  })
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => projectsApi.getProject(projectId),
    enabled: Boolean(projectId),
  })
}

function useRefreshProjectQueries() {
  const queryClient = useQueryClient()

  return async (project?: Project) => {
    if (project) {
      queryClient.setQueryData(projectKeys.detail(project.id), project)
    }

    await queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
  }
}

export function useCreateProject() {
  const refresh = useRefreshProjectQueries()

  return useMutation({
    mutationFn: (payload: ProjectPayload) => projectsApi.createProject(payload),
    onSuccess: (project) => refresh(project),
  })
}

export function useUpdateProject() {
  const refresh = useRefreshProjectQueries()

  return useMutation({
    mutationFn: ({
      projectId,
      payload,
    }: {
      projectId: string
      payload: ProjectUpdatePayload
    }) => projectsApi.updateProject(projectId, payload),
    onSuccess: (project) => refresh(project),
  })
}

export function useArchiveProject() {
  const refresh = useRefreshProjectQueries()

  return useMutation({
    mutationFn: (projectId: string) => projectsApi.archiveProject(projectId),
    onSuccess: (project) => refresh(project),
  })
}

export function useRestoreProject() {
  const refresh = useRefreshProjectQueries()

  return useMutation({
    mutationFn: (projectId: string) =>
      projectsApi.updateProject(projectId, { status: 'active' }),
    onSuccess: (project) => refresh(project),
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (projectId: string) => projectsApi.deleteProject(projectId),
    onSuccess: async (_, projectId) => {
      queryClient.removeQueries({ queryKey: projectKeys.detail(projectId) })
      await queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    },
  })
}
`````

### `frontend/src/features/projects/components/ProjectFormDialog.tsx`

`````tsx
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
`````


### `frontend/src/features/projects/components/ProjectCard.tsx`

`````tsx
import { Link } from 'react-router-dom'
import type { Project } from '../types'

interface ProjectCardProps {
  project: Project
  isBusy: boolean
  onEdit: (project: Project) => void
  onArchive: (project: Project) => void
  onRestore: (project: Project) => void
  onDelete: (project: Project) => void
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function ProjectCard({
  project,
  isBusy,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: ProjectCardProps) {
  const isArchived = project.status === 'archived'

  return (
    <article className="project-card">
      <div className="project-card-topline">
        <span className={`status-badge status-${project.status}`}>
          {isArchived ? 'Arquivado' : 'Ativo'}
        </span>
        <span className="project-updated">
          Atualizado em {dateFormatter.format(new Date(project.updated_at))}
        </span>
      </div>

      <div className="project-card-content">
        <h2>{project.name}</h2>
        <p>{project.description || 'Projeto sem descrição.'}</p>
      </div>

      <div className="project-card-footer">
        <Link className="project-open-link" to={`/app/projects/${project.id}`}>
          Abrir projeto <span aria-hidden="true">→</span>
        </Link>

        <div className="project-actions" aria-label={`Ações de ${project.name}`}>
          <button type="button" onClick={() => onEdit(project)} disabled={isBusy}>
            Editar
          </button>
          {isArchived ? (
            <button type="button" onClick={() => onRestore(project)} disabled={isBusy}>
              Restaurar
            </button>
          ) : (
            <button type="button" onClick={() => onArchive(project)} disabled={isBusy}>
              Arquivar
            </button>
          )}
          <button
            className="danger-text-button"
            type="button"
            onClick={() => onDelete(project)}
            disabled={isBusy}
          >
            Excluir
          </button>
        </div>
      </div>
    </article>
  )
}
`````


### `frontend/src/features/projects/pages/ProjectsPage.tsx`

`````tsx
import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../../../api/client'
import { useAuth } from '../../auth/auth-context'
import { ProjectCard } from '../components/ProjectCard'
import { ProjectFormDialog } from '../components/ProjectFormDialog'
import {
  useArchiveProject,
  useCreateProject,
  useDeleteProject,
  useProjects,
  useRestoreProject,
  useUpdateProject,
} from '../hooks'
import type { Project, ProjectPayload, ProjectStatus } from '../types'

const PAGE_SIZE = 9

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.detail
  }

  return 'Não foi possível concluir a ação. Tente novamente.'
}

export function ProjectsPage() {
  const { user } = useAuth()
  const [status, setStatus] = useState<ProjectStatus>('active')
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const projectsQuery = useProjects({
    page,
    size: PAGE_SIZE,
    status,
    search: search || undefined,
  })
  const createMutation = useCreateProject()
  const updateMutation = useUpdateProject()
  const archiveMutation = useArchiveProject()
  const restoreMutation = useRestoreProject()
  const deleteMutation = useDeleteProject()

  useEffect(() => {
    if (!projectsQuery.data) {
      return
    }

    const lastAvailablePage = Math.max(projectsQuery.data.pages, 1)
    if (page > lastAvailablePage) {
      setPage(lastAvailablePage)
    }
  }, [page, projectsQuery.data])

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    archiveMutation.isPending ||
    restoreMutation.isPending ||
    deleteMutation.isPending

  const closeDialog = () => {
    if (isMutating) {
      return
    }

    setIsCreating(false)
    setEditingProject(null)
    setActionError(null)
  }

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSearch(searchInput.trim())
    setPage(1)
  }

  const changeStatus = (nextStatus: ProjectStatus) => {
    setStatus(nextStatus)
    setPage(1)
    setActionError(null)
  }

  const submitProject = async (payload: ProjectPayload) => {
    setActionError(null)

    try {
      if (editingProject) {
        await updateMutation.mutateAsync({
          projectId: editingProject.id,
          payload,
        })
      } else {
        await createMutation.mutateAsync(payload)
        // Um projeto novo sempre nasce ativo. Voltamos à lista principal e
        // removemos filtros que poderiam esconder o item recém-criado.
        setStatus('active')
        setPage(1)
        setSearchInput('')
        setSearch('')
      }

      setEditingProject(null)
      setIsCreating(false)
    } catch (error) {
      setActionError(getErrorMessage(error))
    }
  }

  const runProjectAction = async (action: () => Promise<unknown>) => {
    setActionError(null)

    try {
      await action()
    } catch (error) {
      setActionError(getErrorMessage(error))
    }
  }

  const deleteProject = (project: Project) => {
    const confirmed = window.confirm(
      `Excluir o projeto “${project.name}” e todas as suas tarefas? Esta ação não pode ser desfeita.`,
    )

    if (confirmed) {
      void runProjectAction(() => deleteMutation.mutateAsync(project.id))
    }
  }

  const projects = projectsQuery.data?.items ?? []
  const total = projectsQuery.data?.total ?? 0
  const pages = projectsQuery.data?.pages ?? 0

  return (
    <main className="projects-page">
      <section className="projects-hero">
        <div>
          <span className="eyebrow">Visão geral</span>
          <h1>Projetos</h1>
          <p>
            Olá, {user?.name.split(' ')[0]}. Organize cada iniciativa em um espaço
            próprio e acompanhe o trabalho até a conclusão.
          </p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => {
            setActionError(null)
            setIsCreating(true)
          }}
        >
          + Novo projeto
        </button>
      </section>

      <section className="projects-toolbar" aria-label="Filtros de projetos">
        <div className="project-tabs" role="group" aria-label="Status dos projetos">
          <button
            className={status === 'active' ? 'is-active' : undefined}
            type="button"
            aria-pressed={status === 'active'}
            onClick={() => changeStatus('active')}
          >
            Ativos
          </button>
          <button
            className={status === 'archived' ? 'is-active' : undefined}
            type="button"
            aria-pressed={status === 'archived'}
            onClick={() => changeStatus('archived')}
          >
            Arquivados
          </button>
        </div>

        <form className="project-search" role="search" onSubmit={submitSearch}>
          <label className="sr-only" htmlFor="project-search-input">
            Buscar projetos
          </label>
          <input
            id="project-search-input"
            type="search"
            placeholder="Buscar pelo nome"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button className="secondary-button" type="submit">
            Buscar
          </button>
          {search ? (
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setSearchInput('')
                setSearch('')
                setPage(1)
              }}
            >
              Limpar
            </button>
          ) : null}
        </form>
      </section>

      {actionError ? (
        <div className="page-alert" role="alert">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)}>
            Fechar
          </button>
        </div>
      ) : null}

      {projectsQuery.isPending ? (
        <section className="projects-state" role="status">
          <div className="loading-orb" aria-hidden="true" />
          <h2>Carregando projetos</h2>
          <p>Estamos preparando seu espaço de trabalho.</p>
        </section>
      ) : projectsQuery.isError ? (
        <section className="projects-state projects-state-error" role="alert">
          <span aria-hidden="true">!</span>
          <h2>Não foi possível carregar os projetos</h2>
          <p>{getErrorMessage(projectsQuery.error)}</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void projectsQuery.refetch()}
          >
            Tentar novamente
          </button>
        </section>
      ) : projects.length === 0 ? (
        <section className="projects-state projects-empty">
          <span aria-hidden="true">{status === 'active' ? '◇' : '□'}</span>
          <h2>
            {search
              ? 'Nenhum projeto encontrado'
              : status === 'active'
                ? 'Crie seu primeiro projeto'
                : 'Nenhum projeto arquivado'}
          </h2>
          <p>
            {search
              ? 'Revise o termo pesquisado ou limpe o filtro para ver todos os projetos.'
              : status === 'active'
                ? 'Separe iniciativas, tarefas e prazos em espaços organizados.'
                : 'Projetos arquivados aparecerão aqui e poderão ser restaurados.'}
          </p>
          {!search && status === 'active' ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => setIsCreating(true)}
            >
              Criar projeto
            </button>
          ) : null}
        </section>
      ) : (
        <>
          <div className="projects-summary">
            <strong>{total}</strong> {total === 1 ? 'projeto' : 'projetos'}
            {search ? <span> para “{search}”</span> : null}
          </div>

          <section className="projects-grid" aria-label="Lista de projetos">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isBusy={isMutating}
                onEdit={(selectedProject) => {
                  setActionError(null)
                  setEditingProject(selectedProject)
                }}
                onArchive={(selectedProject) =>
                  void runProjectAction(() =>
                    archiveMutation.mutateAsync(selectedProject.id),
                  )
                }
                onRestore={(selectedProject) =>
                  void runProjectAction(() =>
                    restoreMutation.mutateAsync(selectedProject.id),
                  )
                }
                onDelete={deleteProject}
              />
            ))}
          </section>

          {pages > 1 ? (
            <nav className="pagination" aria-label="Paginação de projetos">
              <button
                className="secondary-button"
                type="button"
                disabled={page === 1 || projectsQuery.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </button>
              <span>
                Página {page} de {pages}
              </span>
              <button
                className="secondary-button"
                type="button"
                disabled={page >= pages || projectsQuery.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima
              </button>
            </nav>
          ) : null}
        </>
      )}

      {isCreating || editingProject ? (
        <ProjectFormDialog
          project={editingProject ?? undefined}
          isPending={createMutation.isPending || updateMutation.isPending}
          errorMessage={actionError}
          onClose={closeDialog}
          onSubmit={submitProject}
        />
      ) : null}
    </main>
  )
}
`````

### `frontend/src/features/projects/pages/ProjectWorkspacePage.tsx`

`````tsx
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../../api/client'
import { useProject } from '../hooks'

function getErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.detail
    : 'Não foi possível carregar o projeto.'
}

export function ProjectWorkspacePage() {
  const { projectId = '' } = useParams()
  const projectQuery = useProject(projectId)

  if (projectQuery.isPending) {
    return (
      <main className="project-workspace project-workspace-state" role="status">
        <div className="loading-orb" aria-hidden="true" />
        <p>Carregando projeto…</p>
      </main>
    )
  }

  if (projectQuery.isError) {
    return (
      <main className="project-workspace project-workspace-state" role="alert">
        <h1>Projeto indisponível</h1>
        <p>{getErrorMessage(projectQuery.error)}</p>
        <Link className="secondary-button link-button" to="/app">
          Voltar aos projetos
        </Link>
      </main>
    )
  }

  const project = projectQuery.data

  return (
    <main className="project-workspace">
      <Link className="back-link" to="/app">
        ← Todos os projetos
      </Link>
      <section className="workspace-heading">
        <div>
          <span className={`status-badge status-${project.status}`}>
            {project.status === 'archived' ? 'Arquivado' : 'Ativo'}
          </span>
          <h1>{project.name}</h1>
          <p>{project.description || 'Projeto sem descrição.'}</p>
        </div>
      </section>
      <section className="workspace-placeholder">
        <span className="eyebrow">Próxima etapa</span>
        <h2>Tarefas do projeto</h2>
        <p>
          A estrutura do projeto já está pronta. A Etapa 07 adicionará criação,
          edição e visualização das tarefas em lista.
        </p>
      </section>
    </main>
  )
}
`````


### `frontend/src/features/projects/pages/ProjectsPage.test.tsx`

`````tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../../auth/auth-context'
import { ProjectsPage } from './ProjectsPage'

const authValue: AuthContextValue = {
  user: {
    id: 'user-1',
    name: 'Ana Silva',
    email: 'ana@example.com',
    is_active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderProjectsPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/app']}>
          <Routes>
            <Route path="/app" element={<ProjectsPage />} />
            <Route path="/app/projects/:projectId" element={<h1>Projeto aberto</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('ProjectsPage', () => {
  it('renders projects returned by the API', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: 'project-1',
            owner_id: 'user-1',
            name: 'Portal do cliente',
            description: 'Nova área autenticada para clientes.',
            status: 'active',
            created_at: '2026-08-01T00:00:00Z',
            updated_at: '2026-08-01T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        size: 9,
        pages: 1,
      }),
    )

    renderProjectsPage()

    expect(await screen.findByText('Portal do cliente')).toBeVisible()
    expect(screen.getByText('Nova área autenticada para clientes.')).toBeVisible()
    expect(screen.getByRole('link', { name: /Abrir projeto/ })).toHaveAttribute(
      'href',
      '/app/projects/project-1',
    )
  })

  it('creates a project and refreshes the list', async () => {
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({ items: [], total: 0, page: 1, size: 9, pages: 0 }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            id: 'project-2',
            owner_id: 'user-1',
            name: 'Aplicativo móvel',
            description: 'Planejamento do novo aplicativo.',
            status: 'active',
            created_at: '2026-08-01T00:00:00Z',
            updated_at: '2026-08-01T00:00:00Z',
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'project-2',
              owner_id: 'user-1',
              name: 'Aplicativo móvel',
              description: 'Planejamento do novo aplicativo.',
              status: 'active',
              created_at: '2026-08-01T00:00:00Z',
              updated_at: '2026-08-01T00:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          size: 9,
          pages: 1,
        }),
      )

    renderProjectsPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Criar projeto' }))
    const dialog = screen.getByRole('dialog', { name: 'Crie um espaço de trabalho' })

    fireEvent.change(within(dialog).getByLabelText('Nome'), {
      target: { value: 'Aplicativo móvel' },
    })
    fireEvent.change(within(dialog).getByLabelText('Descrição'), {
      target: { value: 'Planejamento do novo aplicativo.' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar projeto' }))

    expect(await screen.findByText('Aplicativo móvel')).toBeVisible()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3))
    expect(fetchSpy.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' })
    expect(fetchSpy.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({
        name: 'Aplicativo móvel',
        description: 'Planejamento do novo aplicativo.',
      }),
    )
  })

  it('edits an existing project and refreshes its card', async () => {
    vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'project-3',
              owner_id: 'user-1',
              name: 'Nome anterior',
              description: null,
              status: 'active',
              created_at: '2026-08-01T00:00:00Z',
              updated_at: '2026-08-01T00:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          size: 9,
          pages: 1,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'project-3',
          owner_id: 'user-1',
          name: 'Nome atualizado',
          description: 'Descrição atualizada.',
          status: 'active',
          created_at: '2026-08-01T00:00:00Z',
          updated_at: '2026-08-01T01:00:00Z',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'project-3',
              owner_id: 'user-1',
              name: 'Nome atualizado',
              description: 'Descrição atualizada.',
              status: 'active',
              created_at: '2026-08-01T00:00:00Z',
              updated_at: '2026-08-01T01:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          size: 9,
          pages: 1,
        }),
      )

    renderProjectsPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    const dialog = screen.getByRole('dialog', { name: 'Atualize os detalhes' })

    fireEvent.change(within(dialog).getByLabelText('Nome'), {
      target: { value: 'Nome atualizado' },
    })
    fireEvent.change(within(dialog).getByLabelText('Descrição'), {
      target: { value: 'Descrição atualizada.' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar alterações' }),
    )

    expect(await screen.findByText('Nome atualizado')).toBeVisible()
    expect(screen.getByText('Descrição atualizada.')).toBeVisible()
  })

  it('archives a project and removes it from the active list', async () => {
    vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'project-4',
              owner_id: 'user-1',
              name: 'Projeto concluído',
              description: null,
              status: 'active',
              created_at: '2026-08-01T00:00:00Z',
              updated_at: '2026-08-01T00:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          size: 9,
          pages: 1,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'project-4',
          owner_id: 'user-1',
          name: 'Projeto concluído',
          description: null,
          status: 'archived',
          created_at: '2026-08-01T00:00:00Z',
          updated_at: '2026-08-01T01:00:00Z',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ items: [], total: 0, page: 1, size: 9, pages: 0 }),
      )

    renderProjectsPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Arquivar' }))

    expect(await screen.findByText('Crie seu primeiro projeto')).toBeVisible()
    expect(screen.queryByText('Projeto concluído')).not.toBeInTheDocument()
  })

})
`````

### `docs/AI_USAGE.md`

`````markdown
# Uso de IA no desenvolvimento do Taskly

## Princípios de registro

A IA é utilizada neste projeto como ferramenta de apoio para pesquisa técnica, organização de informações, comparação de alternativas, identificação preliminar de riscos e revisão de soluções.

As decisões arquiteturais, a seleção das abordagens aplicadas, a implementação, as adaptações ao código existente, a execução das validações e a responsabilidade pelo resultado final pertencem ao desenvolvedor.

Os registros abaixo não tratam sugestões da IA como decisões automáticas. Cada etapa deve distinguir:

- o que foi solicitado à ferramenta;
- quais alternativas foram apresentadas;
- qual decisão foi tomada pelo desenvolvedor;
- quais alterações foram realizadas pelo desenvolvedor;
- quais resultados foram efetivamente validados.

Não serão registrados testes, comandos ou resultados como executados sem a respectiva evidência real.

---

## Etapa 01 - Diagnóstico e decisões técnicas iniciais

### Objetivo

Analisar a base KanbanCore API, identificar o que pode ser reaproveitado no Taskly, localizar lacunas em relação ao escopo do desafio e estabelecer uma sequência de implementação compatível com o prazo de três dias.

### Uso da IA

A IA foi utilizada como apoio para:

- organizar o inventário dos componentes existentes;
- comparar o código atual com os requisitos funcionais do Taskly;
- levantar arquivos potencialmente afetados;
- apresentar alternativas para tags, anexos, persistência de sessão e migrations;
- apontar riscos que deveriam ser verificados antes da implementação;
- estruturar um plano incremental de execução.

Nesta etapa, a IA não implementou funcionalidades nem substituiu a análise e a aprovação do desenvolvedor.

### Sugestão inicial

A análise assistida sugeriu:

- preservar a arquitetura em camadas já existente;
- corrigir a base de migrations antes de evoluir o modelo de tarefas;
- utilizar tags relacionais com escopo por usuário;
- isolar o armazenamento de anexos atrás de uma interface;
- manter prioridade como recurso adicional;
- trabalhar com `due_at` timezone-aware e contrato em UTC;
- carregar todas as páginas de tarefas do projeto para compor o kanban;
- tratar projetos arquivados como somente leitura;
- documentar conscientemente os trade-offs da sessão persistente no frontend.

Também foram apontados como riscos prioritários a ausência de revisions Alembic versionadas, a regra do `.gitignore` que bloqueia migrations, a falta de endpoint de refresh e a ausência de testes de ownership entre usuários diferentes.

### Decisão do desenvolvedor

O desenvolvedor revisou o diagnóstico e aprovou as diretrizes técnicas iniciais.

Foram adotadas as seguintes decisões:

- preservar a arquitetura `api → service → repository → model`;
- considerar o banco local do case recriável, sem obrigação de preservar dados anteriores;
- criar uma baseline Alembic reproduzível antes das mudanças funcionais;
- implementar tags por meio de modelagem relacional enxuta e reutilizável por usuário;
- implementar anexos com metadados relacionais e uma abstração de armazenamento;
- usar armazenamento local em desenvolvimento e testes, deixando a implementação de produção vinculada ao provedor de deploy;
- manter o campo de prioridade;
- adotar UTC como contrato de persistência e transporte para prazos;
- carregar todas as páginas de tarefas de um projeto na visualização kanban;
- tratar projetos arquivados como somente leitura;
- limitar anexos inicialmente a imagens e PDF, com limite configurável;
- utilizar a IA como apoio de pesquisa, comparação e revisão, mantendo decisões e implementação sob responsabilidade do desenvolvedor.

A definição do provedor de deploy e do storage de produção permanece deliberadamente adiada para a etapa de infraestrutura, pois depende das condições reais do ambiente escolhido.

### Alterações humanas

Nesta etapa, o desenvolvedor:

- forneceu o repositório e o escopo do desafio como base da análise;
- definiu que funcionalidades existentes não devem ser reescritas sem justificativa;
- aprovou as decisões técnicas iniciais;
- determinou a forma correta de registrar o uso de IA no desafio;
- manteve a Etapa 01 exclusivamente documental, sem alteração do código-fonte.

### Problemas identificados

- `alembic/versions/` não contém uma revision inicial versionada.
- `.gitignore` ignora `alembic/versions/*.py`.
- O entrypoint executa `alembic upgrade head`, mas a ausência de revisions impede a criação das tabelas em um banco vazio.
- O backend emite refresh token, porém não possui endpoint de renovação.
- Os testes usam `Base.metadata.create_all()` e não validam a integridade das migrations.
- A suíte atual não cobre tentativas de acesso cruzado entre usuários distintos.
- O kanban poderá exibir dados incompletos se consumir apenas a primeira página da listagem.
- Anexos exigem ownership indireto e limpeza coordenada entre banco e storage.
- A conversão futura de `due_date` para `due_at` exige tratamento explícito de timezone.

### Validação

A etapa foi validada por inspeção estática dos arquivos fornecidos e comparação com o escopo aprovado.

Nenhum comando de `pytest`, Ruff, Alembic, Docker, lint, TypeScript ou Vitest foi executado nesta etapa. Não houve alteração de código a ser validada.

### Resultado

O diagnóstico foi consolidado, as decisões iniciais foram aprovadas e a ordem de implementação foi definida. O código-fonte permanece inalterado.

A próxima etapa será a preparação da baseline Alembic e a adaptação do modelo de tarefas, iniciando pela integridade do banco antes da evolução funcional.

---

## Etapa 02 - Baseline Alembic e adaptação do modelo de tarefas

### Objetivo

Estabelecer migrations reproduzíveis e adaptar o contrato de tarefas aos requisitos obrigatórios do Taskly, incluindo descrição curta, prazo com data e hora em UTC e status de cancelamento.

### Uso da IA

A IA foi utilizada como ferramenta de apoio para:

- revisar o comportamento de enums Python no SQLAlchemy e comparar persistência por nome ou valor;
- organizar alternativas para a baseline Alembic;
- sugerir uma estratégia explícita de conversão de `due_date` para `due_at`;
- levantar cenários de teste para timezone, ownership e projetos arquivados;
- revisar dependências entre model, schema, repository, service, route e migration;
- estruturar os comandos e a documentação da etapa.

A implementação proposta foi revisada e selecionada pelo desenvolvedor. A ferramenta não executou deploy, não confirmou a suíte completa e não substituiu a validação no ambiente real do projeto.

### Sugestão inicial

A análise assistida apresentou como alternativas:

1. criar uma única migration já no formato final do Taskly;
2. criar uma baseline do KanbanCore e uma segunda revision incremental;
3. continuar usando `create_all()` nos testes e validar Alembic separadamente.

Também foi sugerido:

- normalizar datetimes timezone-aware para UTC na fronteira Pydantic;
- converter datas legadas para um horário determinístico;
- adicionar `cancelled` explicitamente ao enum PostgreSQL;
- impedir alterações em tarefas de projetos arquivados;
- criar testes com dois usuários reais para validar ownership.

### Decisão do desenvolvedor

O desenvolvedor decidiu:

- usar duas revisions, preservando uma baseline compreensível e uma evolução incremental;
- considerar o banco local anterior descartável, exigindo recriação para adoção da baseline;
- armazenar os valores textuais dos enums (`active`, `todo`, `high`) em vez dos nomes internos dos membros Python;
- tornar `short_description` obrigatória, com limite de 280 caracteres;
- manter `description` completa opcional e editável;
- exigir timezone em `due_at` e normalizar o valor para UTC;
- converter `due_date` legado para 23:59 UTC do mesmo dia durante a migration;
- tratar projetos arquivados como somente leitura também para atualização e exclusão de tarefas;
- executar a cadeia Alembic no setup dos testes, substituindo `create_all()` como preparação principal;
- proteger o reset destrutivo do schema de testes quando o ambiente não estiver identificado como teste.

### Alterações humanas

O desenvolvedor deve revisar e aplicar os arquivos da etapa no repositório, resolver eventuais diferenças com alterações locais e executar as validações no PostgreSQL do projeto.

Antes da aceitação final, cabe ao desenvolvedor:

- conferir a migration em banco vazio;
- validar o downgrade em banco descartável;
- analisar a saída real de Ruff e pytest;
- corrigir qualquer diferença específica do ambiente;
- decidir e executar o commit.

### Problemas identificados

- O `.gitignore` original descartava todas as revisions Alembic.
- A suíte original criava tabelas por `Base.metadata.create_all()`, ocultando migrations ausentes ou inválidas.
- `Enum(PythonEnum)` do SQLAlchemy persiste nomes dos membros por padrão, o que poderia divergir dos valores minúsculos esperados pela API e pelas migrations.
- Um datetime sem offset tornaria o prazo dependente do timezone do servidor.
- A remoção de um valor de enum no downgrade exige recriação controlada do tipo no PostgreSQL.
- O reset do schema usado nos testes é destrutivo e só pode apontar para banco descartável.
- O ambiente usado para preparação dos arquivos não possuía Ruff, `python-jose`, `psycopg` nem uma instância PostgreSQL disponível.

### Validação

Foram realizadas as seguintes verificações locais durante a preparação:

- compilação sintática com `python -m compileall -q app alembic`;
- inspeção da cadeia com `alembic heads` e `alembic history`;
- geração offline PostgreSQL das sequências de upgrade e downgrade para verificar o SQL produzido e o encadeamento das revisions;
- validação direta dos schemas Pydantic para normalização UTC, rejeição de datetime sem timezone e rejeição de `short_description=null`;
- validação direta do mapeamento SQLAlchemy dos enums para valores minúsculos;
- persistência básica do novo modelo em SQLite apenas como verificação auxiliar do ORM.

Não foram executados com sucesso nesta preparação:

- `ruff check .` e `ruff format . --check`, porque Ruff não estava disponível no ambiente;
- `pytest`, porque faltavam dependências da aplicação e PostgreSQL;
- migrations online contra PostgreSQL.

Essas validações permanecem obrigatórias no ambiente do desenvolvedor. Nenhum resultado pendente é apresentado como aprovado.

### Resultado

Os arquivos da Etapa 02 foram preparados com baseline Alembic, migration incremental, contrato atualizado de tarefas, proteção de projetos arquivados, testes de ownership e setup de testes baseado em migrations.

A etapa só deve ser considerada concluída após o desenvolvedor aplicar os arquivos e registrar os resultados reais de Alembic, Ruff e pytest.

---

## Etapa 03 - Tags relacionais e estrutura fullstack

### Objetivo

Reorganizar o repositório em `backend/`, `frontend/` e `docs/`, preservando na raiz os arquivos de coordenação do monorepo, e implementar tags relacionais reutilizáveis por usuário nas tarefas.

### Uso da IA

A IA foi utilizada como ferramenta de apoio para:

- comparar uma raiz exclusivamente backend com uma estrutura de monorepo;
- classificar quais arquivos pertencem ao runtime do backend e quais coordenam o repositório inteiro;
- comparar contratos baseados em IDs de tags com contratos baseados em nomes;
- revisar a modelagem many-to-many e a restrição de unicidade por usuário;
- levantar cenários de normalização, substituição, remoção e ownership de tags;
- verificar dependências entre model, schema, repository, service, route, migration, CI e Docker Compose;
- organizar os comandos e a documentação da etapa.

A ferramenta não escolheu autonomamente a arquitetura nem validou o comportamento em PostgreSQL. As sugestões foram submetidas à revisão do desenvolvedor.

### Sugestão inicial

A análise assistida sugeriu:

- manter `docs/`, `.github/`, `.gitignore`, `.pre-commit-config.yaml` e `docker-compose.yml` na raiz;
- mover `app/`, `alembic/`, `alembic.ini`, `pyproject.toml`, `.env.example`, `Dockerfile`, entrypoint e README técnico para `backend/`;
- reservar `frontend/` para a futura aplicação React/Vite;
- usar `tags` e `task_tags` com ownership direto em `users`;
- aceitar nomes de tags no payload de tarefas para impedir associação direta por IDs de outra conta;
- normalizar nomes para comparação e preservar um nome de exibição;
- usar eager loading para evitar consultas N+1 na serialização das tarefas;
- expor somente a listagem necessária ao autocomplete nesta etapa.

### Decisão do desenvolvedor

O desenvolvedor decidiu:

- adotar a estrutura de monorepo imediatamente, antes da criação do frontend;
- manter ferramentas de Git, CI, documentação e orquestração na raiz do repositório;
- manter o backend executável de forma independente dentro de `backend/`;
- resolver o arquivo `.env` por caminho absoluto derivado da pasta física do backend;
- criar tags relacionais com unicidade por `owner_id + normalized_name`;
- aceitar até dez tags por tarefa, cada uma com no máximo 40 caracteres;
- remover espaços redundantes e deduplicar tags sem diferenciar maiúsculas e minúsculas;
- preservar o primeiro nome de exibição enviado pelo usuário;
- permitir substituição integral das tags em `PATCH` e remoção por lista vazia;
- rejeitar `tags: null`, pois campo ausente e lista vazia já representam as duas operações necessárias;
- disponibilizar `GET /api/v1/tags` para seleção e autocomplete, sem ampliar o escopo para CRUD administrativo.

### Alterações humanas

Cabe ao desenvolvedor:

- aplicar o patch sobre o estado efetivo da Etapa 02;
- revisar os movimentos de arquivos antes de commitar;
- recriar ou ajustar o `.env` em `backend/.env`;
- reinstalar o projeto editável a partir de `backend/`;
- executar Alembic, Ruff e pytest no PostgreSQL local;
- analisar falhas específicas do ambiente e realizar eventuais correções;
- decidir quando a etapa está pronta para commit.

### Problemas identificados

- Após a reorganização, comandos executados na raiz antiga deixam de localizar `pyproject.toml` e `alembic.ini`.
- O Docker Compose precisa usar `./backend` como contexto e volume da API.
- A CI precisa definir `backend/` como diretório de trabalho.
- A configuração de `.env` baseada apenas no diretório corrente é frágil em um monorepo.
- Uma relação many-to-many sem eager loading pode gerar N+1 ao listar tarefas.
- Tags enviadas por ID abririam uma superfície adicional para associação cruzada entre usuários.
- A criação concorrente da mesma tag ainda depende da restrição única do banco; conflitos reais deverão ser observados durante testes de carga ou evolução do produto.
- O ambiente de preparação não possuía Ruff, psycopg nem Docker/PostgreSQL.

### Validação

Foram realizadas durante a preparação:

- compilação sintática com `python -m compileall -q backend/app backend/alembic`;
- validação da árvore SQLAlchemy, confirmando `users`, `projects`, `tasks`, `tags` e `task_tags` no metadata;
- validação dos schemas Pydantic para limpeza, deduplicação, lista vazia e rejeição de `tags: null`;
- inspeção da cadeia Alembic, confirmando `0003_add_relational_tags` como head;
- verificação de whitespace e estrutura do patch com `git diff --check`;
- integração auxiliar do repository em SQLite para criação, associação, substituição e carregamento de tags;
- verificação auxiliar de isolamento, confirmando que dois usuários podem possuir tags homônimas com IDs diferentes.

Não foram executados com sucesso neste ambiente:

- `ruff check .` e `ruff format . --check`;
- migrations online contra PostgreSQL;
- suíte completa com pytest;
- Docker Compose.

Esses resultados permanecem pendentes no ambiente do desenvolvedor e não são apresentados como aprovados.

### Resultado

A Etapa 03 foi preparada com estrutura fullstack, backend isolado em sua própria pasta, frontend reservado, migration relacional de tags, integração de tags ao fluxo de tarefas, endpoint de autocomplete e testes de ownership.

A conclusão efetiva depende da aplicação do patch e da validação real pelo desenvolvedor.

---

## Etapa 04 - Anexos e abstração de armazenamento

### Objetivo

Implementar anexos e fotos vinculados às tarefas, mantendo os metadados no PostgreSQL e os bytes fora do banco, com ownership, validação de tipo e tamanho, armazenamento substituível e limpeza coordenada em exclusões.

### Uso da IA

A IA foi utilizada como ferramenta de apoio para:

- comparar armazenamento de bytes no banco, filesystem e serviço compatível com S3;
- revisar o desenho de uma interface mínima de storage;
- levantar riscos de path traversal, nomes previsíveis, MIME forjado, arquivos órfãos e acesso cruzado;
- organizar alternativas de consistência entre metadados e conteúdo físico;
- sugerir cenários de teste para upload, listagem, download, exclusão, projeto arquivado e ownership;
- revisar as dependências entre model, migration, repository, service, rotas, configuração, Docker e testes;
- estruturar os comandos e a documentação da etapa.

As sugestões foram avaliadas pelo desenvolvedor antes de serem incorporadas. A ferramenta não selecionou o provider de produção, não executou migrations online e não validou a suíte completa no ambiente real.

### Sugestão inicial

A análise assistida sugeriu:

- criar `StorageBackend` com operações de salvar, abrir, excluir e verificar existência;
- usar `LocalStorageBackend` em desenvolvimento e testes;
- gerar chaves internas com UUID, sem usar o nome enviado como caminho físico;
- persistir nome, URL protegida, MIME, tamanho, chave interna e `task_id`;
- aceitar inicialmente JPEG, PNG, WebP e PDF;
- conferir MIME, limite de bytes e assinatura inicial do arquivo;
- validar ownership por `Attachment → Task → Project → owner_id`;
- impedir upload e exclusão em projetos arquivados;
- remover arquivos físicos quando anexo, tarefa ou projeto forem excluídos;
- usar diretório temporário isolado na suíte de testes.

### Decisão do desenvolvedor

O desenvolvedor decidiu:

- manter os bytes fora do PostgreSQL;
- adotar uma interface de storage independente do provider;
- usar armazenamento local no ambiente atual e volume persistente no Docker Compose;
- manter o endpoint de conteúdo autenticado, evitando exposição pública direta dos arquivos;
- limitar o MVP a JPEG, PNG, WebP e PDF, com tamanho padrão máximo de 5 MiB configurável;
- verificar assinaturas conhecidas além do MIME declarado;
- sanitizar o nome original apenas para exibição e `Content-Disposition`;
- gerar chaves internas por usuário, tarefa e UUID;
- aplicar 404 para recursos de outra conta, sem revelar sua existência;
- preservar consulta e download em projetos arquivados, bloqueando somente alterações;
- coordenar limpeza física nas exclusões de anexos, tarefas e projetos;
- manter a escolha do storage externo de produção para a etapa de deploy.

### Alterações humanas

Cabe ao desenvolvedor:

- aplicar o patch sobre o estado efetivo da Etapa 03;
- revisar os limites e tipos permitidos conforme o ambiente de apresentação;
- configurar `backend/.env` e o volume de anexos;
- executar a migration `0004_add_attachments` em PostgreSQL;
- executar Ruff e pytest e analisar as saídas reais;
- revisar o comportamento de upload e download pelo Swagger ou cliente HTTP;
- decidir e executar o commit da etapa.

### Problemas identificados

- O MIME informado pelo cliente não é evidência suficiente do conteúdo.
- Usar o nome original como caminho permitiria colisões e path traversal.
- Excluir somente os registros do banco deixaria arquivos órfãos no storage.
- Excluir somente os arquivos antes de validar ownership poderia remover conteúdo de outra conta.
- URLs públicas diretas dificultariam manter a mesma regra de autenticação da API.
- Um filesystem sem volume persistente perderia os anexos ao recriar o container.
- A migration de downgrade remove metadados, mas não consegue apagar automaticamente os bytes de um provider externo.
- O ambiente de preparação não possuía Ruff, `python-jose`, psycopg nem PostgreSQL disponível para a suíte completa.

### Validação

Foram realizadas durante a preparação:

- compilação sintática com `python -m compileall -q backend/app backend/alembic`;
- verificação de whitespace com `git diff --check`;
- inspeção da cadeia Alembic, mantendo `0004_add_attachments` após `0003_add_relational_tags`;
- inspeção dos endpoints e das relações ORM;
- verificação estática de linhas acima do limite de 88 caracteres;
- revisão dos fluxos de limpeza de arquivo em anexo, tarefa e projeto;
- criação de testes para ownership, tipos, assinatura, tamanho, projeto arquivado, download e limpeza física.

Não foram executados com sucesso neste ambiente:

- `ruff check .` e `ruff format . --check`, porque Ruff não estava instalado;
- `pytest`, porque faltavam dependências completas e PostgreSQL;
- `alembic upgrade head` online contra PostgreSQL;
- Docker Compose.

Essas validações permanecem obrigatórias no ambiente do desenvolvedor e nenhum resultado pendente é apresentado como aprovado.

### Resultado

A Etapa 04 foi preparada com entidade `Attachment`, migration, storage local desacoplado, endpoints autenticados, integração às respostas de tarefas, validações de segurança e testes de ownership e limpeza.

A conclusão efetiva depende da aplicação do patch e do registro das validações reais pelo desenvolvedor.

---

## Etapa 05 - Fundação do frontend e autenticação

### Objetivo

Inicializar o frontend React/Vite/TypeScript e conectar o fluxo completo de autenticação ao backend, incluindo cadastro, login, sessão persistente, renovação de token, validação do usuário autenticado, rotas protegidas e logout.

### Uso da IA

A IA foi utilizada como ferramenta de apoio para:

- pesquisar a documentação oficial e a compatibilidade das bibliotecas previstas para o frontend;
- comparar alternativas de organização do cliente HTTP e do estado de autenticação;
- levantar riscos de loops de refresh, repetição de requisições e tratamento incorreto de respostas `403`;
- sugerir a separação entre armazenamento dos tokens, cliente HTTP, contexto de autenticação, páginas e proteção de rotas;
- organizar cenários de teste para validação de formulários, persistência da sessão, renovação de token e redirecionamento;
- revisar a integração entre endpoint de refresh, TanStack Query, React Hook Form, Zod e React Router;
- estruturar a documentação e os comandos de validação da etapa.

A ferramenta serviu como apoio de pesquisa e revisão. As decisões aplicadas, a implementação, a validação local e a responsabilidade técnica permanecem com o desenvolvedor.

### Sugestão inicial

A análise assistida sugeriu:

- criar `POST /api/v1/auth/refresh` validando explicitamente o tipo `refresh` do JWT;
- manter o login compatível com o Swagger por `application/x-www-form-urlencoded`;
- centralizar chamadas HTTP em um cliente baseado em `fetch`;
- tentar refresh somente para ausência, invalidade ou expiração do token, sem interceptar todo `403`;
- persistir access e refresh tokens em um módulo isolado;
- usar TanStack Query para validar `GET /auth/me` e manter o usuário autenticado em cache;
- usar React Hook Form e Zod nos formulários de login e cadastro;
- separar rotas públicas de rotas protegidas;
- limpar tokens e cache no logout ou quando a renovação falhar definitivamente;
- adicionar testes de unidade e integração dos fluxos críticos da fundação.

### Decisão do desenvolvedor

O desenvolvedor decidiu:

- implementar a renovação da sessão no backend sem criar blacklist ou revogação nesta etapa;
- emitir novamente access e refresh tokens após a validação do usuário ativo;
- usar `localStorage` como trade-off consciente do case, conforme decisão já registrada;
- manter a URL da API configurável por `VITE_API_URL`;
- usar `fetch` nativo para evitar uma dependência adicional de cliente HTTP;
- renovar a sessão apenas diante de `401` ou do detalhe específico `Invalid or expired token`;
- preservar respostas `403` de regras de negócio sem tentativa automática de refresh;
- validar a sessão no carregamento por `GET /auth/me`;
- estruturar o frontend por feature, mantendo autenticação isolada das próximas áreas de projetos e tarefas;
- adicionar um job independente de frontend na CI;
- não antecipar os fluxos funcionais de projetos, lista ou kanban nesta etapa.

### Alterações humanas

Cabe ao desenvolvedor:

- instalar as dependências npm e revisar o arquivo de lock gerado no ambiente local;
- copiar `frontend/.env.example` para `frontend/.env` quando necessário;
- executar o frontend com o backend real e validar CORS;
- testar cadastro, login, recarregamento da página, expiração do access token e logout;
- executar ESLint, TypeScript, Vitest e build;
- executar Ruff e pytest para validar o endpoint de refresh;
- revisar acessibilidade, textos e comportamento responsivo no navegador;
- decidir e realizar o commit da etapa.

### Problemas identificados

- Armazenar tokens em `localStorage` mantém exposição em caso de XSS e não é a estratégia recomendada para um produto real.
- Interceptar todo status `403` provocaria tentativas de refresh para regras de ownership ou projetos arquivados.
- Renovar a sessão sem limitar a repetição poderia gerar loop infinito quando o refresh token também expirasse.
- Permitir access token no endpoint de refresh prolongaria indevidamente a sessão.
- Limpar a sessão em qualquer erro de rede poderia desconectar o usuário durante uma indisponibilidade temporária.
- O login do backend recebe form data no campo `username`, enquanto o formulário visual trabalha com `email`.
- A ausência de `package-lock.json` antes da primeira instalação impede o uso inicial de `npm ci`; o lock deverá ser gerado e versionado pelo desenvolvedor.
- O ambiente de preparação não possuía acesso ao registry npm nem as dependências do frontend instaladas.

### Validação

Foram realizadas durante a preparação:

- pesquisa da documentação oficial do Vite, TanStack Query, React Hook Form e Vitest;
- compilação sintática do backend com `python -m compileall -q backend/app backend/alembic`;
- análise sintática dos arquivos TypeScript e TSX com a API do compilador TypeScript disponível no ambiente;
- verificação de whitespace com `git diff --check`;
- inspeção do fluxo de retry, confirmando limite de uma tentativa após refresh;
- inspeção do tratamento seletivo de falhas de autenticação e respostas `403` de negócio;
- criação de testes para refresh no backend, armazenamento de tokens, cliente HTTP, login e rota protegida;
- revisão da separação entre `docs/etapas/etapa-05-frontend-base-auth.md` e `docs/prompts/prompt-etapa-05-frontend-base-auth.md`.

Não foram executados neste ambiente:

- `npm install`;
- `npm run lint`;
- `npx tsc --noEmit` com todas as dependências instaladas;
- `npm run test`;
- `npm run build`;
- Ruff;
- pytest completo;
- validação manual no navegador com backend e PostgreSQL ativos.

Nenhum desses resultados pendentes é apresentado como aprovado.

### Resultado

A Etapa 05 foi preparada com endpoint de refresh, testes de autenticação no backend, frontend React/Vite/TypeScript, cliente HTTP com renovação seletiva, cadastro, login, validação de sessão, rotas protegidas, logout, testes iniciais e job de CI.

A conclusão efetiva depende da instalação das dependências, geração do lockfile e execução das validações reais pelo desenvolvedor.

---

## Etapa 06 - Projetos no frontend

### Objetivo

Implementar a gestão de projetos no frontend, consumindo o CRUD já existente no backend e preparando a navegação para as tarefas de cada projeto.

### Uso da IA

A IA foi utilizada como apoio para:

- revisar os contratos já existentes de projetos no backend;
- comparar formas de organizar queries, mutations e invalidação de cache no TanStack Query;
- sugerir estados de carregamento, erro, vazio e paginação;
- levantar riscos de cache desatualizado após criação, edição, arquivamento, restauração e exclusão;
- revisar a acessibilidade do formulário modal e dos filtros;
- estruturar cenários de teste para listagem, criação, edição e arquivamento;
- organizar a documentação e os comandos de validação da etapa.

A ferramenta foi usada como apoio de pesquisa, comparação e revisão. A definição da experiência, a implementação, as adaptações ao projeto, a execução dos testes e a responsabilidade pelo resultado permanecem com o desenvolvedor.

### Sugestão inicial

A análise assistida sugeriu:

- manter toda a integração de projetos em uma feature própria;
- centralizar os contratos HTTP em `features/projects/api.ts`;
- criar chaves de cache hierárquicas para listas e detalhes;
- invalidar as listas após mutations e atualizar o detalhe quando disponível;
- usar filtros explícitos para ativos e arquivados;
- enviar a busca somente após submissão, evitando request a cada tecla;
- reutilizar um único formulário para criação e edição;
- manter uma rota de workspace do projeto, deixando tarefas para a etapa seguinte;
- testar os fluxos críticos com `fireEvent`, evitando o problema de timeout identificado na Etapa 05.

### Decisão do desenvolvedor

O desenvolvedor decidiu:

- preservar integralmente o backend de projetos, pois os endpoints existentes já atendem à etapa;
- adotar cards responsivos com acesso ao workspace do projeto;
- incluir criação, edição, arquivamento, restauração e exclusão;
- manter busca, filtro por status e paginação refletidos nas chaves do TanStack Query;
- exigir confirmação explícita antes da exclusão definitiva;
- manter a criação de tarefas fora desta etapa;
- usar atualização por invalidação do cache, evitando estado remoto duplicado em componentes;
- não adicionar nova entrada ao `DECISIONS.md`, pois não houve decisão arquitetural nova de longo prazo.

### Alterações humanas

Cabe ao desenvolvedor:

- aplicar e revisar o patch no repositório real;
- executar a aplicação com a API e o PostgreSQL ativos;
- revisar textos, responsividade e experiência dos formulários no navegador;
- validar busca, paginação, criação, edição, arquivamento, restauração e exclusão com dados reais;
- executar lint, type-check, Vitest e build;
- revisar o `package-lock.json` já existente após qualquer instalação;
- realizar o commit somente depois das validações locais.

### Problemas identificados

- Mutations sem invalidação deixariam cards e contadores desatualizados.
- Busca disparada com valor vazio poderia gerar contrato inconsistente ou request desnecessária.
- Criar estado local duplicado dos projetos aumentaria o risco de divergência com o cache.
- Exclusão sem confirmação seria perigosa porque o backend remove tarefas e anexos relacionados.
- Um projeto arquivado precisa permanecer consultável e restaurável, mas suas tarefas serão somente leitura.
- Testes que consultam botões atrás de um diálogo podem encontrar elementos duplicados; por isso, as consultas do formulário são limitadas com `within(dialog)`.
- O ambiente de preparação não disponibilizou todas as dependências npm no registry interno, impedindo a execução real do frontend.

### Validação

Foram realizadas durante a preparação:

- inspeção dos contratos de projetos do backend;
- análise sintática de todos os arquivos TypeScript e TSX;
- verificação de whitespace com `git diff --check`;
- revisão das chaves de cache, filtros e invalidações;
- criação de testes para listagem, criação, edição e arquivamento;
- confirmação de que nenhum arquivo Python ou migration foi alterado;
- revisão da separação entre `docs/etapas/etapa-06-projetos-frontend.md` e `docs/prompts/prompt-etapa-06-projetos-frontend.md`.

Não foram executados neste ambiente:

- `npm run lint`;
- `npx tsc --noEmit` com todas as dependências instaladas;
- `npm run test`;
- `npm run build`;
- validação manual no navegador contra a API real.

Nenhum resultado pendente é apresentado como aprovado.

### Resultado

A Etapa 06 foi preparada com gestão completa de projetos no frontend, estados de interface, cache remoto, formulários, filtros, paginação, navegação e testes dos fluxos principais.

A conclusão efetiva depende da aplicação do patch e da execução das validações reais pelo desenvolvedor.
`````


### `docs/CURRENT_STATE.md`

`````markdown
# Estado atual

## Concluído

- Diagnóstico e decisões iniciais documentados.
- Baseline Alembic e contrato Taskly para tarefas implementados.
- Status `cancelled`, `short_description` e `due_at` em UTC implementados.
- Testes de ownership com dois usuários adicionados.
- Repositório organizado como monorepo com `backend/`, `frontend/` e `docs/`.
- Tags relacionais por usuário e associação many-to-many implementadas.
- Anexos com storage desacoplado, ownership e limpeza física implementados.
- Endpoint de refresh token e autenticação persistente no frontend implementados.
- Correções de estabilidade dos testes Vitest da autenticação incorporadas.
- Rotas públicas e protegidas implementadas.
- Integração HTTP de projetos organizada por feature.
- Listagem paginada de projetos ativos e arquivados implementada.
- Busca de projetos por nome implementada.
- Criação e edição de projetos implementadas no frontend.
- Arquivamento, restauração e exclusão de projetos implementados no frontend.
- Estados de carregamento, erro e lista vazia implementados.
- Rota de workspace do projeto preparada para receber tarefas.
- Testes de listagem, criação, edição e arquivamento preparados.

## Em desenvolvimento

- Aplicação da Etapa 06 no repositório do desenvolvedor.
- Validação real do frontend com a API e o PostgreSQL ativos.
- Registro das saídas reais de lint, type-check, Vitest e build.

## Pendente

- Corrigir eventuais falhas encontradas na validação local da Etapa 06.
- Executar o commit da Etapa 06.
- Implementar criação e edição de tarefas no frontend.
- Implementar visualização em lista.
- Implementar kanban e drag-and-drop persistido.
- Integrar tags e anexos aos formulários do frontend.
- Consolidar testes, Docker fullstack, deploy e documentação final.

## Último commit

- Etapa 06 ainda não commitada.
- Mensagem planejada: `feat: implementa gestão de projetos no frontend`
`````


### `docs/prompts/prompt-etapa-06-projetos-frontend.md`

`````markdown
# Prompt da Etapa 06 — Projetos no frontend

## Finalidade

Registrar o uso de IA como apoio à pesquisa, comparação e revisão da implementação da gestão de projetos no frontend do Taskly.

## Contexto fornecido pelo desenvolvedor

- O repositório já está organizado em `backend/`, `frontend/` e `docs/`.
- O backend já possui CRUD de projetos com ownership, paginação, filtros, arquivamento e exclusão.
- O frontend já possui autenticação, sessão persistente, cliente HTTP e TanStack Query.
- Os testes da autenticação foram estabilizados com pool de threads, um worker, `fireEvent` e restauração dos mocks.
- A etapa deve reutilizar os endpoints existentes e não reescrever o backend sem necessidade.

## Solicitação feita à IA

> Estruture a Etapa 06 para implementar projetos no frontend. Reaproveite o CRUD existente do backend e a fundação de autenticação. Inclua listagem, busca, paginação, criação, edição, arquivamento, restauração, exclusão, estados de loading/erro/vazio, navegação para o projeto e testes dos fluxos críticos. Preserve a separação por feature e o uso do TanStack Query. Separe claramente o documento técnico em `docs/etapas/` e este registro em `docs/prompts/`. Não apresente validações como executadas sem resultado real.

## Restrições aplicadas

- Não alterar o backend se os contratos atuais forem suficientes.
- Não implementar tarefas ou kanban nesta etapa.
- Não duplicar dados remotos em estado local desnecessário.
- Não excluir projeto sem confirmação explícita.
- Não tentar refresh diante de erros de regra de negócio.
- Não declarar lint, testes ou build como aprovados sem execução no ambiente do desenvolvedor.
- Manter a IA como apoio e o desenvolvedor como responsável pelas decisões, implementação e validação.

## Resultado utilizado pelo desenvolvedor

O material de apoio foi usado para organizar:

- contratos e tipos do frontend;
- chaves de cache e mutations;
- componentes de card e formulário;
- filtros, paginação e estados de interface;
- navegação para o workspace do projeto;
- cenários de teste dos fluxos principais;
- documentação e comandos de validação.

O desenvolvedor permanece responsável por revisar, adaptar, executar e aceitar a implementação no repositório real.
`````


## 6. Comandos de validação

### 6.1. Raiz do repositório

A raiz do repositório é a pasta que contém `backend/`, `frontend/`, `docs/` e `docker-compose.yml`.

```powershell
cd "C:\Users\Daniel Hara\Documents\Projetos\taskly-fullstack-UEX"
git status --short
git diff --check
```

### 6.2. Raiz do frontend

```powershell
cd frontend
npm install
npm run lint
npx tsc --noEmit
npm run test
npm run build
```

Para executar somente os testes desta etapa:

```powershell
npx vitest run src/features/projects/pages/ProjectsPage.test.tsx `
  --pool=threads `
  --no-file-parallelism `
  --reporter=verbose
```

### 6.3. Validação manual

Com backend e PostgreSQL ativos:

```powershell
npm run dev
```

Validar no navegador:

1. entrar com um usuário;
2. confirmar o estado vazio quando não houver projetos;
3. criar um projeto com e sem descrição;
4. editar nome e descrição;
5. pesquisar pelo nome;
6. alternar entre ativos e arquivados;
7. arquivar e restaurar;
8. excluir após a confirmação;
9. criar quantidade suficiente para validar paginação;
10. abrir `/app/projects/{id}` e voltar à listagem;
11. repetir os fluxos com a API indisponível para conferir erros.

### 6.4. Backend

Esta etapa não altera Python. Ruff, pytest e Alembic não são validações obrigatórias da alteração, mas podem ser executados como regressão:

```powershell
cd ..\backend
..\.venv\Scripts\Activate.ps1
ruff check .
ruff format . --check
python -m pytest
```

Não registrar os resultados antes da execução real.

## 7. Passo a passo do commit

Execute a partir da raiz do repositório:

```powershell
# 1. Conferir todas as mudanças
git status

# 2. Adicionar os arquivos da feature e a documentação
git add frontend/src/App.tsx
git add frontend/src/routes/AppShell.tsx
git add frontend/src/routes/DashboardPage.tsx
git add frontend/src/styles.css
git add frontend/src/features/projects
git add docs/AI_USAGE.md
git add docs/CURRENT_STATE.md
git add docs/prompts/prompt-etapa-06-projetos-frontend.md
git add docs/etapas/etapa-06-projetos-frontend.md

# 3. Revisar exatamente o conteúdo preparado
git diff --cached
git status

# 4. Executar as validações do frontend
cd frontend
npm run lint
npx tsc --noEmit
npm run test
npm run build
cd ..

# 5. Criar o commit semântico
git commit -m "feat: implementa gestão de projetos no frontend"

# 6. Enviar ao remoto
git push origin main
```

O caminho removido `frontend/src/routes/DashboardPage.tsx` deve ser incluído no stage para que a exclusão seja registrada.

## 8. Problemas comuns e como resolver

### Lista retorna erro 401 ou redireciona para login

**Causa provável:** tokens ausentes, expirados ou URL da API incorreta.
**Correção:** confira `frontend/.env`, a sessão no Local Storage e o endpoint `/auth/me`.

### Erro de CORS no navegador

**Causa provável:** `http://localhost:5173` não está permitido no backend.
**Correção:** confira `CORS_ORIGINS` em `backend/.env` e reinicie a API.

### Lista não atualiza depois de uma mutation

**Causa provável:** alteração local diferente do patch ou invalidação removida.
**Correção:** confira `useRefreshProjectQueries()` e `useDeleteProject()` em `hooks.ts`.

### Pesquisa vazia gera erro 422

A implementação não envia `search` quando o valor está vazio. Se o erro surgir, confira se `searchInput.trim()` permanece aplicado antes de atualizar o filtro.

### Teste encontra mais de um botão “Criar projeto”

Quando o diálogo está aberto, o botão do estado vazio continua no DOM. Use:

```tsx
const dialog = screen.getByRole('dialog')
within(dialog).getByRole('button', { name: 'Criar projeto' })
```

### Vitest não inicia worker no Windows

Mantenha em `vite.config.ts`:

```typescript
pool: 'threads',
fileParallelism: false,
maxWorkers: 1,
testTimeout: 10_000,
```

### Arquivamento retorna 403

Um `403` de regra de negócio não deve disparar refresh automático. Confira o detalhe retornado pela API e não altere o cliente para renovar token em todo `403`.

### Exclusão não aparece após confirmação

Confirme se `window.confirm` foi aceito e se a API respondeu `204`. Depois verifique a invalidação da lista no TanStack Query.

### `npm install` altera o lockfile

Revise `frontend/package-lock.json` e confirme que as mudanças são compatíveis com o `package.json` antes de incluí-las no commit.

## 9. Checklist do que foi concluído

- [x] Contratos TypeScript de projetos criados.
- [x] Funções HTTP criadas.
- [x] Chaves de cache hierárquicas implementadas.
- [x] Queries de lista e detalhe implementadas.
- [x] Mutations de criar, editar, arquivar, restaurar e excluir implementadas.
- [x] Busca por nome implementada.
- [x] Filtro de ativos e arquivados implementado.
- [x] Paginação implementada.
- [x] Formulário reutilizável de criação e edição implementado.
- [x] Confirmação de exclusão implementada.
- [x] Estados de loading, erro e vazio implementados.
- [x] Layout responsivo implementado.
- [x] Rota de workspace do projeto criada.
- [x] Testes de listagem, criação, edição e arquivamento preparados.
- [x] Documento técnico separado do prompt.
- [x] `AI_USAGE.md` atualizado.
- [x] `CURRENT_STATE.md` atualizado.
- [x] `DECISIONS.md` mantido sem atualização artificial.
- [ ] Lint executado no ambiente do desenvolvedor.
- [ ] Type-check executado no ambiente do desenvolvedor.
- [ ] Vitest executado no ambiente do desenvolvedor.
- [ ] Build executado no ambiente do desenvolvedor.
- [ ] Fluxos manuais validados contra a API real.
- [ ] Commit executado pelo desenvolvedor.

## 10. Próxima etapa

**Etapa 07 — Lista de tarefas e formulário completo**

A próxima etapa deverá:

1. carregar todas as tarefas do projeto;
2. criar e editar título, descrição curta, descrição completa, prazo, prioridade e status;
3. exibir tarefas em lista;
4. aplicar estados de loading, erro e vazio;
5. respeitar projetos arquivados como somente leitura;
6. preparar a alternância entre lista e kanban;
7. atualizar os documentos e registrar resultados reais.
