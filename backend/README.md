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