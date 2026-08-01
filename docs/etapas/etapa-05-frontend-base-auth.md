# Etapa 05 — Fundação do frontend e autenticação persistente

## 1. Título e objetivo da etapa

Inicializar o frontend do Taskly com React, Vite e TypeScript e entregar o fluxo de autenticação de ponta a ponta: registro, login, validação da sessão, renovação automática dos tokens, proteção de rotas e logout.

A etapa também fecha o gap do backend que emitia refresh token, mas ainda não possuía endpoint para consumi-lo.

## 2. O que foi feito e por quê

### Backend

- criado `POST /api/v1/auth/refresh`;
- validado o claim `type=refresh`, impedindo uso de access token na renovação;
- revalidada a existência e o estado ativo do usuário;
- emitidos novos access e refresh tokens;
- adicionados testes para refresh válido, access token usado incorretamente e JWT inválido;
- atualizado o README do backend.

O endpoint foi implementado antes do frontend para que a persistência de sessão não dependesse apenas da duração do access token.

### Frontend

- inicializado projeto React/Vite/TypeScript;
- configurados TanStack Query, React Hook Form, Zod, React Router, Vitest e ESLint;
- criado cliente HTTP centralizado com `fetch`;
- isolado o armazenamento dos tokens;
- implementada renovação automática com apenas uma repetição da request original;
- compartilhada uma única renovação entre requisições concorrentes;
- implementados cadastro, login, validação da sessão e logout;
- criadas rotas públicas e protegidas;
- criada tela autenticada provisória, sem antecipar projetos e tarefas;
- adicionados testes para armazenamento, cliente HTTP, login e proteção de rotas;
- adicionado job independente de frontend na CI.

A fundação foi isolada por feature para evitar que regras de autenticação se espalhem pelos componentes de projetos e tarefas nas próximas etapas.

## 3. Decisões técnicas tomadas

### 3.1. Cliente HTTP baseado em `fetch`

**Alternativa:** adicionar Axios.

**Prós do Axios:** interceptors prontos e API conhecida.
**Contras:** dependência adicional para um fluxo que o `fetch` nativo atende com pouco código.

**Decisão do desenvolvedor:** usar `fetch` centralizado em `src/api/client.ts`.

### 3.2. Refresh seletivo

**Alternativa rejeitada:** tentar refresh em toda resposta `403`.

Essa abordagem confundiria expiração de token com ownership, projeto arquivado ou outras regras de negócio.

**Decisão do desenvolvedor:** tentar refresh somente em `401` ou quando a API retornar exatamente `Invalid or expired token`. O retry é limitado a uma tentativa.

### 3.3. Requisições concorrentes

**Risco:** várias consultas podem falhar juntas quando o access token expira.

**Decisão do desenvolvedor:** compartilhar uma promise de refresh em andamento. Assim, todas aguardam a mesma renovação e cada request é repetida no máximo uma vez.

### 3.4. Persistência no navegador

A decisão de usar `localStorage` já havia sido aprovada como trade-off do case e está registrada em `DECISIONS.md`.

**Limitação reconhecida:** tokens acessíveis ao JavaScript aumentam impacto de XSS. Para um produto real, a evolução recomendada permanece cookies HttpOnly, rotação/revogação de refresh token e proteção CSRF.

### 3.5. Estado remoto e estado de sessão

TanStack Query valida e mantém o usuário de `/auth/me`. O contexto de autenticação coordena login, cadastro e logout, enquanto o módulo de storage permanece responsável somente pelos tokens.

### 3.6. `DECISIONS.md`

Não foi alterado nesta etapa. A implementação concretiza a decisão de sessão já registrada e não introduz uma nova escolha arquitetural de longo prazo.

## 4. Dependências entre arquivos e ordem de criação/alteração

1. `backend/app/schemas/auth.py`: contrato do refresh.
2. `backend/app/api/routes/auth.py`: endpoint e validação do token.
3. `backend/app/tests/test_auth.py`: cobertura do contrato.
4. `frontend/package.json` e configurações Vite/TypeScript/ESLint/Vitest.
5. `frontend/src/lib/auth-storage.ts`: persistência isolada.
6. `frontend/src/api/client.ts`: headers, erros, refresh e retry.
7. `frontend/src/features/auth/api.ts` e `types.ts`: contrato da feature.
8. `frontend/src/features/auth/auth-context.ts` e `AuthProvider.tsx`: sessão reativa.
9. páginas de login/cadastro e componentes compartilhados.
10. rotas públicas, protegidas e shell autenticado.
11. testes do frontend.
12. CI, READMEs e documentação transversal.

## 5. Conteúdo completo de cada arquivo alterado

O conteúdo deste próprio documento não é repetido dentro dele para evitar recursão. Todos os demais arquivos criados ou alterados na Etapa 05 são reproduzidos abaixo.

### `.github/workflows/ci.yml`

`````yaml
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
        run: pytest

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

      - name: Install dependencies
        run: npm install

      - name: Run ESLint
        run: npm run lint

      - name: Run TypeScript check
        run: npx tsc --noEmit

      - name: Run tests
        run: npm run test

      - name: Build frontend
        run: npm run build
`````

### `.gitignore`

`````gitignore
# Python
__pycache__/
*.py[cod]
*.pyo
*.pyd
.pytest_cache/
.ruff_cache/
.coverage
htmlcov/
dist/
build/
*.egg-info/

# Frontend
node_modules/
frontend/dist/
frontend/.vite/
frontend/coverage/
backend/storage/

# Virtual environments
.venv/
venv/
env/

# Environment variables
.env
.env.*
!.env.example

# Editors
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log

# Alembic
# Revisions são código-fonte; somente caches devem ser ignorados.
backend/alembic/versions/__pycache__/
`````

### `README.md`

`````markdown
# Taskly Fullstack

Repositório do case técnico Taskly, organizado como monorepo para manter backend, frontend e documentação no mesmo histórico Git.

## Estrutura atual

```text
taskly-fullstack-UEX/
├── backend/          # FastAPI, SQLAlchemy, Alembic e pytest
├── frontend/         # React, Vite, TypeScript e autenticação
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

O frontend possui cadastro, login, sessão persistente, renovação automática de token, rotas protegidas e logout. Os fluxos de projetos e tarefas serão implementados nas próximas etapas.
`````

### `backend/README.md`

`````markdown
# KanbanCore API

![Python](https://img.shields.io/badge/Python-3.12+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-red)
![Docker](https://img.shields.io/badge/Docker-ready-blue)
![Tests](https://img.shields.io/badge/tests-pytest-brightgreen)

[CI](https://github.com/dmhara812/kanbancore-api/actions/workflows/ci.yml/badge.svg)


## Sobre o projeto

**KanbanCore API** é uma API REST profissional para gerenciamento de projetos e tarefas, construída com foco em arquitetura limpa, boas práticas de backend e preparação para produção.

O projeto foi desenvolvido como base reutilizável e peça de portfólio, demonstrando:

- autenticação com JWT;
- CRUD real com entidades relacionadas;
- arquitetura em camadas;
- validação com Pydantic;
- persistência com PostgreSQL e SQLAlchemy;
- migrations com Alembic;
- testes automatizados com pytest;
- CI com GitHub Actions;
- ambiente Docker com API e banco de dados.

---

## Stack

- Python 3.12+
- FastAPI
- PostgreSQL
- SQLAlchemy 2.0
- Alembic
- Pydantic v2
- JWT com python-jose
- Passlib + bcrypt
- Docker
- Docker Compose
- pytest
- Ruff
- GitHub Actions

---

## Funcionalidades

- Registro de usuários
- Login com JWT
- Access token
- Refresh token
- Rota de usuário autenticado
- CRUD de projetos
- CRUD de tarefas
- Paginação em listagens
- Filtros em listagens
- Proteção de rotas com autenticação
- Validação de ownership
- Bloqueio de criação de tarefas em projetos arquivados
- Tratamento global de erros de negócio
- Testes automatizados do fluxo principal
- CI com lint e testes

---

## Arquitetura

O projeto segue uma arquitetura em camadas:

```text
app/
  api/          -> rotas/controllers
  core/         -> configurações, segurança e dependências
  models/       -> modelos SQLAlchemy
  schemas/      -> schemas Pydantic
  repositories/ -> acesso ao banco de dados
  services/     -> regras de negócio
  tests/        -> testes automatizados

alembic/        -> migrations do banco de dados
```

Fluxo principal da aplicação:

```text
HTTP request
   ↓
API route
   ↓
Service
   ↓
Repository
   ↓
Database
```

---

## Modelo de dados

Relacionamento principal:

```text
User 1 ──── N Project 1 ──── N Task
```

### User

Representa um usuário autenticado.

Campos principais:

- `id`
- `name`
- `email`
- `hashed_password`
- `is_active`
- `created_at`
- `updated_at`

### Project

Representa um projeto pertencente a um usuário.

Campos principais:

- `id`
- `owner_id`
- `name`
- `description`
- `status`
- `created_at`
- `updated_at`

Status possíveis:

```text
active
archived
```

### Task

Representa uma tarefa pertencente a um projeto.

Campos principais:

- `id`
- `project_id`
- `title`
- `description`
- `status`
- `priority`
- `due_date`
- `created_at`
- `updated_at`

Status possíveis:

```text
todo
in_progress
done
```

Prioridades possíveis:

```text
low
medium
high
```

---

## Pré-requisitos

Para rodar localmente:

- Python 3.12+
- Docker
- Docker Compose
- Git

Opcional:

- VS Code
- Extensão Python
- Extensão Ruff
- Extensão Docker

---

## Configuração do ambiente

Clone o repositório:

```bash
git clone https://github.com/SEU_USUARIO/kanbancore-api.git
cd kanbancore-api
```

Crie o ambiente virtual:

```bash
python -m venv .venv
```

Ative o ambiente virtual.

Linux/macOS:

```bash
source .venv/bin/activate
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Instale as dependências:

```bash
pip install -e ".[dev]"
```

Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
copy .env.example .env
```

---

## Variáveis de ambiente

Exemplo de `.env` para rodar localmente:

```env
APP_NAME="KanbanCore API"
APP_ENV="local"
APP_DEBUG=true
APP_VERSION="0.1.0"

DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5433/projects_api"
TEST_DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5433/projects_api_test"

JWT_SECRET_KEY="change-this-secret-key"
JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

CORS_ORIGINS="http://localhost:3000,http://localhost:8000"
```

### Observação sobre a porta do PostgreSQL

Este projeto usa a porta local `5433` para o PostgreSQL porque a porta `5432` pode estar ocupada na máquina local.

No Docker Compose:

```text
localhost:5433 -> container db:5432
```

Fora do Docker, a API usa:

```text
localhost:5433
```

Dentro do Docker, a API usa:

```text
db:5432
```

---

## Rodando com Docker

Suba API e banco:

```bash
docker compose up --build
```

Ou em segundo plano:

```bash
docker compose up --build -d
```

Acesse:

- API: http://localhost:8000
- Swagger: http://localhost:8000/docs
- Health check: http://localhost:8000/api/v1/health

Parar containers:

```bash
docker compose down
```

Ver logs:

```bash
docker compose logs -f
```

Ver logs apenas da API:

```bash
docker compose logs -f api
```

---

## Rodando localmente sem Docker para a API

Suba apenas o banco:

```bash
docker compose up -d db
```

Rode migrations:

```bash
alembic upgrade head
```

Inicie a API:

```bash
uvicorn app.main:app --reload
```

Acesse:

```text
http://localhost:8000/docs
```

---

## Migrations com Alembic

Criar uma nova migration:

```bash
alembic revision --autogenerate -m "migration message"
```

Aplicar migrations:

```bash
alembic upgrade head
```

Ver migration atual:

```bash
alembic current
```

Reverter uma migration:

```bash
alembic downgrade -1
```

---

## Testes

Crie o banco de teste:

```bash
docker exec -it projects-api-db createdb -U postgres projects_api_test
```

Rode os testes:

```bash
pytest
```

Com cobertura:

```bash
pytest --cov=app
```

---

## Lint e formatação

Rodar lint:

```bash
ruff check app
```

Corrigir problemas automaticamente quando possível:

```bash
ruff check app --fix
```

Formatar código:

```bash
ruff format app
```

Checar formatação:

```bash
ruff format app --check
```

---

## CI com GitHub Actions

O projeto possui workflow em:

```text
.github/workflows/ci.yml
```

O CI executa:

- instalação das dependências;
- PostgreSQL como serviço;
- Ruff lint;
- Ruff format check;
- pytest.

Workflow:

```text
KanbanCore API CI
```

---

## Endpoints principais

Base URL local:

```text
http://localhost:8000/api/v1
```

### Health

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/health` | Verifica se a API está online |

### Auth

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/auth/register` | Registra um novo usuário |
| POST | `/auth/login` | Autentica usuário e retorna tokens |
| POST | `/auth/refresh` | Renova access e refresh tokens |
| GET | `/auth/me` | Retorna usuário autenticado |

### Projects

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/projects` | Cria projeto |
| GET | `/projects` | Lista projetos com paginação e filtros |
| GET | `/projects/{project_id}` | Busca projeto por ID |
| PATCH | `/projects/{project_id}` | Atualiza projeto |
| PATCH | `/projects/{project_id}/archive` | Arquiva projeto |
| DELETE | `/projects/{project_id}` | Remove projeto |

### Tasks

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/tasks` | Cria tarefa |
| GET | `/tasks` | Lista tarefas com paginação e filtros |
| GET | `/tasks/{task_id}` | Busca tarefa por ID |
| PATCH | `/tasks/{task_id}` | Atualiza tarefa |
| PATCH | `/tasks/{task_id}/done` | Marca tarefa como concluída |
| DELETE | `/tasks/{task_id}` | Remove tarefa |

---

## Filtros e paginação

### Projetos

Endpoint:

```text
GET /api/v1/projects
```

Query params:

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `page` | int | Página atual |
| `size` | int | Itens por página |
| `status` | string | `active` ou `archived` |
| `search` | string | Busca parcial pelo nome |

Exemplo:

```text
GET /api/v1/projects?page=1&size=20&status=active&search=portfolio
```

### Tarefas

Endpoint:

```text
GET /api/v1/tasks
```

Query params:

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `page` | int | Página atual |
| `size` | int | Itens por página |
| `project_id` | UUID | Filtra por projeto |
| `status` | string | `todo`, `in_progress` ou `done` |
| `priority` | string | `low`, `medium` ou `high` |
| `due_before` | date | Filtra tarefas com prazo até a data |
| `search` | string | Busca parcial pelo título |

Exemplo:

```text
GET /api/v1/tasks?page=1&size=20&priority=high&search=auth
```

---

## Fluxo completo de uso

### 1. Registrar usuário

```http
POST /api/v1/auth/register
```

Body:

```json
{
  "name": "Ana Silva",
  "email": "ana.silva@example.com",
  "password": "StrongPassword123"
}
```

### 2. Login

```http
POST /api/v1/auth/login
```

Form data:

```text
username=ana.silva@example.com
password=StrongPassword123
```

Resposta:

```json
{
  "access_token": "jwt-access-token",
  "refresh_token": "jwt-refresh-token",
  "token_type": "bearer"
}
```

### 3. Renovar a sessão

```http
POST /api/v1/auth/refresh
Content-Type: application/json
```

```json
{
  "refresh_token": "jwt-refresh-token"
}
```

### 4. Criar projeto

```http
POST /api/v1/projects
Authorization: Bearer <access_token>
```

Body:

```json
{
  "name": "Portfolio API",
  "description": "Backend project built with FastAPI and PostgreSQL."
}
```

### 5. Criar tarefa

```http
POST /api/v1/tasks
Authorization: Bearer <access_token>
```

Body:

```json
{
  "project_id": "project-uuid",
  "title": "Create authentication endpoints",
  "description": "Implement register, login and current user endpoints.",
  "priority": "high",
  "due_date": "2026-06-15"
}
```

### 5. Listar tarefas

```http
GET /api/v1/tasks?page=1&size=20
Authorization: Bearer <access_token>
```

---

## Decisões técnicas

### Arquitetura em camadas

O projeto separa responsabilidades em:

- `api`: entrada HTTP;
- `services`: regras de negócio;
- `repositories`: acesso ao banco;
- `models`: estrutura persistida;
- `schemas`: contratos de entrada e saída;
- `core`: infraestrutura da aplicação.

Isso evita controllers grandes e facilita manutenção/testes.

### UUID como chave primária

As entidades usam UUID para evitar exposição de IDs sequenciais e deixar a API mais adequada para uso público.

### JWT

A autenticação usa access token e refresh token. O access token protege rotas privadas e identifica o usuário pelo claim `sub`.

### Ownership

Projetos pertencem a usuários. Tarefas pertencem a projetos. As consultas protegidas validam ownership para impedir acesso a dados de outros usuários.

### Paginação

Listagens retornam:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "size": 20,
  "pages": 0
}
```

### Docker

O Docker Compose sobe API e PostgreSQL. O container da API executa migrations antes de iniciar o servidor.

---

## Estrutura de pastas

```text
.
├── alembic/
│   ├── versions/
│   ├── env.py
│   └── script.py.mako
├── app/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.py
│   │   │   ├── projects.py
│   │   │   └── tasks.py
│   │   └── router.py
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── dependencies.py
│   │   └── security.py
│   ├── models/
│   │   ├── base.py
│   │   ├── project.py
│   │   ├── task.py
│   │   └── user.py
│   ├── repositories/
│   │   ├── project_repository.py
│   │   ├── task_repository.py
│   │   └── user_repository.py
│   ├── schemas/
│   │   ├── auth.py
│   │   ├── common.py
│   │   ├── project.py
│   │   ├── task.py
│   │   └── user.py
│   ├── services/
│   │   ├── exceptions.py
│   │   ├── project_service.py
│   │   ├── task_service.py
│   │   └── user_service.py
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_full_flow.py
│   │   ├── test_projects.py
│   │   └── test_tasks.py
│   └── main.py
├── .github/
│   └── workflows/
│       └── ci.yml
├── .env.example
├── .gitignore
├── alembic.ini
├── docker-compose.yml
├── docker-entrypoint.sh
├── Dockerfile
├── pyproject.toml
└── README.md
```

---

## Próximos passos

Possíveis melhorias futuras:

- logout com blacklist de tokens;
- roles e permissões;
- membros em projetos;
- comentários em tarefas;
- labels/tags;
- upload de anexos;
- soft delete;
- paginação com cursor;
- rate limiting;
- logs estruturados;
- observabilidade com Prometheus/Grafana;
- deploy em cloud;
- job adicional no CI validando Docker Compose.

---

## Licença

Este projeto pode ser usado como base para estudos, portfólio e evolução pessoal.
`````

### `backend/app/api/routes/auth.py`

`````python
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_token_subject,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import (
    CurrentUserResponse,
    RefreshTokenRequest,
    TokenResponse,
)
from app.schemas.user import UserCreate, UserResponse
from app.services.exceptions import ForbiddenError, NotFoundError
from app.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    user_data: UserCreate,
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """Registra um novo usuário.

    A senha é recebida pelo schema `UserCreate`, mas a resposta nunca retorna
    a senha nem o hash.
    """
    user_service = UserService(db)

    return user_service.create_user(user_data)


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    """Autentica usuário e retorna tokens JWT.

    `OAuth2PasswordRequestForm` usa campos chamados `username` e `password`.
    Neste projeto, usaremos o campo `username` como e-mail.

    Isso melhora a integração com o Swagger, que já entende esse padrão.
    """
    user_service = UserService(db)
    user = user_service.get_user_by_email(form_data.username)

    # A mensagem é genérica de propósito para não revelar se o e-mail existe.
    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise ForbiddenError("Invalid credentials")

    if not user.is_active:
        raise ForbiddenError("Inactive user")

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_session(
    payload: RefreshTokenRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    """Renova a sessão somente a partir de um refresh token válido.

    O tipo do token é conferido para impedir que um access token seja usado
    para prolongar a própria sessão. A existência e o estado ativo do usuário
    também são reavaliados antes de emitir novos tokens.
    """
    try:
        user_id = get_token_subject(
            payload.refresh_token,
            expected_type="refresh",
        )
    except JWTError as exc:
        raise ForbiddenError("Invalid or expired refresh token") from exc

    user_service = UserService(db)
    try:
        user = user_service.get_user_by_id(user_id)
    except NotFoundError as exc:
        raise ForbiddenError("Invalid or expired refresh token") from exc

    if not user.is_active:
        raise ForbiddenError("Inactive user")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=CurrentUserResponse)
def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> CurrentUserResponse:
    """Retorna os dados do usuário autenticado."""
    return CurrentUserResponse(user=UserResponse.model_validate(current_user))
`````

### `backend/app/schemas/auth.py`

`````python
from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    email: EmailStr = Field(
        examples=["ana.silva@example.com"],
    )
    password: str = Field(
        min_length=8,
        max_length=128,
        examples=["StrongPassword123"],
    )


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(
        min_length=1,
        examples=[
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example.refresh.token",
        ],
    )


class TokenResponse(BaseModel):
    access_token: str = Field(
        examples=[
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example.access.token",
        ],
    )
    refresh_token: str | None = Field(
        default=None,
        examples=[
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example.refresh.token",
        ],
    )
    token_type: str = Field(
        default="bearer",
        examples=["bearer"],
    )


class CurrentUserResponse(BaseModel):
    user: UserResponse
`````

### `backend/app/tests/test_auth.py`

`````python
from fastapi.testclient import TestClient


def test_register_user(
    client: TestClient,
    user_payload: dict[str, str],
) -> None:
    response = client.post("/api/v1/auth/register", json=user_payload)

    assert response.status_code == 201

    data = response.json()

    assert data["name"] == user_payload["name"]
    assert data["email"] == user_payload["email"]
    assert data["is_active"] is True
    assert "id" in data
    assert "hashed_password" not in data
    assert "password" not in data


def test_register_user_with_duplicate_email_returns_409(
    client: TestClient,
    user_payload: dict[str, str],
) -> None:
    first_response = client.post("/api/v1/auth/register", json=user_payload)
    second_response = client.post("/api/v1/auth/register", json=user_payload)

    assert first_response.status_code == 201
    assert second_response.status_code == 409
    assert second_response.json()["detail"] == "Email already registered"


def test_login_user(
    client: TestClient,
    user_payload: dict[str, str],
) -> None:
    client.post("/api/v1/auth/register", json=user_payload)

    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": user_payload["email"],
            "password": user_payload["password"],
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert data["refresh_token"]


def test_login_with_invalid_credentials_returns_403(
    client: TestClient,
    user_payload: dict[str, str],
) -> None:
    client.post("/api/v1/auth/register", json=user_payload)

    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": user_payload["email"],
            "password": "wrong-password",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Invalid credentials"


def test_get_current_user(
    client: TestClient,
    auth_headers: dict[str, str],
    user_payload: dict[str, str],
) -> None:
    response = client.get("/api/v1/auth/me", headers=auth_headers)

    assert response.status_code == 200

    data = response.json()

    assert data["user"]["name"] == user_payload["name"]
    assert data["user"]["email"] == user_payload["email"]


def test_get_current_user_without_token_returns_401(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401


def test_refresh_session_returns_new_valid_tokens(
    client: TestClient,
    user_payload: dict[str, str],
) -> None:
    client.post("/api/v1/auth/register", json=user_payload)
    login_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": user_payload["email"],
            "password": user_payload["password"],
        },
    )

    refresh_response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": login_response.json()["refresh_token"]},
    )

    assert refresh_response.status_code == 200
    tokens = refresh_response.json()
    assert tokens["access_token"]
    assert tokens["refresh_token"]
    assert tokens["token_type"] == "bearer"

    me_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["user"]["email"] == user_payload["email"]


def test_refresh_session_rejects_access_token(
    client: TestClient,
    user_payload: dict[str, str],
) -> None:
    client.post("/api/v1/auth/register", json=user_payload)
    login_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": user_payload["email"],
            "password": user_payload["password"],
        },
    )

    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": login_response.json()["access_token"]},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Invalid or expired refresh token"


def test_refresh_session_rejects_invalid_token(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "not-a-valid-jwt"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Invalid or expired refresh token"
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
- Endpoint `POST /api/v1/auth/refresh` preparado.
- Testes de refresh token no backend preparados.
- Frontend React/Vite/TypeScript inicializado.
- TanStack Query, React Hook Form, Zod, React Router e Vitest configurados.
- Cadastro e login integrados à API.
- Sessão persistente e renovação automática de token preparadas.
- Validação do usuário autenticado por `GET /auth/me` preparada.
- Rotas públicas e protegidas implementadas.
- Logout com limpeza dos tokens e cache implementado.
- Testes iniciais do armazenamento, cliente HTTP, login e proteção de rotas preparados.
- Job independente de frontend adicionado à CI.

## Em desenvolvimento

- Aplicação da Etapa 05 no repositório do desenvolvedor.
- Instalação das dependências e geração de `frontend/package-lock.json`.
- Validação real do backend e frontend.
- Teste manual do fluxo completo no navegador.
- Registro das saídas reais nos documentos da etapa.

## Pendente

- Corrigir eventuais falhas encontradas na validação local da Etapa 05.
- Executar o commit da Etapa 05.
- Implementar CRUD de projetos no frontend.
- Implementar criação e edição de tarefas no frontend.
- Implementar visualização em lista.
- Implementar kanban e drag-and-drop persistido.
- Integrar tags e anexos aos formulários do frontend.
- Consolidar testes, Docker fullstack, deploy e documentação final.

## Último commit

- Etapa 05 ainda não commitada.
- Mensagem planejada: `feat: cria frontend base e autenticação persistente`
`````

### `docs/prompts/prompt-etapa-05-frontend-base-auth.md`

`````markdown
# Prompt da Etapa 05 — Fundação do frontend e autenticação

## Finalidade

Registrar a solicitação usada para apoiar a implementação da fundação React/Vite/TypeScript e do fluxo de autenticação do Taskly.

## Contexto fornecido pelo desenvolvedor

- O repositório já está organizado como monorepo com `backend/`, `frontend/` e `docs/`.
- O backend possui registro, login, access token, refresh token emitido, rota `/auth/me`, projetos, tarefas, tags e anexos.
- Ainda não existe endpoint que consuma o refresh token.
- A Etapa 05 deve iniciar o frontend e implementar autenticação persistente.
- A stack obrigatória inclui React, Vite, TypeScript, TanStack Query, React Hook Form, Zod e Vitest.
- A IA deve aparecer como ferramenta de pesquisa, comparação e revisão; decisões e implementação pertencem ao desenvolvedor.
- Documento de etapa e prompt devem permanecer claramente separados.

## Solicitação feita à IA

> Analise o contrato atual da autenticação e proponha a implementação completa da Etapa 05. Crie o endpoint de refresh no backend, inicialize o frontend React/Vite/TypeScript e implemente cadastro, login, sessão persistente, renovação automática, validação por `/auth/me`, rotas protegidas e logout. Use TanStack Query, React Hook Form, Zod e Vitest. Evite antecipar projetos e kanban. Inclua testes, validações, documentação da etapa, atualização de AI_USAGE e CURRENT_STATE e passo a passo de commit. Não declare comandos como executados sem evidência real.

## Restrições aplicadas

- Preservar o login form-urlencoded compatível com o Swagger.
- Validar o tipo do refresh token no backend.
- Não renovar a sessão para qualquer resposta `403`.
- Limitar o retry automático a uma tentativa.
- Manter a URL da API configurável.
- Não criar mocks silenciosos no código de produção.
- Não implementar projetos, tarefas ou kanban nesta etapa.
- Não alterar `DECISIONS.md` sem uma nova decisão relevante.
- Manter o arquivo técnico em `docs/etapas/` e este registro em `docs/prompts/`.

## Resultado utilizado pelo desenvolvedor

O material apoiou a organização do cliente HTTP, do estado de autenticação, dos formulários, das rotas e dos testes. O desenvolvedor permanece responsável por revisar, instalar as dependências, executar as validações e aceitar ou corrigir a implementação no ambiente real.
`````

### `frontend/.env.example`

`````dotenv
VITE_API_URL="http://localhost:8000/api/v1"
`````

### `frontend/README.md`

`````markdown
# Taskly Frontend

Frontend do Taskly desenvolvido com React, Vite e TypeScript.

## Stack desta fundação

- React e React Router;
- TanStack Query para estado remoto;
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
npm run lint
npx tsc --noEmit
npm run test
npm run build
```

## Fluxos disponíveis

- registro de usuário;
- login por e-mail e senha;
- persistência local da sessão;
- renovação automática do access token;
- validação da sessão por `GET /auth/me`;
- rotas públicas e protegidas;
- logout.

O armazenamento em `localStorage` é um trade-off consciente do case. Para um
produto real, a evolução recomendada é adotar cookies HttpOnly e proteção CSRF.
`````

### `frontend/eslint.config.js`

`````javascript
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
)
`````

### `frontend/index.html`

`````html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="Taskly, gerenciamento de projetos e tarefas em lista e kanban."
    />
    <title>Taskly</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`````

### `frontend/package.json`

`````json
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
    "test:watch": "vitest"
  },
  "dependencies": {
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
`````

### `frontend/src/App.tsx`

`````tsx
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './features/auth/pages/LoginPage'
import { RegisterPage } from './features/auth/pages/RegisterPage'
import { AppShell } from './routes/AppShell'
import { DashboardPage } from './routes/DashboardPage'
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
          <Route index element={<DashboardPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
`````

### `frontend/src/api/client.test.ts`

`````typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { writeAuthTokens } from '../lib/auth-storage'
import { apiRequest } from './client'

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('refreshes an expired access token and retries once', async () => {
    writeAuthTokens({
      accessToken: 'expired-access-token',
      refreshToken: 'current-refresh-token',
    })

    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Invalid or expired token' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            token_type: 'bearer',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: 'protected-data' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    const response = await apiRequest<{ value: string }>('/protected')

    expect(response.value).toBe('protected-data')
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(window.localStorage.getItem('taskly.auth.tokens')).toContain(
      'new-refresh-token',
    )

    const retryHeaders = new Headers(fetchSpy.mock.calls[2][1]?.headers)
    expect(retryHeaders.get('Authorization')).toBe('Bearer new-access-token')
  })

  it('does not refresh a business-rule forbidden response', async () => {
    writeAuthTokens({
      accessToken: 'valid-access-token',
      refreshToken: 'valid-refresh-token',
    })
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Archived project is read-only' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(apiRequest('/tasks')).rejects.toMatchObject({
      status: 403,
      detail: 'Archived project is read-only',
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
`````

### `frontend/src/api/client.ts`

`````typescript
import {
  clearAuthTokens,
  readAuthTokens,
  writeAuthTokens,
} from '../lib/auth-storage'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
const AUTH_EXPIRED_DETAIL = 'Invalid or expired token'

let refreshInFlight: Promise<boolean> | null = null

interface ApiRequestOptions extends RequestInit {
  authenticated?: boolean
  retryAfterRefresh?: boolean
}

interface ErrorPayload {
  detail?: string | Array<{ msg?: string }>
}

interface RefreshResponse {
  access_token: string
  refresh_token: string | null
}

export class ApiError extends Error {
  readonly status: number
  readonly detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

function normalizeErrorDetail(payload: ErrorPayload | null): string {
  if (!payload?.detail) {
    return 'Não foi possível concluir a solicitação.'
  }

  if (typeof payload.detail === 'string') {
    return payload.detail
  }

  return payload.detail
    .map((item) => item.msg)
    .filter((message): message is string => Boolean(message))
    .join(' ')
}

async function readErrorPayload(response: Response): Promise<ErrorPayload | null> {
  try {
    return (await response.clone().json()) as ErrorPayload
  } catch {
    return null
  }
}

function buildHeaders(
  headers: HeadersInit | undefined,
  authenticated: boolean,
): Headers {
  const result = new Headers(headers)

  if (!result.has('Accept')) {
    result.set('Accept', 'application/json')
  }

  const tokens = readAuthTokens()
  if (authenticated && tokens) {
    result.set('Authorization', `Bearer ${tokens.accessToken}`)
  }

  return result
}

async function executeRefresh(): Promise<boolean> {
  const tokens = readAuthTokens()

  if (!tokens?.refreshToken) {
    return false
  }

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: tokens.refreshToken }),
  })

  if (!response.ok) {
    clearAuthTokens()
    return false
  }

  const payload = (await response.json()) as RefreshResponse

  if (!payload.refresh_token) {
    clearAuthTokens()
    return false
  }

  writeAuthTokens({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
  })
  return true
}

function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    // Uma única renovação atende requisições concorrentes que falharam com o
    // mesmo access token, evitando rotação duplicada e chamadas redundantes.
    refreshInFlight = executeRefresh().finally(() => {
      refreshInFlight = null
    })
  }

  return refreshInFlight
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    authenticated = true,
    retryAfterRefresh = true,
    headers,
    ...requestOptions
  } = options

  const response = await fetch(`${API_URL}${path}`, {
    ...requestOptions,
    headers: buildHeaders(headers, authenticated),
  })

  if (response.ok) {
    if (response.status === 204) {
      return undefined as T
    }

    return (await response.json()) as T
  }

  const payload = await readErrorPayload(response)
  const detail = normalizeErrorDetail(payload)
  const isAuthenticationFailure =
    response.status === 401 ||
    (response.status === 403 && detail === AUTH_EXPIRED_DETAIL)

  if (authenticated && retryAfterRefresh && isAuthenticationFailure) {
    const refreshed = await refreshSession()

    if (refreshed) {
      return apiRequest<T>(path, {
        ...options,
        retryAfterRefresh: false,
      })
    }
  }

  if (isAuthenticationFailure) {
    clearAuthTokens()
  }

  throw new ApiError(response.status, detail)
}
`````

### `frontend/src/components/LoadingScreen.tsx`

`````tsx
export function LoadingScreen() {
  return (
    <main className="loading-screen" aria-live="polite" aria-busy="true">
      <div className="loading-spinner" aria-hidden="true" />
      <p>Carregando sua sessão...</p>
    </main>
  )
}
`````

### `frontend/src/features/auth/AuthProvider.tsx`

`````tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  clearAuthTokens,
  readAuthTokens,
  subscribeToAuthChanges,
  writeAuthTokens,
} from '../../lib/auth-storage'
import * as authApi from './api'
import { AuthContext, type AuthContextValue } from './auth-context'
import type { LoginCredentials, RegisterPayload } from './types'

const CURRENT_USER_QUERY_KEY = ['auth', 'current-user'] as const

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const [hasTokens, setHasTokens] = useState(() => Boolean(readAuthTokens()))

  useEffect(
    () =>
      subscribeToAuthChanges(() => {
        const nextHasTokens = Boolean(readAuthTokens())
        setHasTokens(nextHasTokens)

        if (!nextHasTokens) {
          queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY })
        }
      }),
    [queryClient],
  )

  const currentUserQuery = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: authApi.getCurrentUser,
    enabled: hasTokens,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const persistSession = useCallback(
    async (credentials: LoginCredentials): Promise<void> => {
      const tokens = await authApi.login(credentials)

      if (!tokens.refresh_token) {
        throw new Error('A API não retornou o refresh token esperado.')
      }

      writeAuthTokens({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      })
      setHasTokens(true)
      await queryClient.fetchQuery({
        queryKey: CURRENT_USER_QUERY_KEY,
        queryFn: authApi.getCurrentUser,
      })
    },
    [queryClient],
  )

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<void> => {
      await persistSession(credentials)
    },
    [persistSession],
  )

  const register = useCallback(
    async (payload: RegisterPayload): Promise<void> => {
      await authApi.register(payload)
      await persistSession({ email: payload.email, password: payload.password })
    },
    [persistSession],
  )

  const logout = useCallback((): void => {
    clearAuthTokens()
    setHasTokens(false)
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: currentUserQuery.data ?? null,
      isAuthenticated: hasTokens && Boolean(currentUserQuery.data),
      isLoading: hasTokens && currentUserQuery.isPending,
      login,
      register,
      logout,
    }),
    [
      currentUserQuery.data,
      currentUserQuery.isPending,
      hasTokens,
      login,
      logout,
      register,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
`````

### `frontend/src/features/auth/api.ts`

`````typescript
import { apiRequest } from '../../api/client'
import type {
  CurrentUserResponse,
  LoginCredentials,
  RegisterPayload,
  TokenResponse,
  User,
} from './types'

export async function login(credentials: LoginCredentials): Promise<TokenResponse> {
  const formData = new URLSearchParams()
  formData.set('username', credentials.email)
  formData.set('password', credentials.password)

  return apiRequest<TokenResponse>('/auth/login', {
    method: 'POST',
    authenticated: false,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  })
}

export async function register(payload: RegisterPayload): Promise<User> {
  return apiRequest<User>('/auth/register', {
    method: 'POST',
    authenticated: false,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export async function getCurrentUser(): Promise<User> {
  const response = await apiRequest<CurrentUserResponse>('/auth/me')
  return response.user
}
`````

### `frontend/src/features/auth/auth-context.ts`

`````typescript
import { createContext, useContext } from 'react'
import type { LoginCredentials, RegisterPayload, User } from './types'

export interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
`````

### `frontend/src/features/auth/components/AuthLayout.tsx`

`````tsx
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
`````

### `frontend/src/features/auth/components/PasswordField.tsx`

`````tsx
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
`````

### `frontend/src/features/auth/pages/LoginPage.test.tsx`

`````tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../AuthProvider'
import { LoginPage } from './LoginPage'

function renderLoginPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app" element={<h1>Projetos</h1>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  it('shows validation messages before sending invalid data', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.spyOn(window, 'fetch')
    renderLoginPage()

    await user.type(screen.getByLabelText('E-mail'), 'email-invalido')
    await user.type(screen.getByLabelText('Senha'), '123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Informe um e-mail válido.')).toBeVisible()
    expect(
      screen.getByText('A senha deve ter pelo menos 8 caracteres.'),
    ).toBeVisible()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('stores the session and navigates after a valid login', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi
      .spyOn(window, 'fetch')
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
              id: '38cc5ffb-e0b0-47e4-b6e2-941fab3ce298',
              name: 'Ana Silva',
              email: 'ana@example.com',
              is_active: true,
              created_at: '2026-07-31T12:00:00Z',
              updated_at: '2026-07-31T12:00:00Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )

    renderLoginPage()

    await user.type(screen.getByLabelText('E-mail'), 'ana@example.com')
    await user.type(screen.getByLabelText('Senha'), 'StrongPassword123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('heading', { name: 'Projetos' })).toBeVisible()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(window.localStorage.getItem('taskly.auth.tokens')).toContain(
      'refresh-token',
    )
  })
})
`````

### `frontend/src/features/auth/pages/LoginPage.tsx`

`````tsx
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
`````

### `frontend/src/features/auth/pages/RegisterPage.tsx`

`````tsx
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
`````

### `frontend/src/features/auth/types.ts`

`````typescript
export interface User {
  id: string
  name: string
  email: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterPayload extends LoginCredentials {
  name: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string | null
  token_type: string
}

export interface CurrentUserResponse {
  user: User
}
`````

### `frontend/src/lib/auth-storage.test.ts`

`````typescript
import { describe, expect, it } from 'vitest'
import {
  clearAuthTokens,
  readAuthTokens,
  writeAuthTokens,
} from './auth-storage'

describe('auth storage', () => {
  it('persists and reads both tokens', () => {
    writeAuthTokens({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })

    expect(readAuthTokens()).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })
  })

  it('clears an invalid persisted payload', () => {
    window.localStorage.setItem('taskly.auth.tokens', '{invalid-json')

    expect(readAuthTokens()).toBeNull()
    expect(window.localStorage.getItem('taskly.auth.tokens')).toBeNull()
  })

  it('removes the current session', () => {
    writeAuthTokens({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })

    clearAuthTokens()

    expect(readAuthTokens()).toBeNull()
  })
})
`````

### `frontend/src/lib/auth-storage.ts`

`````typescript
export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

const STORAGE_KEY = 'taskly.auth.tokens'
const AUTH_CHANGED_EVENT = 'taskly:auth-changed'

function emitAuthChanged(): void {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

export function readAuthTokens(): AuthTokens | null {
  const rawValue = window.localStorage.getItem(STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    const value = JSON.parse(rawValue) as Partial<AuthTokens>

    if (!value.accessToken || !value.refreshToken) {
      clearAuthTokens()
      return null
    }

    return {
      accessToken: value.accessToken,
      refreshToken: value.refreshToken,
    }
  } catch {
    clearAuthTokens()
    return null
  }
}

export function writeAuthTokens(tokens: AuthTokens): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  emitAuthChanged()
}

export function clearAuthTokens(): void {
  window.localStorage.removeItem(STORAGE_KEY)
  emitAuthChanged()
}

export function subscribeToAuthChanges(callback: () => void): () => void {
  window.addEventListener(AUTH_CHANGED_EVENT, callback)
  window.addEventListener('storage', callback)

  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}
`````

### `frontend/src/main.tsx`

`````tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from './features/auth/AuthProvider'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
})

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
`````

### `frontend/src/routes/AppShell.tsx`

`````tsx
import { Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/auth-context'

export function AppShell() {
  const { user, logout } = useAuth()

  return (
    <div className="application-shell">
      <header className="app-header">
        <a className="brand brand-dark" href="/app">
          <span className="brand-mark" aria-hidden="true">
            T
          </span>
          <span>Taskly</span>
        </a>
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

### `frontend/src/routes/DashboardPage.tsx`

`````tsx
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
`````

### `frontend/src/routes/ProtectedRoute.test.tsx`

`````tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../features/auth/AuthProvider'
import { writeAuthTokens } from '../lib/auth-storage'
import { ProtectedRoute } from './ProtectedRoute'

function renderProtectedRoute() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app']}>
        <AuthProvider>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/app" element={<h1>Área privada</h1>} />
            </Route>
            <Route path="/login" element={<h1>Entrar</h1>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('redirects anonymous users to login', async () => {
    renderProtectedRoute()

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeVisible()
  })

  it('renders protected content after validating the session', async () => {
    writeAuthTokens({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })
    vi.spyOn(window, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {
            id: '38cc5ffb-e0b0-47e4-b6e2-941fab3ce298',
            name: 'Ana Silva',
            email: 'ana@example.com',
            is_active: true,
            created_at: '2026-07-31T12:00:00Z',
            updated_at: '2026-07-31T12:00:00Z',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    renderProtectedRoute()

    expect(
      await screen.findByRole('heading', { name: 'Área privada' }),
    ).toBeVisible()
  })
})
`````

### `frontend/src/routes/ProtectedRoute.tsx`

`````tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingScreen } from '../components/LoadingScreen'
import { useAuth } from '../features/auth/auth-context'

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return <Outlet />
}
`````

### `frontend/src/routes/PublicOnlyRoute.tsx`

`````tsx
import { Navigate, Outlet } from 'react-router-dom'
import { LoadingScreen } from '../components/LoadingScreen'
import { useAuth } from '../features/auth/auth-context'

export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  return isAuthenticated ? <Navigate to="/app" replace /> : <Outlet />
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
input {
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
`````

### `frontend/src/test/setup.ts`

`````typescript
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
`````

### `frontend/src/vite-env.d.ts`

`````typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
`````

### `frontend/tsconfig.app.json`

`````json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
`````

### `frontend/tsconfig.json`

`````json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
`````

### `frontend/tsconfig.node.json`

`````json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
`````

### `frontend/vite.config.ts`

`````typescript
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
`````

## 6. Comandos de validação

### 6.1. Raiz do repositório

```powershell
cd "C:\Users\Daniel Hara\Documents\Projetos\taskly-fullstack-UEX"
git status
```

### 6.2. Backend

```powershell
cd backend
..\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"

ruff check . --fix
ruff format .
ruff check .
ruff format . --check

python -m pytest
python -m pytest app/tests/test_auth.py -vv
```

Teste manual do endpoint:

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "<refresh_token>"
}
```

### 6.3. Frontend

A versão de Node deve ser compatível com o Vite declarado no projeto:

```powershell
cd ..\frontend
node --version
npm --version
```

Na primeira instalação:

```powershell
Copy-Item .env.example .env
npm install
```

O `npm install` deverá criar `package-lock.json`. Revise e versione esse arquivo para tornar instalações futuras reproduzíveis.

Validações:

```powershell
npm run lint
npx tsc --noEmit
npm run test
npm run build
npm run dev
```

### 6.4. Fluxo manual no navegador

1. iniciar PostgreSQL e backend;
2. abrir `http://localhost:5173/register`;
3. criar uma conta;
4. confirmar redirecionamento para `/app`;
5. atualizar a página e confirmar que a sessão permanece;
6. sair e confirmar redirecionamento para `/login`;
7. entrar novamente;
8. testar credenciais inválidas;
9. inspecionar Network e confirmar que senhas não são persistidas;
10. reduzir temporariamente a validade do access token e confirmar a renovação automática.

### 6.5. O que foi validado na preparação

- sintaxe Python com `compileall`;
- sintaxe dos arquivos TypeScript/TSX com o parser do compilador TypeScript disponível;
- estrutura do endpoint e dos testes de refresh;
- limite de um retry depois do refresh;
- refresh seletivo, sem interceptar `403` de negócio;
- proteção contra múltiplas renovações concorrentes;
- whitespace do patch.

Não foram executados neste ambiente `npm install`, ESLint, type-check completo com dependências, Vitest, build, Ruff, pytest ou teste manual no navegador. Esses resultados somente podem ser registrados depois da execução real pelo desenvolvedor.

## 7. Passo a passo do commit

Na raiz do repositório, depois das validações:

```powershell
# 1. Verificar alterações
git status

# 2. Adicionar backend da autenticação
git add backend/app/api/routes/auth.py
git add backend/app/schemas/auth.py
git add backend/app/tests/test_auth.py
git add backend/README.md

# 3. Adicionar frontend e configurações
git add frontend
git add .github/workflows/ci.yml
git add .gitignore
git add README.md

# 4. Adicionar documentação
git add docs/AI_USAGE.md
git add docs/CURRENT_STATE.md
git add docs/prompts/prompt-etapa-05-frontend-base-auth.md
git add docs/etapas/etapa-05-frontend-base-auth.md

# 5. Revisar o stage
git diff --cached
git status

# 6. Commit semântico
git commit -m "feat: cria frontend base e autenticação persistente"

# 7. Enviar
git push origin main
```

Depois do primeiro `npm install`, inclua também:

```powershell
git add frontend/package-lock.json
```

## 8. Problemas comuns e como resolver

### Vite informa versão incompatível do Node

Atualize para uma versão de Node aceita pelo campo `engines` de `frontend/package.json`. Depois, remova `node_modules` e instale novamente.

### `npm install` não gera ou altera o lockfile

Execute o comando dentro de `frontend/`, não na raiz. O arquivo correto é `frontend/package-lock.json`.

### CORS bloqueia o navegador

Confirme que `backend/.env` possui:

```env
CORS_ORIGINS="http://localhost:5173,http://localhost:8000"
```

Reinicie o backend após alterar o `.env`.

### Frontend chama uma URL incorreta

Confira `frontend/.env`:

```env
VITE_API_URL="http://localhost:8000/api/v1"
```

Variáveis Vite são lidas na inicialização; reinicie `npm run dev`.

### Login retorna 422

O endpoint utiliza `OAuth2PasswordRequestForm`. O cliente deve enviar `application/x-www-form-urlencoded` com `username` contendo o e-mail e `password` contendo a senha.

### Login funciona, mas a página volta para `/login`

Confira a resposta de `/auth/me`, o access token salvo no navegador e o segredo JWT usado pelo backend. Limpe `localStorage` se tokens antigos tiverem sido assinados por outro segredo.

### Toda resposta `403` tenta renovar o token

Isso indicaria alteração indevida no cliente. Preserve a comparação específica com `Invalid or expired token`; ownership e projeto arquivado devem chegar ao componente como erros de negócio.

### Testes do frontend não encontram `fetch`

Use Node compatível e o ambiente `jsdom` configurado no Vitest. Confirme também que as dependências foram instaladas antes de executar a suíte.

### `pytest` pede banco de testes

Mantenha `TEST_DATABASE_URL` em `backend/.env` e crie o banco descartável conforme as etapas anteriores.

## 9. Checklist do que foi concluído

- [x] Contrato de refresh criado.
- [x] Endpoint de refresh implementado.
- [x] Access token rejeitado como refresh token.
- [x] Testes backend de refresh preparados.
- [x] React/Vite/TypeScript inicializados.
- [x] TanStack Query configurado.
- [x] React Hook Form e Zod configurados.
- [x] Cliente HTTP centralizado.
- [x] Persistência dos tokens isolada.
- [x] Refresh automático limitado a uma tentativa.
- [x] Renovação concorrente compartilhada.
- [x] Cadastro implementado.
- [x] Login implementado.
- [x] Validação por `/auth/me` implementada.
- [x] Rotas públicas e protegidas implementadas.
- [x] Logout implementado.
- [x] Testes iniciais do frontend preparados.
- [x] Job de frontend adicionado à CI.
- [x] Documento da etapa separado do prompt.
- [ ] Dependências npm instaladas pelo desenvolvedor.
- [ ] `package-lock.json` gerado e versionado.
- [ ] Ruff e pytest executados com saída real.
- [ ] ESLint, TypeScript, Vitest e build executados com saída real.
- [ ] Fluxo manual validado no navegador.
- [ ] Commit executado pelo desenvolvedor.

## 10. Próxima etapa

**Etapa 06 — Projetos no frontend**

A próxima etapa deverá implementar:

1. listagem paginada de projetos;
2. criação e edição;
3. seleção do projeto atual;
4. arquivamento e estado somente leitura;
5. exclusão com confirmação;
6. estados de loading, erro e vazio;
7. testes dos fluxos críticos;
8. atualização de `AI_USAGE.md` e `CURRENT_STATE.md`;
9. alteração de `DECISIONS.md` somente se surgir uma decisão nova.
