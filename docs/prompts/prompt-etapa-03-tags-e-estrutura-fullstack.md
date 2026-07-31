# Etapa 03 — Tags relacionais e estrutura fullstack

## 1. Objetivo da etapa

Converter o repositório herdado, que possuía somente o backend na raiz, em uma estrutura fullstack preparada para o Taskly e implementar tags relacionais reutilizáveis por usuário.

A etapa preserva a arquitetura `api → service → repository → model`, adiciona migration Alembic, mantém ownership no backend e cria testes para os fluxos críticos de tags.

## 2. O que foi feito e por quê

### 2.1. Reorganização do repositório

Foi adotada a seguinte estrutura:

```text
taskly-fullstack-UEX/
├── backend/
│   ├── app/
│   ├── alembic/
│   ├── alembic.ini
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── docker-entrypoint.sh
│   ├── .env.example
│   └── README.md
├── frontend/
│   └── README.md
├── docs/
├── .github/
├── .gitignore
├── .pre-commit-config.yaml
├── docker-compose.yml
└── README.md
```

Os arquivos de runtime Python foram movidos para `backend/`. Permanecem na raiz os itens que coordenam o monorepo inteiro:

- `docs/`;
- `.github/`;
- `.gitignore`;
- `.pre-commit-config.yaml`;
- `docker-compose.yml`;
- README principal.

A pasta `frontend/` foi criada agora para que a estrutura não precise ser alterada novamente quando React/Vite for iniciado.

### 2.2. Tags relacionais

Foram criadas:

- tabela `tags`, com ownership direto em `users`;
- tabela associativa `task_tags`;
- restrição única por `owner_id + normalized_name`;
- model e relacionamentos SQLAlchemy;
- schemas de nome e resposta;
- repository para consulta e resolução de tags;
- service de listagem;
- rota `GET /api/v1/tags` para autocomplete;
- integração das tags em criação, resposta e atualização de tarefas;
- testes de normalização, deduplicação, substituição, remoção, limite e ownership.

O payload de tarefa recebe nomes:

```json
{
  "tags": ["Backend", "Urgente"]
}
```

A resposta devolve objetos:

```json
{
  "tags": [
    {"id": "...", "name": "Backend", "created_at": "...", "updated_at": "..."}
  ]
}
```

Essa escolha evita que o frontend associe diretamente um ID pertencente a outra conta.

## 3. Decisões técnicas

### 3.1. Monorepo versus backend na raiz

**Alternativa A — manter o backend na raiz**

Prós:

- menos movimentos imediatos;
- comandos existentes continuam iguais.

Contras:

- mistura dependências do backend com arquivos globais;
- estrutura final fica assimétrica quando o frontend surgir;
- CI e documentação ficam menos explícitas.

**Alternativa B — criar `backend/` e `frontend/` agora**

Prós:

- corresponde à arquitetura final do desafio;
- separa comandos e dependências;
- facilita Docker Compose e CI fullstack.

Contras:

- exige ajustar caminhos;
- exige mover manualmente o `.env` local.

**Decisão do desenvolvedor:** adotar o monorepo nesta etapa.

### 3.2. JSONB versus many-to-many

**JSONB/array** seria mais rápido, mas produziria duplicidade e dificultaria autocomplete, normalização e filtros.

**Many-to-many** exige migration e associação, mas preserva consistência, reutilização e ownership.

**Decisão do desenvolvedor:** usar `tags` e `task_tags`.

### 3.3. IDs versus nomes no payload

Receber IDs exigiria uma operação prévia de criação e uma validação explícita para cada associação.

Receber nomes permite que o backend reutilize ou crie tags dentro do contexto do usuário autenticado.

**Decisão do desenvolvedor:** receber nomes, devolver objetos.

### 3.4. CRUD completo versus autocomplete

O escopo funcional não exige administração isolada de tags. Um CRUD completo aumentaria o número de rotas, estados e testes sem melhorar o fluxo principal.

**Decisão do desenvolvedor:** expor nesta etapa somente `GET /tags`; criação e associação ocorrem pelo fluxo de tarefas.

### 3.5. Regras de normalização

- espaços externos são removidos;
- espaços internos consecutivos são reduzidos a um;
- comparação usa `casefold()`;
- o primeiro nome exibido é preservado;
- duplicatas no mesmo payload são removidas;
- máximo de dez tags por tarefa;
- máximo de 40 caracteres por tag;
- `tags: []` limpa associações;
- `tags: null` é rejeitado.

## 4. Dependências e ordem de alteração

1. mover o backend para `backend/`;
2. ajustar Docker Compose, CI, pre-commit, `.gitignore` e README da raiz;
3. tornar a localização do `.env` independente do diretório corrente;
4. criar migration `0003_add_relational_tags`;
5. criar model `Tag` e tabela `task_tags`;
6. atualizar relacionamentos de `User` e `Task`;
7. criar schemas de tag e atualizar schemas de tarefa;
8. criar `TagRepository` e integrar a resolução ao `TaskService`;
9. criar `TagService` e rota de listagem;
10. adicionar eager loading em consultas de tarefas;
11. adicionar testes;
12. atualizar documentação cumulativa.

## 5. Movimentos sem alteração de conteúdo

Os seguintes grupos foram apenas movidos para `backend/`, preservando o conteúdo recebido da Etapa 02:

- `app/api/routes/auth.py` e `projects.py`;
- configurações de database, dependencies e security;
- models base e project;
- repositories de user e project;
- schemas auth, common, project e user;
- services exceptions, project e user;
- testes auth, projects, tasks, ownership e full flow;
- revisions `0001` e `0002`;
- `Dockerfile`, entrypoint e README técnico herdado.

Como não houve alteração textual nesses arquivos, eles não são repetidos abaixo. O patch usa renames para preservar o histórico Git.

## 6. Conteúdo completo dos arquivos criados ou alterados

O próprio documento da etapa não é reproduzido recursivamente. Os demais arquivos criados ou alterados são apresentados abaixo.

### `README.md`

``````markdown
# Taskly Fullstack

Repositório do case técnico Taskly, organizado como monorepo para manter backend, frontend e documentação no mesmo histórico Git.

## Estrutura atual

```text
taskly-fullstack-UEX/
├── backend/          # FastAPI, SQLAlchemy, Alembic e pytest
├── frontend/         # React/Vite será inicializado na Etapa 05
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

A partir da inicialização do React/Vite, use para npm, TypeScript e Vitest:

```powershell
cd frontend
npm run dev
npm run lint
npx tsc --noEmit
npx vitest run
```

## Estado funcional

O backend já possui autenticação, projetos, tarefas, ownership, prazos em UTC e tags relacionais por usuário. Anexos e frontend ainda serão implementados nas próximas etapas.
``````

### `.gitignore`

``````text
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
``````

### `.pre-commit-config.yaml`

``````yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.9
    hooks:
      - id: ruff
        files: ^backend/
        args: ["--fix", "--config", "backend/pyproject.toml"]
      - id: ruff-format
        files: ^backend/
        args: ["--config", "backend/pyproject.toml"]
``````

### `.github/workflows/ci.yml`

``````yaml
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
``````

### `docker-compose.yml`

``````yaml
services:
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: taskly-api
    environment:
      APP_NAME: "Taskly API"
      APP_ENV: "docker"
      APP_DEBUG: "true"
      APP_VERSION: "0.1.0"
      DATABASE_URL: "postgresql+psycopg://postgres:postgres@db:5432/projects_api"
      TEST_DATABASE_URL: "postgresql+psycopg://postgres:postgres@db:5432/projects_api_test"
      JWT_SECRET_KEY: "change-this-secret-key"
      JWT_ALGORITHM: "HS256"
      ACCESS_TOKEN_EXPIRE_MINUTES: "30"
      REFRESH_TOKEN_EXPIRE_DAYS: "7"
      CORS_ORIGINS: "http://localhost:5173,http://localhost:8000"
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./backend:/app
    command: []
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    container_name: taskly-db
    environment:
      POSTGRES_DB: projects_api
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d projects_api"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

volumes:
  postgres_data:
``````

### `frontend/README.md`

``````markdown
# Taskly Frontend

Esta pasta foi criada na Etapa 03 para estabelecer a estrutura fullstack do repositório.

A aplicação React + Vite + TypeScript será inicializada na Etapa 05, junto da base de autenticação do frontend.
``````

### `backend/.env.example`

``````text
APP_NAME="Taskly API"
APP_ENV="local"
APP_DEBUG=true
APP_VERSION="0.1.0"

# Use esta URL quando rodar a API localmente pelo VS Code/terminal.
DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5433/projects_api"

# Banco separado para testes locais.
TEST_DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5433/projects_api_test"

JWT_SECRET_KEY="change-this-secret-key"
JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

CORS_ORIGINS="http://localhost:5173,http://localhost:8000"
``````

### `backend/alembic.ini`

``````ini
[alembic]
script_location = %(here)s/alembic
prepend_sys_path = %(here)s
path_separator = os
sqlalchemy.url = postgresql+psycopg://postgres:postgres@localhost:5432/projects_api

[post_write_hooks]

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARNING
handlers = console
qualname =

[logger_sqlalchemy]
level = WARNING
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
``````

### `backend/pyproject.toml`

``````toml
[build-system]
requires = ["setuptools>=68", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "taskly-api"
version = "0.1.0"
description = "Backend do Taskly com FastAPI, PostgreSQL, SQLAlchemy, Alembic e JWT."
readme = "README.md"
requires-python = ">=3.12"
dependencies = [
    "alembic>=1.13.0",
    "bcrypt>=4.0.1,<4.1.0",
    "email-validator>=2.1.0",
    "fastapi>=0.115.0",
    "passlib[bcrypt]>=1.7.4",
    "psycopg[binary]>=3.2.0",
    "pydantic-settings>=2.6.0",
    "python-jose[cryptography]>=3.3.0",
    "python-multipart>=0.0.9",
    "sqlalchemy>=2.0.0",
    "uvicorn[standard]>=0.30.0",
]

[project.optional-dependencies]
dev = [
    "httpx>=0.27.0",
    "httpx2>=2.0.0",
    "pytest>=8.0.0",
    "pytest-cov>=5.0.0",
    "ruff>=0.6.0",
    "pre-commit>=3.8.0",
]

[tool.setuptools.packages.find]
include = ["app*"]
exclude = ["alembic*"]

[tool.ruff]
line-length = 88
target-version = "py312"
src = ["app"]

[tool.ruff.lint]
select = [
    "E",
    "F",
    "I",
    "B",
    "UP",
]
ignore = []

[tool.pytest.ini_options]
testpaths = ["app/tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
addopts = "-q"
``````

### `backend/alembic/versions/0003_add_relational_tags.py`

``````python
"""Add relational tags scoped by user.

Revision ID: 0003_add_relational_tags
Revises: 0002_adapt_tasks_to_taskly
Create Date: 2026-07-31
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_add_relational_tags"
down_revision: str | None = "0002_adapt_tasks_to_taskly"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create user-owned tags and their many-to-many task association."""
    op.create_table(
        "tags",
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=40), nullable=False),
        sa.Column("normalized_name", sa.String(length=40), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "owner_id",
            "normalized_name",
            name="uq_tags_owner_normalized_name",
        ),
    )
    op.create_index("ix_tags_owner_id", "tags", ["owner_id"], unique=False)

    op.create_table(
        "task_tags",
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tag_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("task_id", "tag_id"),
    )
    op.create_index("ix_task_tags_tag_id", "task_tags", ["tag_id"], unique=False)


def downgrade() -> None:
    """Remove associations before dropping their parent tag records."""
    op.drop_index("ix_task_tags_tag_id", table_name="task_tags")
    op.drop_table("task_tags")
    op.drop_index("ix_tags_owner_id", table_name="tags")
    op.drop_table("tags")
``````

### `backend/app/core/config.py`

``````python
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = Field(default="FastAPI Projects API", alias="APP_NAME")
    app_env: str = Field(default="local", alias="APP_ENV")
    app_debug: bool = Field(default=True, alias="APP_DEBUG")
    app_version: str = Field(default="0.1.0", alias="APP_VERSION")

    database_url: str = Field(alias="DATABASE_URL")
    test_database_url: str | None = Field(default=None, alias="TEST_DATABASE_URL")

    jwt_secret_key: str = Field(alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(
        default=30,
        alias="ACCESS_TOKEN_EXPIRE_MINUTES",
    )
    refresh_token_expire_days: int = Field(default=7, alias="REFRESH_TOKEN_EXPIRE_DAYS")

    cors_origins: str = Field(default="", alias="CORS_ORIGINS")

    model_config = SettingsConfigDict(
        # O caminho absoluto evita que a leitura dependa de executar o comando
        # na raiz do repositório ou dentro de `backend/`.
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        if not self.cors_origins:
            return []

        return [
            origin.strip() for origin in self.cors_origins.split(",") if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
``````

### `backend/app/api/router.py`

``````python
from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.projects import router as projects_router
from app.api.routes.tags import router as tags_router
from app.api.routes.tasks import router as tasks_router

api_router = APIRouter()


@api_router.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


api_router.include_router(auth_router)
api_router.include_router(projects_router)
api_router.include_router(tasks_router)
api_router.include_router(tags_router)
``````

### `backend/app/api/routes/tags.py`

``````python
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.tag import TagResponse
from app.services.tag_service import TagService

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagResponse])
def list_tags(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    search: Annotated[
        str | None,
        Query(min_length=1, max_length=40, examples=["backend"]),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[TagResponse]:
    """Lista somente tags do usuário para seleção e autocomplete."""
    service = TagService(db)
    tags = service.list_tags(
        owner_id=current_user.id,
        search=search,
        limit=limit,
    )

    return [TagResponse.model_validate(tag) for tag in tags]
``````

### `backend/app/models/__init__.py`

``````python
from app.models.project import Project, ProjectStatus
from app.models.tag import Tag, task_tags_table
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User

__all__ = [
    "Project",
    "ProjectStatus",
    "Tag",
    "Task",
    "TaskPriority",
    "TaskStatus",
    "User",
    "task_tags_table",
]
``````

### `backend/app/models/tag.py`

``````python
from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Column, ForeignKey, String, Table, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.task import Task
    from app.models.user import User


# A tabela associativa não possui identidade própria porque a combinação
# task/tag já representa integralmente o vínculo e impede duplicidade.
task_tags_table = Table(
    "task_tags",
    Base.metadata,
    Column(
        "task_id",
        Uuid(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "tag_id",
        Uuid(as_uuid=True),
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    ),
)


def normalize_tag_name(value: str) -> str:
    """Produz a chave usada para comparar tags sem perder o nome exibido."""
    return " ".join(value.split()).casefold()


class Tag(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tags"
    __table_args__ = (
        UniqueConstraint(
            "owner_id",
            "normalized_name",
            name="uq_tags_owner_normalized_name",
        ),
    )

    owner_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(40), nullable=False)
    # A coluna normalizada garante unicidade por usuário sem depender de
    # extensões específicas do PostgreSQL ou de collation do ambiente.
    normalized_name: Mapped[str] = mapped_column(String(40), nullable=False)

    owner: Mapped[User] = relationship(back_populates="tags")
    tasks: Mapped[list[Task]] = relationship(
        secondary=task_tags_table,
        back_populates="tags",
    )
``````

### `backend/app/models/task.py`

``````python
from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.tag import task_tags_table

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.tag import Tag


class TaskStatus(StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    CANCELLED = "cancelled"


class TaskPriority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Task(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tasks"

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    # A descrição curta é obrigatória para que lista e kanban tenham um resumo
    # consistente sem depender do texto completo ou de truncamento no frontend.
    short_description: Mapped[str] = mapped_column(String(280), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(
        Enum(
            TaskStatus,
            name="task_status",
            values_callable=lambda enum_type: [item.value for item in enum_type],
        ),
        default=TaskStatus.TODO,
        nullable=False,
    )
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(
            TaskPriority,
            name="task_priority",
            values_callable=lambda enum_type: [item.value for item in enum_type],
        ),
        default=TaskPriority.MEDIUM,
        nullable=False,
    )
    # O banco preserva o offset recebido, enquanto o contrato da API normaliza
    # os valores para UTC antes da persistência.
    due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    project: Mapped[Project] = relationship(back_populates="tasks")
    tags: Mapped[list[Tag]] = relationship(
        secondary=task_tags_table,
        back_populates="tasks",
        order_by="Tag.name",
    )
``````

### `backend/app/models/user.py`

``````python
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.tag import Tag


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    tags: Mapped[list[Tag]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
    )
    projects: Mapped[list[Project]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
    )
``````

### `backend/app/schemas/__init__.py`

``````python
from app.schemas.auth import CurrentUserResponse, LoginRequest, TokenResponse
from app.schemas.common import (
    ErrorResponse,
    MessageResponse,
    PaginatedResponse,
    PaginationParams,
)
from app.schemas.project import (
    ProjectCreate,
    ProjectFilters,
    ProjectResponse,
    ProjectUpdate,
)
from app.schemas.tag import TagName, TagResponse
from app.schemas.task import TaskCreate, TaskFilters, TaskResponse, TaskUpdate
from app.schemas.user import UserCreate, UserResponse, UserUpdate

__all__ = [
    "CurrentUserResponse",
    "ErrorResponse",
    "LoginRequest",
    "MessageResponse",
    "PaginatedResponse",
    "PaginationParams",
    "ProjectCreate",
    "ProjectFilters",
    "ProjectResponse",
    "ProjectUpdate",
    "TagName",
    "TagResponse",
    "TaskCreate",
    "TaskFilters",
    "TaskResponse",
    "TaskUpdate",
    "TokenResponse",
    "UserCreate",
    "UserResponse",
    "UserUpdate",
]
``````

### `backend/app/schemas/tag.py`

``````python
from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
)


def clean_tag_name(value: object) -> object:
    """Remove espaços redundantes antes de validar o limite de caracteres."""
    if not isinstance(value, str):
        return value

    return " ".join(value.split())


TagName = Annotated[
    str,
    BeforeValidator(clean_tag_name),
    StringConstraints(min_length=1, max_length=40),
]


def deduplicate_tag_names(names: list[str]) -> list[str]:
    """Mantém a ordem de entrada e remove duplicatas sem diferenciar caixa."""
    unique_names: list[str] = []
    normalized_names: set[str] = set()

    for name in names:
        normalized_name = name.casefold()
        if normalized_name in normalized_names:
            continue

        normalized_names.add(normalized_name)
        unique_names.append(name)

    return unique_names


class TagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    created_at: datetime
    updated_at: datetime


class TagListParams(BaseModel):
    search: str | None = Field(default=None, min_length=1, max_length=40)
    limit: int = Field(default=50, ge=1, le=100)
``````

### `backend/app/schemas/task.py`

``````python
from datetime import UTC, datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.models.task import TaskPriority, TaskStatus
from app.schemas.tag import TagName, TagResponse, deduplicate_tag_names


def normalize_due_at(value: datetime | None) -> datetime | None:
    """Valida timezone e converte o prazo para o contrato UTC da API."""
    if value is None:
        return None

    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("due_at must include a timezone offset")

    return value.astimezone(UTC)


UtcDateTime = Annotated[datetime, AfterValidator(normalize_due_at)]


class TaskBase(BaseModel):
    title: str = Field(
        min_length=2,
        max_length=180,
        examples=["Create authentication endpoints"],
    )
    short_description: str = Field(
        min_length=2,
        max_length=280,
        examples=["Implement the authentication flow for the application."],
    )
    description: str | None = Field(
        default=None,
        max_length=5000,
        examples=["Implement register, login and current user endpoints."],
    )
    priority: TaskPriority = Field(
        default=TaskPriority.MEDIUM,
        examples=[TaskPriority.HIGH],
    )
    due_at: UtcDateTime | None = Field(
        default=None,
        examples=["2026-06-15T21:30:00Z"],
    )


class TaskCreate(TaskBase):
    project_id: UUID = Field(
        examples=["4b01951d-5f36-465d-b438-6de1aa2cd170"],
    )
    tags: list[TagName] = Field(default_factory=list, max_length=10)

    @field_validator("tags")
    @classmethod
    def make_tags_unique(cls, value: list[str]) -> list[str]:
        return deduplicate_tag_names(value)


class TaskUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=2,
        max_length=180,
        examples=["Update authentication endpoints"],
    )
    short_description: str | None = Field(
        default=None,
        min_length=2,
        max_length=280,
        examples=["Add refresh token support to the authentication flow."],
    )
    description: str | None = Field(
        default=None,
        max_length=5000,
        examples=["Add refresh token support."],
    )
    status: TaskStatus | None = Field(
        default=None,
        examples=[TaskStatus.IN_PROGRESS],
    )
    priority: TaskPriority | None = Field(
        default=None,
        examples=[TaskPriority.HIGH],
    )
    due_at: UtcDateTime | None = Field(
        default=None,
        examples=["2026-06-30T18:00:00Z"],
    )
    # `[]` remove todas as tags. `null` é rejeitado para evitar semântica
    # ambígua em uma atualização parcial.
    tags: list[TagName] | None = Field(default=None, max_length=10)

    @field_validator("tags")
    @classmethod
    def make_tags_unique(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None

        return deduplicate_tag_names(value)

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> Self:
        """Distingue campo ausente de `null` em atualizações parciais."""
        non_nullable_fields = {"title", "short_description", "tags"}

        for field_name in non_nullable_fields & self.model_fields_set:
            if getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")

        return self


class TaskFilters(BaseModel):
    project_id: UUID | None = Field(
        default=None,
        examples=["4b01951d-5f36-465d-b438-6de1aa2cd170"],
    )
    status: TaskStatus | None = Field(
        default=None,
        examples=[TaskStatus.TODO],
    )
    priority: TaskPriority | None = Field(
        default=None,
        examples=[TaskPriority.HIGH],
    )
    due_before: UtcDateTime | None = Field(
        default=None,
        examples=["2026-06-30T23:59:59Z"],
    )
    search: str | None = Field(
        default=None,
        min_length=1,
        max_length=180,
        examples=["authentication"],
    )


class TaskResponse(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    status: TaskStatus
    tags: list[TagResponse]
    created_at: datetime
    updated_at: datetime
``````

### `backend/app/repositories/__init__.py`

``````python
from app.repositories.project_repository import ProjectRepository
from app.repositories.tag_repository import TagRepository
from app.repositories.task_repository import TaskRepository
from app.repositories.user_repository import UserRepository

__all__ = [
    "ProjectRepository",
    "TagRepository",
    "TaskRepository",
    "UserRepository",
]
``````

### `backend/app/repositories/tag_repository.py`

``````python
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tag import Tag, normalize_tag_name


class TagRepository:
    """Acesso a tags sempre limitado ao proprietário autenticado."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_owner(
        self,
        owner_id: UUID,
        search: str | None = None,
        limit: int = 50,
    ) -> list[Tag]:
        statement = select(Tag).where(Tag.owner_id == owner_id)

        if search:
            statement = statement.where(Tag.name.ilike(f"%{search}%"))

        statement = statement.order_by(Tag.name.asc()).limit(limit)

        return list(self.db.scalars(statement).all())

    def resolve_for_owner(self, owner_id: UUID, names: list[str]) -> list[Tag]:
        """Reutiliza tags existentes e prepara as ausentes na mesma transação."""
        if not names:
            return []

        display_by_normalized = {
            normalize_tag_name(name): name
            for name in names
        }
        normalized_names = list(display_by_normalized)

        statement = select(Tag).where(
            Tag.owner_id == owner_id,
            Tag.normalized_name.in_(normalized_names),
        )
        existing_tags = list(self.db.scalars(statement).all())
        tags_by_normalized = {
            tag.normalized_name: tag
            for tag in existing_tags
        }

        for normalized_name, display_name in display_by_normalized.items():
            if normalized_name in tags_by_normalized:
                continue

            tag = Tag(
                owner_id=owner_id,
                name=display_name,
                normalized_name=normalized_name,
            )
            self.db.add(tag)
            tags_by_normalized[normalized_name] = tag

        # Flush atribui UUIDs e detecta violações antes do commit da tarefa,
        # preservando a atomicidade entre a associação e a criação das tags.
        self.db.flush()

        return [tags_by_normalized[name] for name in normalized_names]
``````

### `backend/app/repositories/task_repository.py`

``````python
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.project import Project
from app.models.tag import Tag
from app.models.task import Task, TaskPriority, TaskStatus
from app.schemas.task import TaskCreate, TaskUpdate


class TaskRepository:
    """Camada de acesso a dados para tarefas.

    Tarefas pertencem a projetos. Como projetos pertencem a usuários,
    consultas protegidas fazem join com `Project` para validar ownership.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, task_data: TaskCreate, tags: list[Tag]) -> Task:
        """Persiste tarefa e associações de tags em uma única transação."""
        task = Task(
            project_id=task_data.project_id,
            title=task_data.title,
            short_description=task_data.short_description,
            description=task_data.description,
            priority=task_data.priority,
            due_at=task_data.due_at,
            tags=tags,
        )

        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        return task

    def get_by_id(self, task_id: UUID) -> Task | None:
        """Busca uma tarefa apenas pelo ID para usos internos controlados."""
        statement = (
            select(Task)
            .options(selectinload(Task.tags))
            .where(Task.id == task_id)
        )

        return self.db.scalar(statement)

    def get_by_id_and_owner(self, task_id: UUID, owner_id: UUID) -> Task | None:
        """Busca a tarefa somente quando seu projeto pertence ao usuário."""
        statement = (
            select(Task)
            .options(selectinload(Task.tags))
            .join(Project, Task.project_id == Project.id)
            .where(
                Task.id == task_id,
                Project.owner_id == owner_id,
            )
        )

        return self.db.scalar(statement)

    def list_by_owner(
        self,
        owner_id: UUID,
        page: int = 1,
        size: int = 20,
        project_id: UUID | None = None,
        status: TaskStatus | None = None,
        priority: TaskPriority | None = None,
        due_before: datetime | None = None,
        search: str | None = None,
    ) -> list[Task]:
        """Lista tarefas autorizadas com filtros, tags e paginação."""
        offset = (page - 1) * size

        statement = (
            select(Task)
            .options(selectinload(Task.tags))
            .join(Project, Task.project_id == Project.id)
            .where(Project.owner_id == owner_id)
        )

        if project_id is not None:
            statement = statement.where(Task.project_id == project_id)

        if status is not None:
            statement = statement.where(Task.status == status)

        if priority is not None:
            statement = statement.where(Task.priority == priority)

        if due_before is not None:
            statement = statement.where(Task.due_at <= due_before)

        if search:
            statement = statement.where(Task.title.ilike(f"%{search}%"))

        statement = (
            statement.order_by(Task.created_at.desc()).offset(offset).limit(size)
        )

        return list(self.db.scalars(statement).all())

    def count_by_owner(
        self,
        owner_id: UUID,
        project_id: UUID | None = None,
        status: TaskStatus | None = None,
        priority: TaskPriority | None = None,
        due_before: datetime | None = None,
        search: str | None = None,
    ) -> int:
        """Conta tarefas usando exatamente os mesmos filtros da listagem."""
        statement = (
            select(func.count())
            .select_from(Task)
            .join(Project, Task.project_id == Project.id)
            .where(Project.owner_id == owner_id)
        )

        if project_id is not None:
            statement = statement.where(Task.project_id == project_id)

        if status is not None:
            statement = statement.where(Task.status == status)

        if priority is not None:
            statement = statement.where(Task.priority == priority)

        if due_before is not None:
            statement = statement.where(Task.due_at <= due_before)

        if search:
            statement = statement.where(Task.title.ilike(f"%{search}%"))

        return self.db.scalar(statement) or 0

    def update(
        self,
        task: Task,
        task_data: TaskUpdate,
        tags: list[Tag] | None = None,
    ) -> Task:
        """Atualiza campos enviados e substitui tags somente quando solicitadas."""
        update_data = task_data.model_dump(exclude_unset=True)
        update_data.pop("tags", None)

        for field, value in update_data.items():
            setattr(task, field, value)

        if tags is not None:
            task.tags = tags

        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        return task

    def delete(self, task: Task) -> None:
        """Remove uma tarefa já autorizada pelo service."""
        self.db.delete(task)
        self.db.commit()
``````

### `backend/app/services/__init__.py`

``````python
from app.services.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ServiceError,
)
from app.services.project_service import ProjectService
from app.services.tag_service import TagService
from app.services.task_service import TaskService
from app.services.user_service import UserService

__all__ = [
    "BadRequestError",
    "ConflictError",
    "ForbiddenError",
    "NotFoundError",
    "ProjectService",
    "ServiceError",
    "TagService",
    "TaskService",
    "UserService",
]
``````

### `backend/app/services/tag_service.py`

``````python
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.tag import Tag
from app.repositories.tag_repository import TagRepository


class TagService:
    """Expõe somente a consulta necessária para autocomplete de tarefas."""

    def __init__(self, db: Session) -> None:
        self.repository = TagRepository(db)

    def list_tags(
        self,
        owner_id: UUID,
        search: str | None = None,
        limit: int = 50,
    ) -> list[Tag]:
        return self.repository.list_by_owner(
            owner_id=owner_id,
            search=search,
            limit=limit,
        )
``````

### `backend/app/services/task_service.py`

``````python
from datetime import datetime
from math import ceil
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.project import ProjectStatus
from app.models.tag import Tag
from app.models.task import Task, TaskPriority, TaskStatus
from app.repositories.project_repository import ProjectRepository
from app.repositories.tag_repository import TagRepository
from app.repositories.task_repository import TaskRepository
from app.schemas.common import PaginatedResponse
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate
from app.services.exceptions import BadRequestError, NotFoundError


class TaskService:
    """Regras de negócio relacionadas a tarefas."""

    def __init__(self, db: Session) -> None:
        self.repository = TaskRepository(db)
        self.project_repository = ProjectRepository(db)
        self.tag_repository = TagRepository(db)

    def create_task(self, owner_id: UUID, task_data: TaskCreate) -> Task:
        """Cria uma tarefa somente em projeto ativo do próprio usuário."""
        project = self.project_repository.get_by_id_and_owner(
            project_id=task_data.project_id,
            owner_id=owner_id,
        )

        if project is None:
            raise NotFoundError("Project not found")

        if project.status == ProjectStatus.ARCHIVED:
            raise BadRequestError("Cannot create tasks in archived projects")

        tags = self.tag_repository.resolve_for_owner(
            owner_id=owner_id,
            names=task_data.tags,
        )

        return self.repository.create(task_data, tags=tags)

    def get_task_for_owner(self, task_id: UUID, owner_id: UUID) -> Task:
        """Busca uma tarefa sem revelar recursos pertencentes a outra conta."""
        task = self.repository.get_by_id_and_owner(
            task_id=task_id,
            owner_id=owner_id,
        )

        if task is None:
            raise NotFoundError("Task not found")

        return task

    def list_tasks(
        self,
        owner_id: UUID,
        page: int = 1,
        size: int = 20,
        project_id: UUID | None = None,
        status: TaskStatus | None = None,
        priority: TaskPriority | None = None,
        due_before: datetime | None = None,
        search: str | None = None,
    ) -> PaginatedResponse[TaskResponse]:
        """Lista tarefas do usuário com paginação e filtros."""
        items = self.repository.list_by_owner(
            owner_id=owner_id,
            page=page,
            size=size,
            project_id=project_id,
            status=status,
            priority=priority,
            due_before=due_before,
            search=search,
        )
        total = self.repository.count_by_owner(
            owner_id=owner_id,
            project_id=project_id,
            status=status,
            priority=priority,
            due_before=due_before,
            search=search,
        )

        pages = ceil(total / size) if total > 0 else 0

        return PaginatedResponse[TaskResponse](
            items=[TaskResponse.model_validate(item) for item in items],
            total=total,
            page=page,
            size=size,
            pages=pages,
        )

    def update_task(
        self,
        task_id: UUID,
        owner_id: UUID,
        task_data: TaskUpdate,
    ) -> Task:
        """Atualiza tarefa e tags próprias enquanto o projeto estiver ativo."""
        task = self.get_task_for_owner(task_id=task_id, owner_id=owner_id)
        self._ensure_project_is_active(task=task, owner_id=owner_id)

        tags: list[Tag] | None = None
        if "tags" in task_data.model_fields_set:
            tags = self.tag_repository.resolve_for_owner(
                owner_id=owner_id,
                names=task_data.tags or [],
            )

        return self.repository.update(task, task_data, tags=tags)

    def mark_task_as_done(self, task_id: UUID, owner_id: UUID) -> Task:
        """Marca tarefa como concluída respeitando a regra de arquivamento."""
        return self.update_task(
            task_id=task_id,
            owner_id=owner_id,
            task_data=TaskUpdate(status=TaskStatus.DONE),
        )

    def delete_task(self, task_id: UUID, owner_id: UUID) -> None:
        """Remove tarefa própria apenas enquanto o projeto estiver ativo."""
        task = self.get_task_for_owner(task_id=task_id, owner_id=owner_id)
        self._ensure_project_is_active(task=task, owner_id=owner_id)

        self.repository.delete(task)

    def _ensure_project_is_active(self, task: Task, owner_id: UUID) -> None:
        """Centraliza a política de projeto arquivado como somente leitura."""
        project = self.project_repository.get_by_id_and_owner(
            project_id=task.project_id,
            owner_id=owner_id,
        )

        if project is None:
            raise NotFoundError("Project not found")

        if project.status == ProjectStatus.ARCHIVED:
            raise BadRequestError("Cannot modify tasks in archived projects")
``````

### `backend/app/tests/conftest.py`

``````python
from collections.abc import Callable, Generator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.core.database import get_db
from app.main import app

BACKEND_ROOT = Path(__file__).resolve().parents[2]
settings = get_settings()

if settings.test_database_url is None:
    raise RuntimeError("TEST_DATABASE_URL must be configured to run tests")

if (
    settings.test_database_url == settings.database_url
    and settings.app_env.lower() != "test"
):
    raise RuntimeError(
        "TEST_DATABASE_URL must differ from DATABASE_URL outside the test environment"
    )


test_engine = create_engine(
    settings.test_database_url,
    pool_pre_ping=True,
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
)


def reset_test_schema() -> None:
    """Recria o schema público do banco exclusivo de testes.

    O reset é PostgreSQL-specific de propósito: a stack obrigatória usa
    PostgreSQL e o banco apontado por TEST_DATABASE_URL deve ser descartável.
    """
    with test_engine.begin() as connection:
        connection.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))


def run_test_migrations() -> None:
    """Aplica a mesma cadeia Alembic utilizada no deploy da aplicação."""
    alembic_config = Config(BACKEND_ROOT / "alembic.ini")
    alembic_config.set_main_option(
        "script_location",
        str(BACKEND_ROOT / "alembic"),
    )
    alembic_config.attributes["database_url"] = settings.test_database_url
    command.upgrade(alembic_config, "head")


@pytest.fixture(scope="session", autouse=True)
def setup_test_database() -> Generator[None, None, None]:
    """Valida as migrations em banco vazio antes de executar a suíte."""
    reset_test_schema()
    run_test_migrations()

    yield

    reset_test_schema()


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    """Isola cada teste em uma transação revertida ao final."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Substitui a sessão da aplicação pela sessão transacional do teste."""

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture()
def user_payload() -> dict[str, str]:
    """Payload padrão para criação de usuário nos testes."""
    return {
        "name": "Ana Silva",
        "email": "ana.silva@example.com",
        "password": "StrongPassword123",
    }


@pytest.fixture()
def authenticated_user_factory(
    client: TestClient,
) -> Callable[[str, str], dict[str, str]]:
    """Cria usuários independentes para cenários reais de ownership."""

    def create_authenticated_user(email: str, name: str) -> dict[str, str]:
        password = "StrongPassword123"
        register_response = client.post(
            "/api/v1/auth/register",
            json={"name": name, "email": email, "password": password},
        )
        assert register_response.status_code == 201

        login_response = client.post(
            "/api/v1/auth/login",
            data={"username": email, "password": password},
        )
        assert login_response.status_code == 200

        return {
            "access_token": login_response.json()["access_token"],
            "user_id": register_response.json()["id"],
        }

    return create_authenticated_user


@pytest.fixture()
def access_token(client: TestClient, user_payload: dict[str, str]) -> str:
    """Registra usuário, faz login e retorna o access token."""
    client.post("/api/v1/auth/register", json=user_payload)

    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": user_payload["email"],
            "password": user_payload["password"],
        },
    )

    assert response.status_code == 200

    return response.json()["access_token"]


@pytest.fixture()
def auth_headers(access_token: str) -> dict[str, str]:
    """Headers de autenticação usados em rotas protegidas."""
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture()
def project_payload() -> dict[str, str]:
    """Payload padrão para criação de projeto."""
    return {
        "name": "Portfolio API",
        "description": "Backend project built with FastAPI and PostgreSQL.",
    }


@pytest.fixture()
def created_project(
    client: TestClient,
    auth_headers: dict[str, str],
    project_payload: dict[str, str],
) -> dict[str, str]:
    """Cria um projeto autenticado e retorna a resposta JSON."""
    response = client.post(
        "/api/v1/projects",
        json=project_payload,
        headers=auth_headers,
    )

    assert response.status_code == 201

    return response.json()
``````

### `backend/app/tests/test_tags.py`

``````python
from collections.abc import Callable

from fastapi.testclient import TestClient


def headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


def create_project(
    client: TestClient,
    auth_headers: dict[str, str],
    name: str = "Tagged project",
) -> str:
    response = client.post(
        "/api/v1/projects",
        json={"name": name, "description": "Project used by tag tests."},
        headers=auth_headers,
    )
    assert response.status_code == 201

    return response.json()["id"]


def create_task_with_tags(
    client: TestClient,
    auth_headers: dict[str, str],
    project_id: str,
    tags: list[str],
) -> dict[str, object]:
    response = client.post(
        "/api/v1/tasks",
        json={
            "project_id": project_id,
            "title": "Implement tags",
            "short_description": "Associate reusable tags with the task.",
            "priority": "medium",
            "tags": tags,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201

    return response.json()


def test_create_task_normalizes_and_deduplicates_tags(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    task = create_task_with_tags(
        client,
        auth_headers,
        created_project["id"],
        [" Backend ", "backend", "  High   Priority  "],
    )

    assert [tag["name"] for tag in task["tags"]] == ["Backend", "High Priority"]

    response = client.get("/api/v1/tags", headers=auth_headers)

    assert response.status_code == 200
    assert [tag["name"] for tag in response.json()] == ["Backend", "High Priority"]


def test_update_task_replaces_and_clears_tags(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    task = create_task_with_tags(
        client,
        auth_headers,
        created_project["id"],
        ["Backend", "API"],
    )

    replace_response = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"tags": ["Frontend"]},
        headers=auth_headers,
    )

    assert replace_response.status_code == 200
    assert [tag["name"] for tag in replace_response.json()["tags"]] == ["Frontend"]

    clear_response = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"tags": []},
        headers=auth_headers,
    )

    assert clear_response.status_code == 200
    assert clear_response.json()["tags"] == []


def test_update_task_rejects_null_tags(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    task = create_task_with_tags(
        client,
        auth_headers,
        created_project["id"],
        ["Backend"],
    )

    response = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"tags": None},
        headers=auth_headers,
    )

    assert response.status_code == 422
    assert "tags cannot be null" in response.text


def test_tag_search_is_scoped_to_authenticated_user(
    client: TestClient,
    authenticated_user_factory: Callable[[str, str], dict[str, str]],
) -> None:
    first_user = authenticated_user_factory("tags-a@example.com", "Tags A")
    second_user = authenticated_user_factory("tags-b@example.com", "Tags B")
    first_headers = headers(first_user["access_token"])
    second_headers = headers(second_user["access_token"])

    first_project = create_project(client, first_headers, "First project")
    second_project = create_project(client, second_headers, "Second project")

    first_task = create_task_with_tags(
        client,
        first_headers,
        first_project,
        ["Backend", "Private A"],
    )
    second_task = create_task_with_tags(
        client,
        second_headers,
        second_project,
        ["backend", "Private B"],
    )

    first_tags = client.get(
        "/api/v1/tags",
        params={"search": "back"},
        headers=first_headers,
    )
    second_tags = client.get(
        "/api/v1/tags",
        params={"search": "back"},
        headers=second_headers,
    )

    assert first_tags.status_code == 200
    assert second_tags.status_code == 200
    assert [tag["name"] for tag in first_tags.json()] == ["Backend"]
    assert [tag["name"] for tag in second_tags.json()] == ["backend"]
    assert first_task["tags"][0]["id"] != second_task["tags"][0]["id"]


def test_create_task_rejects_more_than_ten_tags(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    response = client.post(
        "/api/v1/tasks",
        json={
            "project_id": created_project["id"],
            "title": "Too many tags",
            "short_description": "This payload must be rejected.",
            "tags": [f"tag-{index}" for index in range(11)],
        },
        headers=auth_headers,
    )

    assert response.status_code == 422
``````

### `docs/AI_USAGE.md`

``````markdown
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
``````

### `docs/CURRENT_STATE.md`

``````markdown
# Estado atual

## Concluído

- Diagnóstico e decisões iniciais documentados.
- Baseline Alembic e adaptação do contrato de tarefas preparadas.
- Status `cancelled`, `short_description` e `due_at` em UTC implementados.
- Testes de ownership com dois usuários adicionados.
- Repositório reorganizado como monorepo.
- Runtime Python movido para `backend/`.
- Pasta `frontend/` criada e reservada para React/Vite.
- Documentação e ferramentas globais mantidas na raiz.
- Docker Compose e CI ajustados ao novo caminho do backend.
- Tags relacionais por usuário implementadas.
- Associação many-to-many entre tarefas e tags criada.
- Normalização e deduplicação de nomes de tags implementadas.
- Endpoint `GET /api/v1/tags` criado para autocomplete.
- Testes de criação, edição, remoção, limite e ownership de tags preparados.

## Em desenvolvimento

- Validação da Etapa 03 no PostgreSQL e na `.venv` do desenvolvedor.
- Registro das saídas reais de Alembic, Ruff e pytest.

## Pendente

- Corrigir eventuais falhas encontradas na validação local.
- Executar o commit da Etapa 03.
- Implementar anexos e storage adapter.
- Implementar endpoint de refresh token.
- Inicializar frontend React/Vite/TypeScript.
- Implementar autenticação no frontend.
- Implementar projetos, lista de tarefas, kanban e drag-and-drop.
- Consolidar deploy e documentação final.

## Último commit

- Etapa 03 ainda não commitada.
- Mensagem planejada: `feat: organiza monorepo e adiciona tags relacionais`
``````

### `docs/DECISIONS.md`

``````markdown
# Decisões técnicas do Taskly

Este documento registra decisões tomadas pelo desenvolvedor após análise do repositório, comparação de alternativas e avaliação do prazo do desafio.

As alternativas podem ter sido organizadas com apoio de IA, mas a decisão aplicada, a implementação e a validação pertencem ao desenvolvedor.

---

## DEC-001 — Preservar a arquitetura em camadas

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O KanbanCore já separa rotas, regras de negócio, acesso a dados, modelos SQLAlchemy e schemas Pydantic.

### Alternativas consideradas

1. Reestruturar o backend durante a adaptação para o Taskly.
2. Preservar a arquitetura atual e evoluir somente os pontos necessários.

### Decisão do desenvolvedor

Preservar o fluxo `api → service → repository → model`, mantendo schemas Pydantic na fronteira da API.

### Justificativa

A base já é coerente, testável e adequada ao prazo. Uma reescrita aumentaria risco sem entregar valor proporcional ao escopo do desafio.

### Consequências

- Novas entidades seguirão o mesmo padrão.
- Regras de ownership permanecerão na camada de serviço e nas consultas protegidas.
- Mudanças estruturais exigirão justificativa técnica explícita.

---

## DEC-002 — Criar uma baseline Alembic reproduzível

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O repositório possui configuração do Alembic, mas não possui revisions versionadas. Além disso, o `.gitignore` ignora arquivos Python da pasta de versions.

### Alternativas consideradas

1. Manter `Base.metadata.create_all()` como mecanismo principal.
2. Criar uma baseline do KanbanCore e depois migrations incrementais.
3. Criar uma migration inicial consolidada já com o modelo final do Taskly.

### Decisão do desenvolvedor

Tratar o banco local do case como recriável e estabelecer uma baseline Alembic reproduzível antes das alterações funcionais. A ordem exata das revisions será definida na Etapa 02 para manter o histórico compreensível e validável.

### Justificativa

O avaliador deve conseguir iniciar o projeto em banco vazio com `alembic upgrade head`. A baseline reduz a diferença entre o modelo ORM e o histórico real do banco.

### Consequências

- O `.gitignore` deverá permitir migrations.
- A CI deverá validar upgrade em banco vazio.
- `create_all()` poderá continuar em testes rápidos, mas não substituirá o smoke test de migrations.

---

## DEC-003 — Adotar tags relacionais por usuário

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O Taskly exige tags editáveis e reutilizáveis. O backend atual não possui estrutura equivalente.

### Alternativas consideradas

1. Armazenar tags em JSONB ou array na tabela de tarefas.
2. Criar `tags` e uma associação many-to-many com tarefas.

### Decisão do desenvolvedor

Utilizar modelagem relacional enxuta:

- tags pertencem ao usuário;
- tarefas e tags possuem associação many-to-many;
- o nome será normalizado para evitar duplicidade por diferença de caixa ou espaços;
- a API terá somente as operações necessárias ao fluxo do Taskly, evitando um CRUD administrativo excessivo.

### Justificativa

A solução melhora consistência, reutilização, filtros e autocomplete, sem extrapolar o escopo mínimo.

### Consequências

- Será necessário evitar N+1 nas consultas.
- Ownership deverá impedir associação entre tarefa e tag de usuários diferentes.
- A migration incluirá tabela de tags, associação e restrição de unicidade.

---

## DEC-004 — Isolar anexos atrás de uma interface de storage

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

Anexos exigem persistência de metadados e armazenamento de bytes. O ambiente definitivo de deploy ainda não foi escolhido.

### Alternativas consideradas

1. Acoplar o serviço diretamente ao filesystem local.
2. Acoplar diretamente a um serviço externo compatível com S3.
3. Definir uma interface e fornecer implementações intercambiáveis.

### Decisão do desenvolvedor

Criar uma abstração `StorageBackend`, usar implementação local em desenvolvimento e testes e selecionar a implementação de produção na etapa de deploy.

Os metadados serão persistidos em uma entidade `Attachment`, incluindo nome original, chave ou URL, tipo, tamanho e `task_id`.

### Justificativa

A abstração mantém o domínio independente do provedor, reduz risco durante o desenvolvimento e permite adequação ao ambiente real de deploy.

### Consequências

- Upload e exclusão precisarão coordenar banco e storage.
- Ownership será validado por `Attachment → Task → Project → owner_id`.
- Nomes físicos serão não previsíveis.
- Tipos iniciais serão imagens e PDF, com limite configurável.

---

## DEC-005 — Usar UTC no contrato de prazos

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O campo atual `due_date` contém apenas data. O Taskly exige data e hora.

### Alternativas consideradas

1. Persistir datetime sem timezone.
2. Persistir horário local do usuário.
3. Persistir datetime timezone-aware e normalizar em UTC.

### Decisão do desenvolvedor

Substituir `due_date` por `due_at`, usando `TIMESTAMP WITH TIME ZONE` no PostgreSQL e datetime timezone-aware no contrato da API. A API normalizará valores para UTC; o frontend fará a conversão somente para apresentação e edição local.

### Justificativa

A decisão evita ambiguidades e deslocamentos silenciosos entre ambientes.

### Consequências

- Payloads sem offset deverão ser rejeitados ou tratados por regra explícita.
- Testes deverão verificar normalização e serialização.
- A migration deverá evitar conversões implícitas dependentes do timezone da sessão.

---

## DEC-006 — Manter prioridade como recurso adicional

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

Prioridade não é requisito obrigatório do Taskly, mas já está implementada no KanbanCore.

### Decisão do desenvolvedor

Manter `low`, `medium` e `high` no domínio e no frontend.

### Justificativa

O recurso já funciona, agrega valor ao produto e não desvia o cronograma quando apenas adaptado às novas telas.

### Consequências

- Os testes existentes serão adaptados, não removidos.
- Prioridade não terá precedência sobre requisitos obrigatórios.

---

## DEC-007 — Carregar todas as páginas para compor o kanban

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

A listagem atual é paginada e retorna 20 itens por padrão. Um kanban parcial poderia ocultar tarefas sem informar o usuário.

### Alternativas consideradas

1. Mostrar apenas a primeira página.
2. Criar imediatamente um endpoint específico para board.
3. Consumir todas as páginas do projeto no frontend.

### Decisão do desenvolvedor

No escopo do case, o frontend carregará todas as páginas do projeto para compor o board. Um endpoint específico só será criado se medições demonstrarem necessidade.

### Justificativa

A solução preserva a API existente, evita duplicação prematura e garante visão completa do projeto.

### Consequências

- O hook do kanban deverá controlar paginação acumulada.
- Estados de carregamento e falha parcial deverão ser tratados.

---

## DEC-008 — Tornar projeto arquivado somente leitura

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O backend já impede criação de tarefas em projetos arquivados, mas ainda é necessário definir edição, exclusão e movimentação.

### Decisão do desenvolvedor

Projetos arquivados serão somente leitura no Taskly. Não será permitida criação, edição, exclusão ou movimentação de tarefas enquanto o projeto estiver arquivado.

### Justificativa

A regra é previsível, reduz inconsistências e evita comportamentos diferentes entre lista e kanban.

### Consequências

- O backend deverá aplicar a regra, não apenas o frontend.
- A interface deverá comunicar o estado de somente leitura.
- Testes deverão cobrir as operações bloqueadas.

---

## DEC-009 — Estratégia de sessão adequada ao prazo do case

**Status:** aprovada com trade-off documentado
**Data:** 31/07/2026

### Contexto

O backend emite access e refresh tokens, mas não possui endpoint de renovação. Cookies HttpOnly oferecem proteção adicional, porém exigem configuração de CORS, credenciais e proteção contra CSRF.

### Decisão do desenvolvedor

Para o prazo do case, implementar renovação de sessão com access e refresh tokens armazenados no cliente, registrando a limitação de segurança e evitando apresentar essa estratégia como escolha definitiva para produção.

A adoção de cookies HttpOnly permanecerá como evolução recomendada para um produto real.

### Justificativa

A abordagem reduz complexidade operacional no prazo de três dias e permite demonstrar sessão persistente de ponta a ponta.

### Consequências

- O frontend deverá minimizar exposição dos tokens e limpar a sessão em falhas definitivas de refresh.
- O README e a documentação de segurança deverão registrar o trade-off.
- O backend deverá validar o tipo do token no endpoint de refresh.

---

## DEC-010 — IA como apoio, desenvolvedor como responsável técnico

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O desafio avalia o uso de IA, mas também exige demonstração de capacidade técnica, revisão crítica e rastreabilidade.

### Decisão do desenvolvedor

Registrar a IA como ferramenta de pesquisa, levantamento de alternativas, organização e revisão. Decisões arquiteturais, implementação, alterações manuais, execução de testes e aceitação dos resultados serão atribuídas ao desenvolvedor.

### Justificativa

O registro representa o uso real de uma ferramenta de apoio sem transferir autoria ou responsabilidade técnica.

### Consequências

- `AI_USAGE.md` distinguirá sugestão, decisão, alteração humana e validação real.
- Nenhum resultado será declarado como executado sem evidência.
- Divergências entre sugestão e implementação serão registradas.

---

## DEC-011 — Persistir valores textuais dos enums

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

Quando recebe uma classe `Enum` Python, o SQLAlchemy persiste os nomes dos membros por padrão. Assim, `TaskStatus.TODO = "todo"` poderia ser armazenado como `TODO`, divergindo do contrato textual da API e das migrations minúsculas.

### Alternativas consideradas

1. Manter os nomes internos em maiúsculas no PostgreSQL.
2. Configurar `values_callable` para persistir os valores públicos dos enums.

### Decisão do desenvolvedor

Configurar explicitamente os campos enum para persistirem os valores públicos: `active`, `archived`, `todo`, `in_progress`, `done`, `cancelled`, `low`, `medium` e `high`.

### Justificativa

O banco passa a refletir o contrato público, reduz ambiguidades em SQL manual, migrations e depuração.

### Consequências

- A baseline utiliza labels minúsculos.
- Bancos antigos criados por `create_all()` devem ser recriados para esta baseline.
- Novos enums devem declarar a mesma estratégia explicitamente.

---

## DEC-012 — Validar migrations no setup da suíte

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

A suíte original criava tabelas diretamente pelo metadata do ORM. Esse fluxo podia aprovar testes mesmo quando `alembic upgrade head` não conseguia construir o banco.

### Alternativas consideradas

1. Continuar usando `create_all()` e adicionar um teste isolado de migration.
2. Aplicar Alembic como preparação principal da sessão de testes.

### Decisão do desenvolvedor

Recriar o schema do banco exclusivo de testes e executar `alembic upgrade head` antes da suíte.

### Justificativa

O mesmo caminho usado no deploy passa a ser exercitado antes dos testes de API, aproximando a validação do ambiente real.

### Consequências

- `TEST_DATABASE_URL` deve apontar para banco descartável.
- O setup interrompe a execução quando a URL de teste coincide com a URL de desenvolvimento fora de `APP_ENV=test`.
- Falhas de migration impedem o início dos testes funcionais.

---

## DEC-013 — Organizar o Taskly como monorepo

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

O repositório herdado possuía somente o backend diretamente na raiz. O Taskly exige backend, frontend, documentação e orquestração fullstack no mesmo projeto.

### Alternativas consideradas

1. Manter o backend na raiz e criar somente `frontend/` ao lado dele.
2. Criar `backend/` e `frontend/`, preservando arquivos globais na raiz.
3. Separar backend e frontend em repositórios diferentes.

### Decisão do desenvolvedor

Adotar um monorepo com:

- `backend/` para runtime, dependências, migrations, testes e imagem Docker da API;
- `frontend/` para React/Vite/TypeScript;
- `docs/` na raiz para documentação transversal;
- `.github/`, `.gitignore`, `.pre-commit-config.yaml`, `docker-compose.yml` e README principal na raiz.

### Justificativa

A estrutura aproxima o repositório da arquitetura final exigida, mantém um único histórico do case e permite que Docker Compose e CI coordenem os dois lados da aplicação.

### Consequências

- Comandos Python passam a ser executados em `backend/`.
- Comandos npm serão executados em `frontend/`.
- Git e Docker Compose continuam sendo executados na raiz.
- A CI precisa declarar o diretório de trabalho de cada job.
- Configurações que dependiam do diretório corrente devem usar caminhos explícitos.

---

## DEC-014 — Resolver tags por nome no fluxo de tarefas

**Status:** aprovada
**Data:** 31/07/2026

### Contexto

A modelagem relacional aprovada exige definir como o frontend associa tags a uma tarefa. O envio direto de IDs exigiria criação prévia e validação adicional de ownership.

### Alternativas consideradas

1. Receber somente IDs de tags existentes.
2. Receber objetos completos de tags.
3. Receber nomes, reutilizar tags existentes e criar as ausentes para o usuário.

### Decisão do desenvolvedor

Receber uma lista de nomes nos payloads de criação e atualização de tarefas. O backend normaliza, deduplica, busca tags do proprietário e cria somente as ausentes.

### Justificativa

O contrato simplifica o formulário, impede associação direta por ID de outra conta e mantém a regra de ownership centralizada no backend.

### Consequências

- `tags: []` remove todas as associações da tarefa.
- `tags: null` é inválido.
- A resposta retorna objetos com ID e nome para renderização e cache.
- Tags sem tarefas permanecem disponíveis para reutilização e autocomplete.
- A exclusão administrativa de tags fica fora do escopo desta etapa.
``````

### `docs/prompts/prompt-etapa-03-tags-e-estrutura-fullstack.md`

``````markdown
# Prompt da Etapa 03 — Tags e estrutura fullstack

## Finalidade

Registrar como a IA foi utilizada como apoio de pesquisa, comparação de alternativas e revisão durante a reorganização do repositório e a implementação de tags relacionais.

## Contexto fornecido pelo desenvolvedor

- O repositório possuía somente o backend na raiz.
- A estrutura final precisa separar `backend/`, `frontend/` e `docs/`.
- O backend deve preservar as camadas `api → service → repository → model`.
- Tags devem ser relacionais, reutilizáveis e isoladas por usuário.
- Alterações de banco exigem migration Alembic.
- Regras de ownership exigem testes automatizados.
- A documentação deve atribuir decisões e implementação ao desenvolvedor.

## Solicitação feita à IA

> Reorganize a Etapa 03 para criar as pastas `backend/` e `frontend/`, movendo para `backend/` todos os arquivos de runtime Python. Preserve na raiz os arquivos que coordenam o monorepo, como `docs/`, `.github/`, `.gitignore`, `.pre-commit-config.yaml` e `docker-compose.yml`. Depois apresente e implemente uma solução relacional enxuta para tags, integrada ao cadastro e à edição de tarefas, com migration e testes de ownership. Diferencie claramente o documento da etapa e o documento de prompt.

## Alternativas pesquisadas

- manter o backend diretamente na raiz ou convertê-lo em monorepo;
- enviar IDs de tags pelo frontend ou aceitar nomes e resolver as entidades no backend;
- criar CRUD completo de tags ou expor apenas listagem/autocomplete;
- armazenar tags na própria tarefa ou usar relação many-to-many;
- manter `.env` dependente do diretório atual ou resolver seu caminho pela raiz física do backend.

## Decisões do desenvolvedor

- organizar o repositório como monorepo;
- manter ferramentas globais e documentação na raiz;
- mover FastAPI, Alembic, configuração Python e Dockerfile para `backend/`;
- criar `frontend/` como pasta reservada até a inicialização React/Vite;
- aceitar nomes de tags em tarefas e resolver tags por usuário no service/repository;
- limitar tarefas a dez tags, com nomes entre 1 e 40 caracteres;
- normalizar nomes para unicidade, preservando o texto de exibição;
- permitir limpar tags por `tags: []` e rejeitar `tags: null`;
- expor `GET /api/v1/tags` para autocomplete, sem CRUD administrativo excessivo.

## Responsabilidade técnica

A IA apoiou a organização das opções, a identificação de riscos e a revisão da consistência entre arquivos. A escolha das abordagens, a aplicação das alterações, a execução dos comandos, a revisão do código e a aceitação do resultado pertencem ao desenvolvedor.
``````

## 7. Comandos de aplicação e preparação local

### 7.1. Antes de aplicar

Execute na raiz do repositório e confirme que a Etapa 02 está salva:

```powershell
git status
git log --oneline -5
```

### 7.2. Aplicar o patch

```powershell
git apply --check etapa-03.patch
git apply etapa-03.patch
```

### 7.3. Mover o `.env` local

O `.env` é ignorado pelo Git e, por isso, não é movido pelo patch:

```powershell
Move-Item .env backend\.env
```

Caso não exista `.env`, crie a partir do exemplo:

```powershell
Copy-Item backend\.env.example backend\.env
```

A `.venv` pode permanecer na raiz. Ative-a antes de entrar no backend:

```powershell
.\.venv\Scripts\Activate.ps1
cd backend
python -m pip install -e ".[dev]"
```

## 8. Comandos de validação

### 8.1. Banco e migration

Na raiz do repositório:

```powershell
docker compose up -d db
docker compose ps
```

Se o banco de testes ainda não existir:

```powershell
docker exec -it taskly-db createdb -U postgres projects_api_test
```

Depois, na raiz do backend:

```powershell
cd backend
alembic history
alembic heads
alembic upgrade head
alembic current
```

O head esperado é:

```text
0003_add_relational_tags
```

### 8.2. Ruff

Execute dentro de `backend/`:

```powershell
ruff check .
ruff check . --fix
ruff format .
ruff format . --check
```

### 8.3. Testes

Execute dentro de `backend/`:

```powershell
python -m pytest
python -m pytest app/tests/test_tags.py -vv
python -m pytest --cov=app
```

Não registre aprovação em `AI_USAGE.md` até possuir as saídas reais.

### 8.4. Docker Compose

Execute na raiz do repositório:

```powershell
docker compose down
docker compose up --build
```

Verifique:

```text
http://localhost:8000/api/v1/health
http://localhost:8000/docs
```

## 9. Passo a passo do commit

Na raiz do repositório:

```powershell
# 1. Conferir movimentos e alterações
git status

# 2. Adicionar a etapa
git add `
  .github/workflows/ci.yml `
  .gitignore `
  .pre-commit-config.yaml `
  README.md `
  backend `
  frontend `
  docker-compose.yml `
  docs

# 3. Revisar antes de commitar
git diff --cached --stat
git diff --cached

# 4. Executar novamente as validações no backend
cd backend
ruff check .
ruff format . --check
python -m pytest
cd ..

# 5. Commit semântico
git commit -m "feat: organiza monorepo e adiciona tags relacionais"

# 6. Enviar
git push origin main
```

## 10. Problemas comuns

### `DATABASE_URL` ou `JWT_SECRET_KEY` ausentes

O `.env` provavelmente permaneceu na raiz antiga.

```powershell
Move-Item .env backend\.env
```

### `pyproject.toml` não encontrado

Ruff, pytest ou instalação foram executados na raiz do monorepo.

```powershell
cd backend
python -m pip install -e ".[dev]"
```

### `alembic.ini` não encontrado

Entre em `backend/` ou informe o caminho:

```powershell
alembic -c backend\alembic.ini history
```

### Docker procura `Dockerfile` na raiz

Confirme que o `docker-compose.yml` usa:

```yaml
build:
  context: ./backend
```

### Banco de testes não existe

```powershell
docker compose up -d db
docker exec -it taskly-db createdb -U postgres projects_api_test
```

### Migration 0003 não aparece

Confirme:

```powershell
Get-ChildItem backend\alembic\versions
cd backend
alembic heads
```

### Tags duplicadas

O payload é deduplicado por caixa e espaços. `Backend`, `backend` e ` Backend ` representam a mesma tag para o mesmo usuário.

### Tags antigas permanecem após remoção da tarefa

Isso é intencional. As tags pertencem ao usuário e permanecem disponíveis para reutilização/autocomplete, mesmo sem associação atual.

## 11. Checklist

- [x] Pasta `backend/` criada.
- [x] Pasta `frontend/` criada.
- [x] Runtime Python movido para `backend/`.
- [x] Arquivos globais preservados na raiz.
- [x] Docker Compose atualizado.
- [x] CI atualizada.
- [x] Pre-commit atualizado.
- [x] Caminho do `.env` estabilizado.
- [x] Migration `0003` criada.
- [x] Model `Tag` criado.
- [x] Associação `task_tags` criada.
- [x] Schemas de tags criados.
- [x] Criação e edição de tarefas integradas às tags.
- [x] Endpoint de autocomplete criado.
- [x] Ownership de tags coberto nos testes preparados.
- [x] Documento de prompt separado em `docs/prompts/`.
- [x] Documento da etapa separado em `docs/etapas/`.
- [ ] `.env` local movido pelo desenvolvedor.
- [ ] Migration validada online no PostgreSQL.
- [ ] Ruff executado no ambiente do desenvolvedor.
- [ ] pytest executado no ambiente do desenvolvedor.
- [ ] Commit executado.

## 12. Próxima etapa

**Etapa 04 — Anexos e abstração de armazenamento**

A próxima etapa deverá criar:

- entidade `Attachment`;
- migration correspondente;
- interface `StorageBackend`;
- implementação local para desenvolvimento/testes;
- upload, listagem e exclusão;
- limites de tamanho e tipos permitidos;
- ownership indireto por tarefa e projeto;
- limpeza coordenada entre banco e storage;
- testes automatizados.
