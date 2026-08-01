# Etapa 10 — Testes e estabilização

## 1. Objetivo

Ampliar a proteção contra regressões, consolidar as correções encontradas nas
validações locais e tornar a verificação do projeto reproduzível antes do
deploy. Esta etapa não cria funcionalidades de produto.

## 2. O que foi feito e por quê

### Backend

- adicionados testes da head Alembic e da revision realmente aplicada;
- inspecionado o schema criado pelas migrations;
- protegidos campos obrigatórios, timezone, constraints e cascades;
- validados os valores públicos dos enums PostgreSQL;
- ampliado o fluxo integrado para incluir tags, upload, download, mudança de
  status, arquivamento e modo somente leitura;
- habilitado relatório de cobertura na CI sem impor limite ainda não medido.

### Frontend

- adicionado teste da página de cadastro;
- adicionado teste da sincronização da barra horizontal superior;
- protegido o comportamento somente leitura do kanban arquivado;
- mantida a configuração serial do Vitest usada para estabilizar o Windows;
- criado `npm run check` para lint, TypeScript, testes e build;
- ajustada a CI para instalar exatamente o `package-lock.json` com `npm ci`.

### Repositório

- criados scripts de validação para PowerShell e shell;
- criado `docs/VALIDATION.md`;
- atualizados README, `AI_USAGE.md` e `CURRENT_STATE.md`.

## 3. Decisões técnicas

### Testar migrations reais em vez de apenas metadata

Os testes continuam executando `alembic upgrade head` em banco vazio. A nova
cobertura verifica também a revision registrada, tabelas, constraints, cascades
e enums. Isso detecta diferenças que `Base.metadata.create_all()` ocultaria.

### Não estabelecer cobertura mínima sem linha de base

A CI gera o relatório de cobertura, mas não falha por percentual nesta etapa.
Um limite arbitrário poderia bloquear o case sem indicar risco real. O valor
poderá ser definido depois de medir a suíte completa.

### Usar `npm ci` na CI

A instalação da integração contínua deve reproduzir o lockfile. Por isso,
`frontend/package-lock.json` passa a ser requisito do commit.

### Não aplicar correção forçada do npm

As duas vulnerabilidades precisam ser classificadas. Atualizações major não
serão aplicadas automaticamente com `--force`.

Não houve nova decisão arquitetural de produto; por isso `DECISIONS.md` não foi
alterado.

## 4. Dependências e ordem

1. aplicar o patch na raiz;
2. confirmar que `frontend/package-lock.json` está versionado;
3. subir o PostgreSQL e criar o banco exclusivo de testes;
4. executar as migrations;
5. rodar o script consolidado;
6. executar a regressão manual;
7. analisar `npm audit`;
8. registrar as saídas reais;
9. commitar somente após aprovação.

## 5. Arquivos criados ou alterados

### Criados

- `backend/app/tests/test_migrations.py`;
- `frontend/src/features/auth/pages/RegisterPage.test.tsx`;
- `frontend/src/features/tasks/components/KanbanBoard.test.tsx`;
- `scripts/validate.ps1`;
- `scripts/validate.sh`;
- `docs/VALIDATION.md`;
- `docs/etapas/etapa-10-testes.md`;
- `docs/prompts/prompt-etapa-10-testes.md`.

### Alterados

- `backend/app/tests/test_full_flow.py`;
- `.github/workflows/ci.yml`;
- `frontend/package.json`;
- `README.md`;
- `frontend/README.md`;
- `docs/AI_USAGE.md`;
- `docs/CURRENT_STATE.md`.

## 6. Conteúdo completo dos arquivos criados ou alterados

O conteúdo deste próprio documento não é reproduzido recursivamente. Os demais
arquivos da etapa são apresentados abaixo como referência integral.

### `.github/workflows/ci.yml`

~~~~yaml
name: Taskly Backend CI

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  backend-lint-and-test:
    name: Backend lint and test
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: projects_api_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd="pg_isready -U postgres -d projects_api_test"
          --health-interval=5s
          --health-timeout=5s
          --health-retries=10

    env:
      APP_NAME: "Taskly API"
      APP_ENV: "test"
      APP_DEBUG: "false"
      APP_VERSION: "0.1.0"
      DATABASE_URL: "postgresql+psycopg://postgres:postgres@localhost:5432/projects_api_test"
      TEST_DATABASE_URL: "postgresql+psycopg://postgres:postgres@localhost:5432/projects_api_test"
      JWT_SECRET_KEY: "test-secret-key-for-ci"
      JWT_ALGORITHM: "HS256"
      ACCESS_TOKEN_EXPIRE_MINUTES: "30"
      REFRESH_TOKEN_EXPIRE_DAYS: "7"
      CORS_ORIGINS: "http://localhost:5173,http://localhost:8000"

    defaults:
      run:
        working-directory: backend

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Cache pip dependencies
        uses: actions/cache@v4
        with:
          path: ~/.cache/pip
          key: pip-${{ runner.os }}-${{ hashFiles('backend/pyproject.toml') }}
          restore-keys: |
            pip-${{ runner.os }}-

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -e ".[dev]"

      - name: Run Ruff lint
        run: ruff check .

      - name: Check Ruff formatting
        run: ruff format . --check

      - name: Run tests
        run: python -m pytest --cov=app --cov-report=term-missing

  frontend-lint-test-build:
    name: Frontend lint, test and build
    runs-on: ubuntu-latest

    defaults:
      run:
        working-directory: frontend

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Install locked dependencies
        run: npm ci

      - name: Run frontend validation
        run: npm run check
~~~~

### `README.md`

~~~~markdown
# Taskly Fullstack

Repositório do case técnico Taskly, organizado como monorepo para manter backend, frontend e documentação no mesmo histórico Git.

## Estrutura atual

```text
taskly-fullstack-UEX/
├── backend/          # FastAPI, SQLAlchemy, Alembic e pytest
├── frontend/         # React, Vite, TypeScript e produto web
├── docs/             # etapas, decisões, estado atual e uso de IA
├── .github/          # CI do repositório
├── docker-compose.yml
└── README.md
```

## Diretórios de execução

### Raiz do repositório

Use para Git e Docker Compose:

```powershell
cd "C:\Users\Daniel Hara\Documents\Projetos\taskly-fullstack-UEX"
git status
docker compose up -d
```

### Raiz do backend

Use para Alembic, Ruff e pytest:

```powershell
cd backend
alembic upgrade head
ruff check .
ruff format . --check
python -m pytest
```

### Raiz do frontend

Use para npm, TypeScript, ESLint e Vitest:

```powershell
cd frontend
npm install
npm run dev
npm run lint
npx tsc --noEmit
npm run test
```

## Estado funcional

O backend possui autenticação, refresh token, projetos, tarefas, ownership, prazos em UTC, tags relacionais e anexos.

O frontend possui autenticação persistente, gestão de projetos, lista e kanban de tarefas, drag-and-drop persistido, autocomplete de tags e gestão autenticada de anexos com upload, download e exclusão.


## Validação consolidada

Com as dependências já instaladas, execute na raiz do repositório:

```powershell
.\scripts\validate.ps1
```

Para instalar novamente as dependências bloqueadas antes da validação:

```powershell
.\scripts\validate.ps1 -InstallDependencies
```

Em Linux ou macOS:

```bash
./scripts/validate.sh
```

O frontend utiliza `npm ci` na integração contínua. Portanto,
`frontend/package-lock.json` deve permanecer versionado e sincronizado com o
`package.json`. O relatório de `npm audit` deve ser analisado antes de qualquer
uso de `npm audit fix --force`, pois a opção pode introduzir versões
incompatíveis.
~~~~

### `backend/app/tests/test_full_flow.py`

~~~~python
from fastapi.testclient import TestClient


def test_full_user_project_task_flow(client: TestClient) -> None:
    """Cobre autenticação, tags, anexos, status e arquivamento em conjunto."""
    user_payload = {
        "name": "Ana Silva",
        "email": "ana.flow@example.com",
        "password": "StrongPassword123",
    }

    register_response = client.post("/api/v1/auth/register", json=user_payload)
    assert register_response.status_code == 201

    login_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": user_payload["email"],
            "password": user_payload["password"],
        },
    )
    assert login_response.status_code == 200

    access_token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    me_response = client.get("/api/v1/auth/me", headers=headers)
    assert me_response.status_code == 200
    assert me_response.json()["user"]["email"] == user_payload["email"]

    project_response = client.post(
        "/api/v1/projects",
        json={
            "name": "Portfolio API",
            "description": "Full flow test project.",
        },
        headers=headers,
    )
    assert project_response.status_code == 201

    project_id = project_response.json()["id"]
    task_response = client.post(
        "/api/v1/tasks",
        json={
            "project_id": project_id,
            "title": "Create full flow test",
            "short_description": "Validate the complete backend flow.",
            "description": "Ensure the main Taskly backend flow works.",
            "priority": "high",
            "due_at": "2026-06-15T21:30:00Z",
            "tags": ["Backend", "Release"],
        },
        headers=headers,
    )
    assert task_response.status_code == 201

    task_data = task_response.json()
    task_id = task_data["id"]
    assert task_data["project_id"] == project_id
    assert [tag["name"] for tag in task_data["tags"]] == [
        "Backend",
        "Release",
    ]

    upload_response = client.post(
        f"/api/v1/tasks/{task_id}/attachments",
        files={
            "file": (
                "evidence.pdf",
                b"%PDF-1.4\nTaskly integration evidence",
                "application/pdf",
            )
        },
        headers=headers,
    )
    assert upload_response.status_code == 201
    attachment = upload_response.json()

    update_response = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"status": "done"},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "done"
    assert len(update_response.json()["attachments"]) == 1

    tasks_response = client.get(
        f"/api/v1/tasks?project_id={project_id}",
        headers=headers,
    )
    assert tasks_response.status_code == 200
    assert tasks_response.json()["total"] == 1
    assert tasks_response.json()["items"][0]["status"] == "done"

    download_response = client.get(attachment["url"], headers=headers)
    assert download_response.status_code == 200
    assert download_response.content.startswith(b"%PDF-")

    archive_response = client.patch(
        f"/api/v1/projects/{project_id}/archive",
        headers=headers,
    )
    assert archive_response.status_code == 200
    assert archive_response.json()["status"] == "archived"

    blocked_update = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"status": "cancelled"},
        headers=headers,
    )
    assert blocked_update.status_code == 400
    assert blocked_update.json()["detail"] == (
        "Cannot modify tasks in archived projects"
    )

    read_only_task = client.get(f"/api/v1/tasks/{task_id}", headers=headers)
    assert read_only_task.status_code == 200

    read_only_download = client.get(attachment["url"], headers=headers)
    assert read_only_download.status_code == 200
~~~~

### `backend/app/tests/test_migrations.py`

~~~~python
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def test_database_is_at_the_single_alembic_head(db_session: Session) -> None:
    """Garante que a suíte está validando exatamente a revision de deploy."""
    config = Config(BACKEND_ROOT / "alembic.ini")
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    script = ScriptDirectory.from_config(config)

    assert script.get_heads() == ["0004_add_attachments"]

    current_revision = db_session.execute(
        text("SELECT version_num FROM alembic_version")
    ).scalar_one()

    assert current_revision == script.get_current_head()


def test_migrated_schema_contains_taskly_relations_and_constraints(
    db_session: Session,
) -> None:
    """Detecta divergências entre models e a estrutura criada pelo Alembic."""
    inspector = inspect(db_session.get_bind())
    expected_tables = {
        "alembic_version",
        "attachments",
        "projects",
        "tags",
        "task_tags",
        "tasks",
        "users",
    }

    assert expected_tables.issubset(set(inspector.get_table_names()))

    task_columns = {
        column["name"]: column for column in inspector.get_columns("tasks")
    }
    assert {
        "short_description",
        "description",
        "due_at",
        "priority",
        "status",
    }.issubset(task_columns)
    assert task_columns["short_description"]["nullable"] is False
    assert getattr(task_columns["due_at"]["type"], "timezone", False) is True

    tag_unique_constraints = {
        tuple(constraint["column_names"])
        for constraint in inspector.get_unique_constraints("tags")
    }
    assert ("owner_id", "normalized_name") in tag_unique_constraints

    attachment_foreign_keys = inspector.get_foreign_keys("attachments")
    task_foreign_key = next(
        foreign_key
        for foreign_key in attachment_foreign_keys
        if foreign_key["constrained_columns"] == ["task_id"]
    )
    assert task_foreign_key["referred_table"] == "tasks"
    assert task_foreign_key.get("options", {}).get("ondelete") == "CASCADE"


def test_postgresql_enums_expose_the_public_api_values(
    db_session: Session,
) -> None:
    """Impede regressão para nomes internos como TODO ou IN_PROGRESS."""
    rows = db_session.execute(
        text(
            """
            SELECT type.typname,
                   array_agg(enum.enumlabel ORDER BY enum.enumsortorder) AS labels
            FROM pg_type AS type
            JOIN pg_enum AS enum ON enum.enumtypid = type.oid
            WHERE type.typname IN ('project_status', 'task_priority', 'task_status')
            GROUP BY type.typname
            """
        )
    ).mappings()

    values = {row["typname"]: list(row["labels"]) for row in rows}

    assert values == {
        "project_status": ["active", "archived"],
        "task_priority": ["low", "medium", "high"],
        "task_status": ["todo", "in_progress", "done", "cancelled"],
    }
~~~~

### `frontend/README.md`

~~~~markdown
# Taskly Frontend

Frontend do Taskly desenvolvido com React, Vite e TypeScript.

## Stack

- React e React Router;
- TanStack Query para estado remoto e rollback de mutations;
- dnd-kit para drag-and-drop do kanban;
- React Hook Form e Zod para formulários;
- Vitest e Testing Library para testes;
- ESLint e TypeScript em modo estrito.

## Configuração

Copie o arquivo de ambiente:

```powershell
Copy-Item .env.example .env
```

Valor padrão:

```env
VITE_API_URL="http://localhost:8000/api/v1"
```

## Execução

Na raiz `frontend/`:

```powershell
npm install
npm run dev
```

A aplicação fica disponível em `http://localhost:5173`.

## Validação

```powershell
npm run check
```

## Fluxos disponíveis

- registro de usuário;
- login por e-mail e senha;
- persistência local da sessão;
- renovação automática do access token;
- validação da sessão por `GET /auth/me`;
- rotas públicas e protegidas;
- logout;
- gestão de projetos;
- lista paginada de tarefas;
- criação, edição, exclusão e atualização de status de tarefas;
- filtros por status, prioridade e busca;
- prazo com conversão entre horário local e UTC;
- tags com autocomplete, criação de novos nomes e exibição na lista e no kanban;
- toggle entre lista e kanban;
- carregamento completo das páginas no quadro;
- drag-and-drop de status com atualização otimista e rollback;
- anexos autenticados com upload, listagem, download e exclusão;
- consulta de anexos preservada em projetos arquivados, sem permitir alterações.

O armazenamento em `localStorage` é um trade-off consciente do case. Para um
produto real, a evolução recomendada é adotar cookies HttpOnly e proteção CSRF.

O comando `npm run check` executa ESLint, TypeScript, Vitest em um único
worker e o build de produção. A configuração serial reduz instabilidades de
workers observadas no Windows sem alterar o comportamento da aplicação.
~~~~

### `frontend/package.json`

~~~~json
{
  "name": "taskly-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ci": "vitest run --pool=threads --no-file-parallelism --reporter=verbose",
    "check": "npm run lint && tsc --noEmit && npm run test:ci && npm run build"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@hookform/resolvers": "^5.2.1",
    "@tanstack/react-query": "^5.101.4",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "react-hook-form": "^7.82.0",
    "react-router-dom": "^7.18.1",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^24.10.1",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.4",
    "eslint": "^9.39.1",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24",
    "globals": "^16.5.0",
    "jsdom": "^27.2.0",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.48.0",
    "vite": "^8.1.5",
    "vitest": "^4.1.10"
  },
  "engines": {
    "node": ">=20.19.0"
  }
}
~~~~

### `frontend/src/features/auth/pages/RegisterPage.test.tsx`

~~~~tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../AuthProvider'
import { RegisterPage } from './RegisterPage'

function renderRegisterPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/app" element={<h1>Projetos</h1>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('RegisterPage', () => {
  it('rejects different passwords without sending a request', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch')
    renderRegisterPage()

    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Ana Silva' },
    })
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'ana@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'StrongPassword123' },
    })
    fireEvent.change(screen.getByLabelText('Confirmar senha'), {
      target: { value: 'DifferentPassword123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(
      await screen.findByText('As senhas precisam ser iguais.'),
    ).toBeVisible()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('registers, authenticates and opens the protected application', async () => {
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'user-1',
            name: 'Ana Silva',
            email: 'ana@example.com',
            is_active: true,
            created_at: '2026-08-01T12:00:00Z',
            updated_at: '2026-08-01T12:00:00Z',
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            token_type: 'bearer',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: {
              id: 'user-1',
              name: 'Ana Silva',
              email: 'ana@example.com',
              is_active: true,
              created_at: '2026-08-01T12:00:00Z',
              updated_at: '2026-08-01T12:00:00Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )

    renderRegisterPage()

    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Ana Silva' },
    })
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'ana@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'StrongPassword123' },
    })
    fireEvent.change(screen.getByLabelText('Confirmar senha'), {
      target: { value: 'StrongPassword123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(
      await screen.findByRole('heading', { name: 'Projetos' }),
    ).toBeVisible()
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(window.localStorage.getItem('taskly.auth.tokens')).toContain(
      'refresh-token',
    )
  })
})
~~~~

### `frontend/src/features/tasks/components/KanbanBoard.test.tsx`

~~~~tsx
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
~~~~

### `scripts/validate.ps1`

~~~~powershell
param(
    [switch]$InstallDependencies
)

$ErrorActionPreference = "Stop"
$RepositoryRoot = Split-Path -Parent $PSScriptRoot

Write-Host "Validando backend..." -ForegroundColor Cyan
Push-Location (Join-Path $RepositoryRoot "backend")
try {
    if ($InstallDependencies) {
        python -m pip install -e ".[dev]"
    }

    python -m ruff check .
    python -m ruff format . --check
    python -m pytest --cov=app --cov-report=term-missing
}
finally {
    Pop-Location
}

Write-Host "Validando frontend..." -ForegroundColor Cyan
Push-Location (Join-Path $RepositoryRoot "frontend")
try {
    if ($InstallDependencies) {
        npm ci
    }

    npm run check
}
finally {
    Pop-Location
}

Write-Host "Validação concluída sem erros." -ForegroundColor Green
~~~~

### `scripts/validate.sh`

~~~~bash
#!/usr/bin/env sh
set -eu

REPOSITORY_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

if [ "${INSTALL_DEPENDENCIES:-0}" = "1" ]; then
  (
    cd "$REPOSITORY_ROOT/backend"
    python -m pip install -e ".[dev]"
  )
  (
    cd "$REPOSITORY_ROOT/frontend"
    npm ci
  )
fi

(
  cd "$REPOSITORY_ROOT/backend"
  python -m ruff check .
  python -m ruff format . --check
  python -m pytest --cov=app --cov-report=term-missing
)

(
  cd "$REPOSITORY_ROOT/frontend"
  npm run check
)

printf '%s\n' "Validação concluída sem erros."
~~~~

### `docs/VALIDATION.md`

~~~~markdown
# Validação do Taskly

## Objetivo

Centralizar os comandos, evidências e critérios de aceite usados antes do
deploy. Um item somente deve ser marcado como aprovado depois de sua execução
real no ambiente do desenvolvedor ou na CI.

## Comando consolidado

Na raiz do repositório, em PowerShell:

```powershell
.\scripts\validate.ps1
```

A primeira instalação ou uma reinstalação controlada pode ser feita com:

```powershell
.\scripts\validate.ps1 -InstallDependencies
```

## Backend

```powershell
cd backend
alembic heads
alembic current
alembic upgrade head
python -m ruff check .
python -m ruff format . --check
python -m pytest --cov=app --cov-report=term-missing
```

Critérios de aceite:

- uma única head Alembic: `0004_add_attachments`;
- migrations aplicáveis em banco PostgreSQL vazio;
- schema contém usuários, projetos, tarefas, tags, associação e anexos;
- enums persistem os valores públicos minúsculos;
- ownership retorna `404` para recursos de outra conta;
- projetos arquivados permanecem consultáveis e bloqueiam mutações;
- arquivos físicos são removidos junto com anexos, tarefas e projetos;
- Ruff e pytest finalizam sem erro.

## Frontend

```powershell
cd frontend
npm ci
npm run check
```

Critérios de aceite:

- ESLint sem erro;
- TypeScript sem erro;
- todos os testes Vitest aprovados;
- build de produção concluído;
- cadastro, login, refresh e logout funcionais;
- projetos e tarefas preservam as alterações após recarregar;
- kanban carrega todas as páginas e restaura o card após falha da API;
- barra superior movimenta horizontalmente o quadro em largura reduzida;
- anexos podem ser enviados, baixados e excluídos em projeto ativo;
- projeto arquivado permite consulta e download, mas não mutações.

## Evidências disponíveis até a preparação da Etapa 10

O desenvolvedor apresentou uma execução em que:

- ESLint foi concluído sem erro;
- `tsc --noEmit` foi concluído sem erro;
- o build Vite foi concluído;
- 24 de 25 testes frontend foram aprovados;
- a falha restante foi isolada no mock de conteúdo binário do `jsdom`;
- o mock foi corrigido para usar corpo textual convertido por `response.blob()`.

A execução integral posterior à correção ainda deve ser registrada com a saída
real. Este documento não presume aprovação sem essa evidência.

## Auditoria de dependências

A instalação informou duas vulnerabilidades de severidade alta. Antes do
deploy, execute:

```powershell
npm audit
npm audit --omit=dev
npm audit fix --dry-run
```

Não use `npm audit fix --force` automaticamente. Classifique se a dependência
afeta o bundle de produção, a ferramenta de desenvolvimento ou um caminho não
alcançável e registre a decisão no relatório final.

## Validação manual de regressão

1. Criar conta e confirmar redirecionamento para `/app`.
2. Atualizar a página e confirmar persistência da sessão.
3. Sair, entrar novamente e testar credenciais inválidas.
4. Criar, editar, arquivar, restaurar e excluir projeto.
5. Criar tarefa com prazo, tags e descrições.
6. Alterar status na lista e pelo kanban.
7. Desligar a API, mover um card e confirmar rollback.
8. Testar a barra horizontal superior em largura reduzida.
9. Enviar imagem e PDF, baixar e excluir os arquivos.
10. Arquivar o projeto e confirmar o modo somente leitura.
11. Inspecionar Network e Local Storage e confirmar que senhas não são
    persistidas.
12. Reduzir temporariamente a validade do access token e confirmar o refresh.
~~~~

### `docs/AI_USAGE.md`

~~~~markdown
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

## Etapa 07 - Lista de tarefas e formulário completo

### Objetivo

Implementar a visualização em lista das tarefas de um projeto e os fluxos de criação, edição, exclusão, atualização de status, filtros, prazo e tags no frontend.

### Uso da IA

A IA foi utilizada como ferramenta de apoio para:

- revisar o contrato existente dos endpoints de tarefas;
- comparar formas de representar filtros, paginação e mutations no TanStack Query;
- sugerir a conversão explícita entre o campo `datetime-local` do navegador e o contrato UTC da API;
- levantar riscos de estado inconsistente quando uma mutation remove o último item da página atual;
- organizar o formulário com React Hook Form e Zod;
- revisar estados de carregamento, erro, vazio e somente leitura;
- estruturar cenários de teste para listagem, criação, mudança de status e projeto arquivado;
- revisar a separação entre a lista desta etapa e o kanban da etapa seguinte.

A ferramenta atuou como apoio de pesquisa, comparação e revisão. A definição da experiência, a implementação, as adaptações ao código real, a execução das validações e a responsabilidade técnica permanecem com o desenvolvedor.

### Sugestão inicial

A análise assistida sugeriu:

- criar uma feature `tasks` com tipos, cliente HTTP, hooks e componentes próprios;
- manter os dados remotos no TanStack Query, sem duplicar a lista em estado local;
- usar o endpoint paginado existente, filtrando sempre pelo projeto aberto;
- disponibilizar alteração rápida de status diretamente na lista;
- reutilizar um único formulário para criação e edição;
- aceitar tags separadas por vírgula nesta etapa, deixando autocomplete e gestão de anexos para a Etapa 09;
- converter o prazo local para ISO UTC antes do envio e fazer a conversão inversa na edição;
- bloquear mutations na interface quando o projeto estiver arquivado;
- corrigir a paginação no próprio fluxo da mutation, sem `setState` síncrono dentro de `useEffect`.

### Decisão do desenvolvedor

O desenvolvedor decidiu:

- preservar integralmente o backend nesta etapa, pois o contrato atual já atende à lista e ao formulário;
- implementar lista paginada com busca, status e prioridade;
- exibir título, descrições, status, prioridade, prazo, tags e quantidade de anexos;
- permitir mudança de status diretamente em cada item;
- manter anexos apenas como contador nesta etapa e implementar upload/download na Etapa 09;
- incluir o botão de kanban desabilitado somente como indicação da próxima entrega;
- tratar projetos arquivados como somente leitura também na interface;
- incorporar como baseline as correções realizadas após a Etapa 06 em `ProjectsPage.tsx`, `styles.css` e `App.tsx`;
- não adicionar entrada ao `DECISIONS.md`, porque as decisões de UTC, tags e projeto arquivado já estavam registradas.

### Alterações humanas

Cabe ao desenvolvedor:

- aplicar o patch sobre o repositório já corrigido da Etapa 06;
- revisar os textos e o layout no navegador;
- validar o horário exibido no fuso local e o valor UTC enviado à API;
- testar criação, edição, filtros, mudança de status e exclusão com dados reais;
- executar ESLint, TypeScript, Vitest e build;
- revisar e ajustar os testes caso o ambiente local tenha particularidades;
- realizar o commit somente após as validações reais.

### Problemas identificados

- `datetime-local` não inclui timezone; enviar seu valor diretamente quebraria o contrato UTC da API.
- Alterar o status de uma tarefa pode removê-la da lista quando existe filtro por status.
- Excluir o último item de uma página pode deixar o usuário em uma página vazia.
- Um formulário de tags sem normalização permitiria duplicatas por caixa e espaços.
- Mutations em projeto arquivado devem ser bloqueadas na interface, mas o backend continua sendo a proteção autoritativa.
- O kanban não deve ser antecipado sem drag-and-drop persistido e rollback, previstos para a Etapa 08.
- O ambiente de preparação não disponibilizou as dependências npm no registry interno.

### Validação

Foram realizadas durante a preparação:

- inspeção dos schemas e endpoints reais de tarefas;
- análise sintática dos arquivos TypeScript e TSX com o compilador TypeScript disponível no ambiente;
- verificação de whitespace com `git diff --check`;
- revisão da conversão entre horário local e UTC;
- revisão das chaves de cache e invalidações do TanStack Query;
- criação de testes para listagem, criação, atualização de status e modo somente leitura;
- confirmação de que nenhum arquivo Python ou migration foi alterado;
- revisão da separação entre `docs/etapas/etapa-07-lista-tarefas.md` e `docs/prompts/prompt-etapa-07-lista-tarefas.md`.

Não foram executados neste ambiente:

- `npm run lint`;
- `npx tsc --noEmit` com as dependências instaladas;
- `npm run test`;
- `npm run build`;
- validação manual no navegador com a API real.

Nenhum resultado pendente é apresentado como aprovado.

### Resultado

A Etapa 07 foi preparada com lista de tarefas, formulário completo, filtros, paginação, mudança rápida de status, prazo UTC, tags básicas, modo somente leitura e testes dos fluxos críticos.

A conclusão efetiva depende da aplicação do patch e das validações reais executadas pelo desenvolvedor.

---

## Etapa 08 - Kanban e drag-and-drop persistido

### Objetivo

Implementar a visualização kanban das tarefas, permitir a mudança de status por drag-and-drop e garantir consistência visual quando a persistência na API falhar.

### Uso da IA

A IA foi utilizada como ferramenta de apoio para:

- pesquisar a composição recomendada de `DndContext`, sensores, elementos draggable e áreas droppable;
- comparar um kanban baseado em ordenação com um quadro baseado somente em mudança de status;
- sugerir uma estratégia para carregar todas as páginas sem criar endpoint novo;
- levantar alternativas de atualização otimista e rollback com TanStack Query;
- revisar a separação entre componentes visuais, consulta completa e mutation de status;
- propor cenários de teste para paginação acumulada, persistência e restauração do cache;
- organizar a documentação e os comandos de validação.

A ferramenta não definiu autonomamente a implementação final. O desenvolvedor permaneceu responsável pela seleção da abordagem, integração com o código existente, ajustes de interface e validação no ambiente real.

### Sugestão inicial

A análise assistida apresentou duas alternativas:

1. usar `@dnd-kit/sortable` e manter ordenação interna nas colunas;
2. usar os primitives de `@dnd-kit/core`, tratando cada tarefa como draggable e cada status como droppable.

Também foi sugerido:

- manter o backend inalterado, pois `PATCH /tasks/{id}` já persiste o status;
- buscar páginas de cem itens até atingir `pages`;
- manter lista paginada e kanban completo como queries diferentes;
- atualizar os caches antes da resposta da API;
- salvar snapshots e restaurá-los em `onError`;
- disponibilizar um `select` como alternativa acessível ao arraste;
- usar handle focável e sensor de teclado.

### Decisão do desenvolvedor

O desenvolvedor decidiu:

- utilizar apenas `@dnd-kit/core`, pois o domínio não persiste ordem manual entre tarefas;
- modelar as quatro colunas como destinos de status;
- manter a ordenação recebida da API dentro de cada coluna;
- carregar todas as páginas por chamadas sucessivas ao endpoint existente, com tamanho máximo de cem itens;
- preservar prioridade e busca no kanban, removendo somente o filtro de status ao entrar no quadro;
- aplicar atualização otimista nos caches de lista, kanban e detalhe;
- restaurar exatamente os snapshots anteriores quando o PATCH falhar;
- invalidar as queries ao final para confirmar o estado autoritativo do backend;
- manter seleção de status como alternativa acessível e útil em dispositivos sem drag-and-drop preciso;
- bloquear drag, edição, exclusão e mudança de status em projetos arquivados;
- não alterar o backend ou criar migration nesta etapa.

### Alterações humanas

Cabe ao desenvolvedor:

- aplicar o patch sobre o estado real corrigido da Etapa 07;
- executar `npm install` e versionar o `package-lock.json` atualizado;
- verificar o comportamento do drag com mouse, toque e teclado;
- revisar a experiência responsiva do quadro no navegador;
- executar lint, type-check, testes e build;
- adaptar qualquer diferença provocada por alterações locais;
- decidir a aceitação e realizar o commit.

### Problemas identificados

- Uma listagem paginada comum poderia ocultar tarefas no kanban.
- O filtro de status não pode permanecer ativo no quadro, pois eliminaria colunas inteiras.
- Uma mudança apenas visual poderia divergir do PostgreSQL após falha de rede ou regra de negócio.
- Copiar os dados para estado local criaria duas fontes de verdade em relação ao TanStack Query.
- Ordenação com `sortable` introduziria uma semântica que o backend não persiste.
- O ambiente de preparação não disponibilizou `@dnd-kit/core` no registry npm interno.
- A validação real do drag depende do navegador e não pode ser substituída apenas por testes em jsdom.

### Validação

Durante a preparação foram executadas:

- análise sintática dos arquivos TypeScript e TSX pelo parser do TypeScript;
- verificação de equilíbrio das chaves CSS;
- `git diff --check`;
- inspeção do fluxo de consulta acumulada;
- inspeção do snapshot e rollback dos caches;
- aplicação limpa do patch em uma cópia do estado-base da Etapa 07.

Não foram executados neste ambiente:

- `npm install`, devido à indisponibilidade de `@dnd-kit/core` no registry interno;
- ESLint;
- type-check completo com dependências instaladas;
- Vitest;
- build do Vite;
- validação do drag no navegador.

Essas validações permanecem obrigatórias no ambiente do desenvolvedor. Nenhum resultado pendente é apresentado como aprovado.

### Resultado

A Etapa 08 foi preparada com toggle funcional, quadro completo, quatro colunas, drag-and-drop, persistência do status, atualização otimista, rollback, alternativa acessível e testes dos comportamentos críticos.

A etapa somente deve ser considerada concluída após aplicação e validação real pelo desenvolvedor.

---

## Etapa 09 - Tags e anexos no frontend

### Objetivo

Completar no frontend a experiência de tags e anexos, adicionando autocomplete de tags e os fluxos autenticados de upload, listagem, download e exclusão de arquivos por tarefa.

### Uso da IA

A IA foi utilizada como ferramenta de apoio para:

- comparar um campo livre de tags com um componente de autocomplete;
- revisar o contrato existente de `GET /tags` e dos endpoints de anexos;
- identificar que o download autenticado exige `fetch` e Blob, pois um link comum não envia o bearer token;
- sugerir a separação da gestão de anexos em um diálogo próprio;
- levantar riscos no envio de `FormData`, especialmente a definição incorreta do boundary;
- propor invalidação dos caches de lista e kanban após upload ou exclusão;
- revisar o comportamento esperado de projetos arquivados;
- estruturar cenários de teste para sugestões, upload, download, exclusão e modo somente leitura.

A ferramenta não tomou decisões autônomas nem executou a integração no ambiente do projeto. A seleção da abordagem, a implementação, as adaptações ao código existente, a validação e a responsabilidade técnica permanecem com o desenvolvedor.

### Sugestão inicial

A análise assistida sugeriu:

- manter a entrada textual de tags, adicionando uma lista de sugestões reutilizáveis;
- permitir que nomes inexistentes continuem sendo enviados e criados pelo backend;
- consultar tags somente enquanto o campo estiver em uso;
- criar um diálogo específico de anexos acessível pela lista e pelo kanban;
- usar `FormData` sem definir manualmente `Content-Type`;
- estender o cliente HTTP com parser de Blob sem duplicar a lógica de refresh token;
- invalidar lista e kanban após alterações em anexos;
- validar no navegador os tipos permitidos e o limite de 5 MB, mantendo o backend como validação autoritativa;
- permitir download em projeto arquivado e ocultar upload e exclusão.

### Decisão do desenvolvedor

O desenvolvedor decidiu:

- manter tags como nomes no payload de tarefa, preservando o contrato já existente;
- criar autocomplete que lista tags do próprio usuário e permite novos nomes;
- integrar o campo ao React Hook Form por meio de `Controller`;
- criar `TaskAttachmentsDialog` separado do formulário de tarefa;
- manter a criação de tarefa independente do upload, pois anexos exigem um `task_id` persistido;
- realizar download autenticado por Blob, reutilizando a renovação automática de sessão;
- atualizar o cache específico de anexos e invalidar as representações de tarefas;
- preservar download e consulta em projetos arquivados, bloqueando upload e exclusão;
- não alterar o backend nem criar migration;
- não adicionar entrada ao `DECISIONS.md`, pois a modelagem de tags, a abstração de storage e o modo somente leitura já estavam aprovados.

### Alterações humanas

O desenvolvedor incorporou à base desta etapa as correções identificadas durante a validação anterior:

- retenção do cache no teste de rollback do kanban;
- barra horizontal superior sincronizada para melhorar a usabilidade do quadro em largura reduzida;
- demais ajustes locais de lint, testes e imports já aplicados nas etapas anteriores.

Também cabe ao desenvolvedor:

- aplicar o patch sobre o repositório real;
- revisar os textos e o comportamento visual no navegador;
- testar arquivos JPEG, PNG, WebP e PDF reais;
- confirmar o limite de 5 MB e as mensagens retornadas pela API;
- executar lint, type-check, Vitest e build;
- corrigir diferenças do ambiente local;
- realizar o commit somente após aceitar os resultados.

### Problemas identificados

- Links diretos para anexos não enviam o token de autenticação.
- Definir manualmente `Content-Type: multipart/form-data` impede que o navegador inclua o boundary.
- Um autocomplete que consulta sempre, mesmo fechado, criaria requisições desnecessárias e interferiria em testes existentes.
- Upload durante a criação da tarefa exigiria coordenar duas operações antes de existir `task_id`.
- Atualizar apenas o diálogo deixaria contadores antigos na lista e no kanban.
- Projetos arquivados precisam permitir consulta sem permitir mutação.
- A validação do navegador melhora a experiência, mas não substitui a validação autoritativa do backend.

### Validação

Durante a preparação foram executadas:

- análise sintática dos arquivos TypeScript e TSX com o parser do TypeScript;
- verificação de equilíbrio das chaves CSS;
- `git diff --check`;
- inspeção do fluxo de `FormData`;
- inspeção do download autenticado com Blob;
- inspeção das invalidações de cache;
- aplicação das alterações sobre uma cópia do estado corrigido da Etapa 08.

Não foram executados neste ambiente:

- ESLint, porque as dependências do projeto não estavam instaladas;
- type-check completo com todas as dependências;
- Vitest, porque o registry interno não disponibilizou o pacote;
- build do Vite;
- validação com navegador e backend ativos.

Nenhum desses resultados pendentes é apresentado como aprovado.

### Resultado

A Etapa 09 foi preparada com autocomplete de tags, criação de novos nomes, diálogo de anexos, upload, listagem, download autenticado, exclusão, atualização de caches, modo somente leitura e testes dos fluxos principais.

A etapa somente deve ser considerada concluída após aplicação e validação real pelo desenvolvedor.


---

## Etapa 10 - Testes e estabilização

### Objetivo

Consolidar as correções encontradas na validação local, ampliar a cobertura dos
fluxos obrigatórios e criar um processo reproduzível de verificação antes do
deploy.

### Uso da IA

A IA foi utilizada como apoio para revisar a distribuição atual dos testes,
comparar riscos de regressão, organizar uma matriz de validação e sugerir
automação local e de CI. A ferramenta também ajudou a relacionar erros reais
encontrados no Windows com cenários que deveriam permanecer cobertos.

### Sugestão inicial

A análise assistida sugeriu testar explicitamente a revision Alembic aplicada,
o schema PostgreSQL, os valores públicos dos enums, o fluxo integrado com tags
e anexos, o cadastro no frontend, a sincronização da rolagem superior e o modo
somente leitura do kanban. Também sugeriu unificar os comandos em scripts e
substituir `npm install` por `npm ci` na CI.

### Decisão do desenvolvedor

O desenvolvedor decidiu limitar a etapa à estabilização, sem adicionar recursos
de produto. Foram selecionados testes que protegem requisitos obrigatórios e
correções verificadas durante o uso real. Não foi definido limite mínimo de
cobertura sem medição prévia, e nenhuma atualização forçada de dependências foi
aprovada apenas por causa do relatório do npm.

### Alterações humanas

O desenvolvedor identificou e corrigiu anteriormente:

- instabilidade do pool `forks` do Vitest no Windows;
- interferência entre testes de autenticação;
- `setState` desnecessário em `useEffect` na página de projetos;
- retenção do cache no teste de rollback;
- posição ineficiente da barra horizontal do kanban;
- diferenças entre implementações de Blob no ambiente `jsdom`.

Nesta etapa, cabe ao desenvolvedor executar a validação consolidada, analisar
as vulnerabilidades informadas pelo npm e aceitar ou ajustar cada teste antes
do commit.

### Problemas identificados

- Migrations podem parecer corretas quando os testes usam apenas metadata ORM.
- Um fluxo integrado curto não detecta regressões entre tags, anexos, status e
  arquivamento.
- Cadastro não possuía teste de página equivalente ao login.
- Uma correção visual de rolagem poderia regredir sem teste específico.
- `npm install` na CI não garante a mesma árvore registrada no lockfile.
- `npm audit fix --force` pode trocar versões major e introduzir quebra.

### Validação

A saída real apresentada antes desta etapa confirmou ESLint, TypeScript e build
do frontend, além de 24 dos 25 testes. O teste restante foi corrigido depois,
mas a execução integral posterior ainda precisa ser colada e registrada.

Os novos testes, o backend completo, a cobertura, os scripts e a CI não são
declarados como aprovados nesta preparação.

### Resultado

A Etapa 10 adiciona proteção contra divergência de migrations, amplia o fluxo
integrado, cobre cadastro e regressões do kanban, padroniza a validação local e
fortalece a CI. A conclusão depende da execução real de todos os comandos.
~~~~

### `docs/CURRENT_STATE.md`

~~~~markdown
# Estado atual

## Concluído

- Backend obrigatório implementado com migrations até `0004_add_attachments`.
- Frontend com autenticação, projetos, lista, kanban, tags e anexos implementado.
- Correções locais de Vitest, cache otimista, lint, Blob e rolagem incorporadas.
- Testes de integridade Alembic e schema preparados.
- Fluxo integrado do backend ampliado para tags, anexos e arquivamento.
- Testes de cadastro e regressões de usabilidade do kanban preparados.
- Scripts de validação local e comando `npm run check` adicionados.
- CI ajustada para cobertura do backend, `npm ci` e validação consolidada.
- Matriz central em `docs/VALIDATION.md` criada.

## Em desenvolvimento

- Aplicação da Etapa 10 no repositório do desenvolvedor.
- Execução real de Ruff, pytest, cobertura, ESLint, TypeScript, Vitest e build.
- Análise das duas vulnerabilidades informadas por `npm audit`.

## Pendente

- Registrar as saídas integrais da Etapa 10 em `AI_USAGE.md` e `VALIDATION.md`.
- Corrigir eventuais regressões encontradas na validação completa.
- Consolidar Docker fullstack e deploy na Etapa 11.
- Finalizar README, SPEC, arquitetura e roteiro do vídeo na Etapa 12.

## Último commit

- Etapa 10 ainda não commitada.
- Mensagem planejada: `test: amplia cobertura e estabiliza validações`
~~~~

### `docs/prompts/prompt-etapa-10-testes.md`

~~~~markdown
# Prompt da Etapa 10 — Testes e estabilização

## Finalidade

Registrar o uso de IA como apoio para localizar lacunas de cobertura, organizar
cenários de regressão e revisar a automação de validação, sem atribuir à
ferramenta a execução ou a aprovação dos testes.

## Contexto fornecido pelo desenvolvedor

- Backend e frontend obrigatórios já estavam implementados.
- Ruff, ESLint, TypeScript, pytest, Vitest e build são validações obrigatórias.
- O ambiente Windows apresentou instabilidade no pool `forks` do Vitest.
- O teste otimista do kanban exigiu retenção explícita do cache.
- A rolagem horizontal inferior do kanban foi substituída por controle superior.
- O teste de Blob revelou incompatibilidades entre implementações de `jsdom`.
- A instalação npm informou duas vulnerabilidades de severidade alta.

## Solicitação feita à IA

> Revise a suíte atual do Taskly e proponha uma etapa de estabilização sem criar
> novas funcionalidades. Amplie a cobertura dos fluxos obrigatórios, valide a
> integridade das migrations e do schema, consolide comandos locais e de CI,
> preserve as correções já feitas no Windows e documente somente resultados
> realmente apresentados pelo desenvolvedor.

## Resultado utilizado pelo desenvolvedor

A análise serviu para priorizar:

- testes explícitos da head Alembic, relações, constraints e enums;
- ampliação do fluxo integrado do backend;
- cobertura do cadastro no frontend;
- regressão da barra superior e do modo somente leitura do kanban;
- comando único de validação local;
- uso de `npm ci` na CI;
- relatório de cobertura sem impor limite não medido;
- tratamento responsável do `npm audit`.

As alterações devem ser revisadas, executadas e aceitas pelo desenvolvedor.
~~~~

## 7. Validação

### Preparação local

Na raiz do repositório:

```powershell
.\scripts\validate.ps1 -InstallDependencies
```

Nas execuções seguintes:

```powershell
.\scripts\validate.ps1
```

### Backend isolado

```powershell
cd backend
alembic heads
alembic current
alembic upgrade head
python -m ruff check .
python -m ruff format . --check
python -m pytest --cov=app --cov-report=term-missing
```

### Frontend isolado

```powershell
cd frontend
npm ci
npm run check
```

### Auditoria

```powershell
npm audit
npm audit --omit=dev
npm audit fix --dry-run
```

Não executar `npm audit fix --force` sem revisar as mudanças propostas.

## 8. Commit

```powershell
git status
git add backend/app/tests
git add frontend/src/features/auth/pages/RegisterPage.test.tsx
git add frontend/src/features/tasks/components/KanbanBoard.test.tsx
git add frontend/package.json frontend/package-lock.json
git add .github/workflows/ci.yml scripts
git add README.md frontend/README.md
git add docs/AI_USAGE.md docs/CURRENT_STATE.md docs/VALIDATION.md
git add docs/etapas/etapa-10-testes.md
git add docs/prompts/prompt-etapa-10-testes.md
git diff --cached
git commit -m "test: amplia cobertura e estabiliza validações"
git push origin main
```

## 9. Problemas comuns

### `npm ci` informa lockfile ausente ou incompatível

Execute `npm install` uma vez, revise o `package-lock.json`, inclua-o no commit e
repita `npm ci`.

### Testes backend não encontram `TEST_DATABASE_URL`

Confirme `backend/.env`, o PostgreSQL e a existência do banco exclusivo de
testes. Nunca aponte os testes para o banco de desenvolvimento.

### Teste de kanban falha por worker

Confirme `pool: 'threads'`, `fileParallelism: false` e `maxWorkers: 1` em
`vite.config.ts`.

### `npm audit` continua indicando vulnerabilidade

Classifique a dependência, verifique se ela chega ao bundle de produção e
registre a decisão. A existência do alerta não autoriza atualização forçada.

## 10. Checklist

- [x] Testes de migrations e schema preparados.
- [x] Fluxo integrado do backend ampliado.
- [x] Cadastro frontend coberto.
- [x] Barra superior do kanban protegida por teste.
- [x] Modo somente leitura protegido por teste.
- [x] Comando consolidado local criado.
- [x] CI estabilizada.
- [x] Matriz de validação criada.
- [ ] Saída real completa do backend registrada.
- [ ] Saída real completa do frontend registrada.
- [ ] Auditoria de dependências classificada.
- [ ] Commit executado pelo desenvolvedor.

## 11. Próxima etapa

**Etapa 11 — Docker fullstack e deploy.**

Ela deverá criar a imagem de produção do frontend, consolidar o Compose, definir
variáveis e persistência de anexos, validar health checks e documentar o deploy.
