# Etapa 02 — Baseline Alembic e adaptação do modelo de tarefas

## 1. Objetivo da etapa

Criar uma cadeia Alembic reproduzível e adaptar a entidade de tarefas aos requisitos obrigatórios do Taskly, preservando a arquitetura em camadas e as regras de ownership.

Ao final desta etapa, o backend passa a possuir:

- revisions Alembic versionadas;
- baseline do esquema herdado;
- migration incremental para o contrato Taskly;
- status `cancelled`;
- `short_description` separada da descrição completa;
- `due_at` com timezone, normalizado para UTC;
- projetos arquivados como somente leitura para operações de tarefa;
- testes de ownership com dois usuários;
- preparação do banco de testes por migrations reais.

## 2. O que será feito e por quê

### 2.1. Corrigir o versionamento das migrations

O `.gitignore` original descartava `alembic/versions/*.py`. A regra será removida porque migrations fazem parte do código-fonte e precisam acompanhar deploy, CI e revisão.

### 2.2. Criar uma baseline e uma evolução incremental

A cadeia será composta por:

1. `0001_initial_kanbancore`: representa usuários, projetos e tarefas no formato herdado;
2. `0002_adapt_tasks_to_taskly`: adiciona os requisitos do Taskly e converte dados legados.

A separação foi escolhida pelo desenvolvedor porque evidencia a evolução do domínio e mantém a migration funcional compreensível.

### 2.3. Corrigir a persistência dos enums

O SQLAlchemy persiste o nome do membro Python por padrão. Para que o banco use os valores públicos (`todo`, `high`, `active`), os models passam a declarar `values_callable` explicitamente.

Como o banco local foi classificado como recriável na Etapa 01, a adoção da baseline exige recriação do volume local. Não aplique esta baseline sobre um banco que contenha dados que precisem ser preservados.

### 2.4. Adaptar o contrato de tarefas

- `short_description`: obrigatória, entre 2 e 280 caracteres;
- `description`: opcional, até 5.000 caracteres;
- `due_at`: opcional, mas quando informado deve possuir timezone;
- `cancelled`: novo status disponível para atualização;
- `priority`: mantida como recurso já existente.

A normalização para UTC ocorre na fronteira Pydantic, antes da persistência.

### 2.5. Aplicar projeto arquivado como somente leitura

Além de bloquear criação, o service passa a bloquear atualização, conclusão e exclusão de tarefas quando o projeto estiver arquivado. A regra permanece no backend para não depender do comportamento do frontend.

### 2.6. Validar ownership entre contas reais

A nova suíte cria dois usuários independentes e testa listagem, leitura, atualização, exclusão e criação cruzada. Recursos de outra conta continuam respondendo `404` para não revelar sua existência.

### 2.7. Executar migrations no banco de testes

O setup deixa de usar `Base.metadata.create_all()` como mecanismo principal. Antes da suíte, o schema do banco exclusivo de testes é recriado e `alembic upgrade head` é executado.

Essa operação é destrutiva. `TEST_DATABASE_URL` deve apontar para banco descartável. Fora de `APP_ENV=test`, a configuração rejeita a mesma URL de desenvolvimento e teste.

## 3. Decisões técnicas e alternativas

### 3.1. Uma migration final versus duas revisions

**Uma migration final**

- vantagem: menos arquivos;
- desvantagem: oculta a evolução do sistema herdado e não documenta a conversão.

**Baseline + migration incremental**

- vantagem: histórico claro, revisão mais fácil e conversão explícita;
- desvantagem: maior cuidado no upgrade e downgrade.

**Decisão do desenvolvedor:** duas revisions.

### 3.2. Descrição curta obrigatória ou opcional

**Opcional**

- mantém maior compatibilidade com clientes antigos;
- permite tarefas sem resumo consistente.

**Obrigatória**

- garante conteúdo adequado para lista e kanban;
- exige atualização dos payloads existentes.

**Decisão do desenvolvedor:** obrigatória. A migration preenche registros antigos com a descrição completa ou, na ausência dela, com o título.

### 3.3. Conversão de `due_date`

Foram consideradas meia-noite, meio-dia e final do dia. Como o campo legado não possuía hora nem timezone, qualquer escolha é uma convenção.

**Decisão do desenvolvedor:** converter para `23:59:00 UTC` do mesmo dia, de modo determinístico e independente do timezone da sessão PostgreSQL.

### 3.4. Testes por metadata ou Alembic

**`create_all()`**

- rápido;
- não valida o histórico de migrations.

**`alembic upgrade head`**

- reproduz o caminho de deploy;
- exige PostgreSQL descartável e setup mais cuidadoso.

**Decisão do desenvolvedor:** Alembic como preparação da suíte.

## 4. Dependências entre arquivos e ordem de aplicação

A aplicação recomendada é:

1. `.gitignore` e `.github/workflows/ci.yml`;
2. `alembic/env.py`;
3. revisions `0001` e `0002`;
4. models de projeto e tarefa;
5. schema de tarefa;
6. repository de tarefa;
7. service de tarefa;
8. route de tarefa;
9. setup e arquivos de testes;
10. documentação da etapa.

A migration deve estar presente antes de executar o novo setup da suíte, pois os testes chamam `alembic upgrade head`.

## 5. Arquivos alterados

### `.gitignore`

```text
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

# Docker
*.log

# Alembic
# As revisions são parte do código-fonte e precisam ser versionadas.
alembic/versions/__pycache__/
```

### `.github/workflows/ci.yml`

```yaml
name: KanbanCore API CI

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  lint-and-test:
    name: Lint and test
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
      APP_NAME: "KanbanCore API"
      APP_ENV: "test"
      APP_DEBUG: "false"
      APP_VERSION: "0.1.0"
      DATABASE_URL: "postgresql+psycopg://postgres:postgres@localhost:5432/projects_api_test"
      TEST_DATABASE_URL: "postgresql+psycopg://postgres:postgres@localhost:5432/projects_api_test"
      JWT_SECRET_KEY: "test-secret-key-for-ci"
      JWT_ALGORITHM: "HS256"
      ACCESS_TOKEN_EXPIRE_MINUTES: "30"
      REFRESH_TOKEN_EXPIRE_DAYS: "7"
      CORS_ORIGINS: "http://localhost:3000,http://localhost:8000"

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
          key: pip-${{ runner.os }}-${{ hashFiles('pyproject.toml') }}
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
```

### `alembic/env.py`

```python
from logging.config import fileConfig

from alembic import context
from app import models  # noqa: F401
from app.core.config import get_settings
from app.core.database import Base
from sqlalchemy import engine_from_config, pool

config = context.config
settings = get_settings()

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# A URL pode ser injetada programaticamente pelos testes. Em execução normal,
# usamos a configuração da aplicação para manter Alembic e FastAPI no mesmo banco.
database_url = config.attributes.get("database_url", settings.database_url)
config.set_main_option("sqlalchemy.url", database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = database_url

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

### `alembic/versions/0001_initial_kanbancore.py`

```python
"""Create the original KanbanCore schema.

Revision ID: 0001_initial_kanbancore
Revises:
Create Date: 2026-07-31
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_kanbancore"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create a reproducible baseline matching the inherited backend."""
    bind = op.get_bind()

    project_status = postgresql.ENUM(
        "active",
        "archived",
        name="project_status",
    )
    task_status = postgresql.ENUM(
        "todo",
        "in_progress",
        "done",
        name="task_status",
    )
    task_priority = postgresql.ENUM(
        "low",
        "medium",
        "high",
        name="task_priority",
    )

    # Enum types are created explicitly so downgrade can remove them in the
    # inverse dependency order after all tables have been dropped.
    project_status.create(bind, checkfirst=True)
    task_status.create(bind, checkfirst=True)
    task_priority.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "projects",
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM(
                "active",
                "archived",
                name="project_status",
                create_type=False,
            ),
            nullable=False,
        ),
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
    )
    op.create_index("ix_projects_owner_id", "projects", ["owner_id"], unique=False)

    op.create_table(
        "tasks",
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM(
                "todo",
                "in_progress",
                "done",
                name="task_status",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "priority",
            postgresql.ENUM(
                "low",
                "medium",
                "high",
                name="task_priority",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("due_date", sa.Date(), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tasks_project_id", "tasks", ["project_id"], unique=False)


def downgrade() -> None:
    """Remove the baseline without leaving PostgreSQL enum types behind."""
    bind = op.get_bind()

    op.drop_index("ix_tasks_project_id", table_name="tasks")
    op.drop_table("tasks")
    op.drop_index("ix_projects_owner_id", table_name="projects")
    op.drop_table("projects")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    postgresql.ENUM(name="task_priority").drop(bind, checkfirst=True)
    postgresql.ENUM(name="task_status").drop(bind, checkfirst=True)
    postgresql.ENUM(name="project_status").drop(bind, checkfirst=True)
```

### `alembic/versions/0002_adapt_tasks_to_taskly.py`

```python
"""Adapt tasks to the Taskly contract.

Revision ID: 0002_adapt_tasks_to_taskly
Revises: 0001_initial_kanbancore
Create Date: 2026-07-31
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_adapt_tasks_to_taskly"
down_revision: str | None = "0001_initial_kanbancore"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add Taskly fields while preserving rows from the inherited schema."""
    # PostgreSQL enums are altered explicitly because Alembic cannot infer a
    # safe value addition from SQLAlchemy metadata alone.
    op.execute("ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'cancelled'")

    op.add_column(
        "tasks",
        sa.Column("short_description", sa.String(length=280), nullable=True),
    )
    op.add_column(
        "tasks",
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Existing rows receive deterministic values before short_description is
    # made NOT NULL. Description is preferred; title is a safe fallback.
    op.execute(
        """
        UPDATE tasks
        SET short_description = LEFT(
            COALESCE(NULLIF(BTRIM(description), ''), title),
            280
        )
        WHERE short_description IS NULL
        """
    )

    # A legacy date had no timezone or hour. Converting it to 23:59 UTC keeps
    # the original calendar day and avoids silently choosing the DB timezone.
    op.execute(
        """
        UPDATE tasks
        SET due_at = (due_date + TIME '23:59:00') AT TIME ZONE 'UTC'
        WHERE due_date IS NOT NULL
        """
    )

    op.alter_column(
        "tasks",
        "short_description",
        existing_type=sa.String(length=280),
        nullable=False,
    )
    op.drop_column("tasks", "due_date")


def downgrade() -> None:
    """Restore the original task structure with a controlled data mapping."""
    op.add_column("tasks", sa.Column("due_date", sa.Date(), nullable=True))
    op.execute(
        """
        UPDATE tasks
        SET due_date = (due_at AT TIME ZONE 'UTC')::date
        WHERE due_at IS NOT NULL
        """
    )

    op.drop_column("tasks", "due_at")
    op.drop_column("tasks", "short_description")

    # PostgreSQL cannot remove an enum value directly. Cancelled tasks are
    # mapped to todo before the type is recreated with the original values.
    op.execute("UPDATE tasks SET status = 'todo' WHERE status = 'cancelled'")
    op.execute("ALTER TYPE task_status RENAME TO task_status_with_cancelled")
    op.execute("CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done')")
    op.execute(
        """
        ALTER TABLE tasks
        ALTER COLUMN status TYPE task_status
        USING status::text::task_status
        """
    )
    op.execute("DROP TYPE task_status_with_cancelled")
```

### `app/models/project.py`

```python
from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.task import Task
    from app.models.user import User


class ProjectStatus(StrEnum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class Project(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "projects"

    owner_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(
            ProjectStatus,
            name="project_status",
            values_callable=lambda enum_type: [item.value for item in enum_type],
        ),
        default=ProjectStatus.ACTIVE,
        nullable=False,
    )

    owner: Mapped[User] = relationship(back_populates="projects")
    tasks: Mapped[list[Task]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )
```

### `app/models/task.py`

```python
from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.project import Project


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
```

### `app/schemas/task.py`

```python
from datetime import UTC, datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

from app.models.task import TaskPriority, TaskStatus


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

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> Self:
        """Distingue campo ausente de `null` em atualizações parciais."""
        required_fields = {"title", "short_description"}

        for field_name in required_fields & self.model_fields_set:
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
    created_at: datetime
    updated_at: datetime
```

### `app/repositories/task_repository.py`

```python
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.task import Task, TaskPriority, TaskStatus
from app.schemas.task import TaskCreate, TaskUpdate


class TaskRepository:
    """Camada de acesso a dados para tarefas.

    Tarefas pertencem a projetos. Como projetos pertencem a usuários,
    consultas protegidas fazem join com `Project` para validar ownership.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, task_data: TaskCreate) -> Task:
        """Persiste uma tarefa após autorização realizada pelo service."""
        task = Task(
            project_id=task_data.project_id,
            title=task_data.title,
            short_description=task_data.short_description,
            description=task_data.description,
            priority=task_data.priority,
            due_at=task_data.due_at,
        )

        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        return task

    def get_by_id(self, task_id: UUID) -> Task | None:
        """Busca uma tarefa apenas pelo ID para usos internos controlados."""
        statement = select(Task).where(Task.id == task_id)

        return self.db.scalar(statement)

    def get_by_id_and_owner(self, task_id: UUID, owner_id: UUID) -> Task | None:
        """Busca a tarefa somente quando seu projeto pertence ao usuário."""
        statement = (
            select(Task)
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
        """Lista tarefas autorizadas com filtros e paginação."""
        offset = (page - 1) * size

        statement = (
            select(Task)
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

    def update(self, task: Task, task_data: TaskUpdate) -> Task:
        """Atualiza somente campos enviados na operação parcial."""
        update_data = task_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(task, field, value)

        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        return task

    def delete(self, task: Task) -> None:
        """Remove uma tarefa já autorizada pelo service."""
        self.db.delete(task)
        self.db.commit()
```

### `app/services/task_service.py`

```python
from datetime import datetime
from math import ceil
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.project import ProjectStatus
from app.models.task import Task, TaskPriority, TaskStatus
from app.repositories.project_repository import ProjectRepository
from app.repositories.task_repository import TaskRepository
from app.schemas.common import PaginatedResponse
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate
from app.services.exceptions import BadRequestError, NotFoundError


class TaskService:
    """Regras de negócio relacionadas a tarefas."""

    def __init__(self, db: Session) -> None:
        self.repository = TaskRepository(db)
        self.project_repository = ProjectRepository(db)

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

        return self.repository.create(task_data)

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
        """Atualiza tarefa própria apenas enquanto o projeto estiver ativo."""
        task = self.get_task_for_owner(task_id=task_id, owner_id=owner_id)
        self._ensure_project_is_active(task=task, owner_id=owner_id)

        return self.repository.update(task, task_data)

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
            # Esse estado indica inconsistência entre a tarefa e o projeto.
            # Mantemos 404 para não expor detalhes de ownership.
            raise NotFoundError("Project not found")

        if project.status == ProjectStatus.ARCHIVED:
            raise BadRequestError("Cannot modify tasks in archived projects")
```

### `app/api/routes/tasks.py`

```python
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.task import TaskPriority, TaskStatus
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate, UtcDateTime
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post(
    "",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    task_data: TaskCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TaskResponse:
    """Cria uma tarefa em um projeto ativo do usuário autenticado."""
    service = TaskService(db)
    task = service.create_task(
        owner_id=current_user.id,
        task_data=task_data,
    )

    return TaskResponse.model_validate(task)


@router.get(
    "",
    response_model=PaginatedResponse[TaskResponse],
)
def list_tasks(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: Annotated[int, Query(ge=1, examples=[1])] = 1,
    size: Annotated[int, Query(ge=1, le=100, examples=[20])] = 20,
    project_id: Annotated[
        UUID | None,
        Query(examples=["4b01951d-5f36-465d-b438-6de1aa2cd170"]),
    ] = None,
    status_filter: Annotated[
        TaskStatus | None,
        Query(alias="status", examples=[TaskStatus.TODO]),
    ] = None,
    priority: Annotated[
        TaskPriority | None,
        Query(examples=[TaskPriority.HIGH]),
    ] = None,
    due_before: Annotated[
        UtcDateTime | None,
        Query(examples=["2026-06-30T23:59:59Z"]),
    ] = None,
    search: Annotated[
        str | None,
        Query(min_length=1, max_length=180, examples=["authentication"]),
    ] = None,
) -> PaginatedResponse[TaskResponse]:
    """Lista tarefas com filtros, normalizando o limite temporal para UTC."""
    service = TaskService(db)

    return service.list_tasks(
        owner_id=current_user.id,
        page=page,
        size=size,
        project_id=project_id,
        status=status_filter,
        priority=priority,
        due_before=due_before,
        search=search,
    )


@router.get(
    "/{task_id}",
    response_model=TaskResponse,
)
def get_task(
    task_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TaskResponse:
    """Busca uma tarefa específica do usuário autenticado."""
    service = TaskService(db)
    task = service.get_task_for_owner(
        task_id=task_id,
        owner_id=current_user.id,
    )

    return TaskResponse.model_validate(task)


@router.patch(
    "/{task_id}",
    response_model=TaskResponse,
)
def update_task(
    task_id: UUID,
    task_data: TaskUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TaskResponse:
    """Atualiza parcialmente uma tarefa de projeto ativo."""
    service = TaskService(db)
    task = service.update_task(
        task_id=task_id,
        owner_id=current_user.id,
        task_data=task_data,
    )

    return TaskResponse.model_validate(task)


@router.patch(
    "/{task_id}/done",
    response_model=TaskResponse,
)
def mark_task_as_done(
    task_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> TaskResponse:
    """Marca uma tarefa como concluída quando o projeto está ativo."""
    service = TaskService(db)
    task = service.mark_task_as_done(
        task_id=task_id,
        owner_id=current_user.id,
    )

    return TaskResponse.model_validate(task)


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_task(
    task_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    """Remove uma tarefa de projeto ativo do usuário autenticado."""
    service = TaskService(db)
    service.delete_task(
        task_id=task_id,
        owner_id=current_user.id,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

### `app/tests/conftest.py`

```python
from collections.abc import Callable, Generator

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.core.database import get_db
from app.main import app

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
    alembic_config = Config("alembic.ini")
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
```

### `app/tests/test_tasks.py`

```python
from datetime import UTC, datetime

from fastapi.testclient import TestClient


def task_payload(project_id: str, title: str = "Create CRUD routes") -> dict[str, str]:
    """Monta o contrato mínimo de tarefa sem ocultar campos obrigatórios."""
    return {
        "project_id": project_id,
        "title": title,
        "short_description": "Implement the main task flow.",
        "description": "Implement protected routes for projects and tasks.",
        "priority": "high",
        "due_at": "2026-06-15T18:30:00-03:00",
    }


def parse_datetime(value: str) -> datetime:
    """Aceita a representação UTC com `Z` devolvida pelo JSON."""
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def test_create_task_normalizes_due_at_to_utc(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    response = client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"]),
        headers=auth_headers,
    )

    assert response.status_code == 201

    data = response.json()

    assert data["project_id"] == created_project["id"]
    assert data["title"] == "Create CRUD routes"
    assert data["short_description"] == "Implement the main task flow."
    assert data["status"] == "todo"
    assert data["priority"] == "high"
    assert parse_datetime(data["due_at"]) == datetime(
        2026,
        6,
        15,
        21,
        30,
        tzinfo=UTC,
    )


def test_create_task_rejects_due_at_without_timezone(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    payload = task_payload(created_project["id"])
    payload["due_at"] = "2026-06-15T18:30:00"

    response = client.post(
        "/api/v1/tasks",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 422
    assert "due_at must include a timezone offset" in response.text


def test_create_task_requires_short_description(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    payload = task_payload(created_project["id"])
    payload.pop("short_description")

    response = client.post(
        "/api/v1/tasks",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_list_tasks(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"], "Create tests"),
        headers=auth_headers,
    )

    response = client.get("/api/v1/tasks?page=1&size=20", headers=auth_headers)

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 1
    assert data["pages"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["title"] == "Create tests"


def test_list_tasks_with_filters(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    high_priority = task_payload(
        created_project["id"],
        "Write authentication tests",
    )
    low_priority = task_payload(created_project["id"], "Update README")
    low_priority["priority"] = "low"
    low_priority["due_at"] = "2026-07-01T10:00:00Z"

    client.post("/api/v1/tasks", json=high_priority, headers=auth_headers)
    client.post("/api/v1/tasks", json=low_priority, headers=auth_headers)

    response = client.get(
        "/api/v1/tasks",
        params={
            "priority": "high",
            "search": "authentication",
            "due_before": "2026-06-30T23:59:59Z",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 1
    assert data["items"][0]["title"] == "Write authentication tests"


def test_get_task_by_id(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    create_response = client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"], "Create task detail endpoint"),
        headers=auth_headers,
    )

    task = create_response.json()
    response = client.get(f"/api/v1/tasks/{task['id']}", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["id"] == task["id"]


def test_update_task_and_cancel_it(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    create_response = client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"], "Old task title"),
        headers=auth_headers,
    )
    task = create_response.json()

    update_response = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={
            "title": "New task title",
            "short_description": "Task cancelled after scope review.",
            "status": "cancelled",
        },
        headers=auth_headers,
    )

    assert update_response.status_code == 200
    assert update_response.json()["title"] == "New task title"
    assert update_response.json()["status"] == "cancelled"


def test_update_task_rejects_null_short_description(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    create_response = client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"]),
        headers=auth_headers,
    )

    response = client.patch(
        f"/api/v1/tasks/{create_response.json()['id']}",
        json={"short_description": None},
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_mark_task_as_done(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    create_response = client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"], "Finish task"),
        headers=auth_headers,
    )
    task = create_response.json()

    done_response = client.patch(
        f"/api/v1/tasks/{task['id']}/done",
        headers=auth_headers,
    )

    assert done_response.status_code == 200
    assert done_response.json()["status"] == "done"


def test_delete_task(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    create_response = client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"], "Delete me"),
        headers=auth_headers,
    )
    task = create_response.json()

    delete_response = client.delete(
        f"/api/v1/tasks/{task['id']}",
        headers=auth_headers,
    )
    get_response = client.get(f"/api/v1/tasks/{task['id']}", headers=auth_headers)

    assert delete_response.status_code == 204
    assert get_response.status_code == 404


def test_archived_project_is_read_only_for_tasks(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    create_response = client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"], "Existing task"),
        headers=auth_headers,
    )
    task_id = create_response.json()["id"]

    archive_response = client.patch(
        f"/api/v1/projects/{created_project['id']}/archive",
        headers=auth_headers,
    )
    assert archive_response.status_code == 200

    create_after_archive = client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"], "Should fail"),
        headers=auth_headers,
    )
    update_after_archive = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"status": "in_progress"},
        headers=auth_headers,
    )
    delete_after_archive = client.delete(
        f"/api/v1/tasks/{task_id}",
        headers=auth_headers,
    )

    assert create_after_archive.status_code == 400
    assert update_after_archive.status_code == 400
    assert delete_after_archive.status_code == 400
    assert update_after_archive.json()["detail"] == (
        "Cannot modify tasks in archived projects"
    )


def test_create_task_without_token_returns_401(
    client: TestClient,
    created_project: dict[str, str],
) -> None:
    response = client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"], "Unauthorized task"),
    )

    assert response.status_code == 401
```

### `app/tests/test_full_flow.py`

```python
from fastapi.testclient import TestClient


def test_full_user_project_task_flow(client: TestClient) -> None:
    """Cobre o fluxo principal com o contrato Taskly da tarefa."""
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
        },
        headers=headers,
    )
    assert task_response.status_code == 201
    assert task_response.json()["project_id"] == project_id

    tasks_response = client.get(
        f"/api/v1/tasks?project_id={project_id}",
        headers=headers,
    )
    assert tasks_response.status_code == 200

    tasks_data = tasks_response.json()
    assert tasks_data["total"] == 1
    assert tasks_data["items"][0]["title"] == "Create full flow test"
```

### `app/tests/test_ownership.py`

```python
from collections.abc import Callable

from fastapi.testclient import TestClient


def headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


def test_project_and_task_resources_are_isolated_by_owner(
    client: TestClient,
    authenticated_user_factory: Callable[[str, str], dict[str, str]],
) -> None:
    """Cobre leitura, escrita, listagem e criação cruzada entre duas contas."""
    owner = authenticated_user_factory("owner@example.com", "Project Owner")
    intruder = authenticated_user_factory("intruder@example.com", "Other User")
    owner_headers = headers(owner["access_token"])
    intruder_headers = headers(intruder["access_token"])

    project_response = client.post(
        "/api/v1/projects",
        json={"name": "Private project", "description": "Owner only"},
        headers=owner_headers,
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    task_response = client.post(
        "/api/v1/tasks",
        json={
            "project_id": project_id,
            "title": "Private task",
            "short_description": "Only the owner can access this task.",
            "description": "Ownership integration test.",
            "priority": "medium",
            "due_at": "2026-08-01T12:00:00Z",
        },
        headers=owner_headers,
    )
    assert task_response.status_code == 201
    task_id = task_response.json()["id"]

    assert (
        client.get(
            f"/api/v1/projects/{project_id}",
            headers=intruder_headers,
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/v1/projects/{project_id}",
            json={"name": "Unauthorized change"},
            headers=intruder_headers,
        ).status_code
        == 404
    )
    assert (
        client.delete(
            f"/api/v1/projects/{project_id}",
            headers=intruder_headers,
        ).status_code
        == 404
    )

    intruder_projects = client.get("/api/v1/projects", headers=intruder_headers)
    assert intruder_projects.status_code == 200
    assert intruder_projects.json()["total"] == 0

    cross_project_task = client.post(
        "/api/v1/tasks",
        json={
            "project_id": project_id,
            "title": "Unauthorized task",
            "short_description": "Must not be created in another account.",
            "priority": "high",
        },
        headers=intruder_headers,
    )
    assert cross_project_task.status_code == 404

    assert (
        client.get(
            f"/api/v1/tasks/{task_id}",
            headers=intruder_headers,
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/v1/tasks/{task_id}",
            json={"status": "cancelled"},
            headers=intruder_headers,
        ).status_code
        == 404
    )
    assert (
        client.delete(
            f"/api/v1/tasks/{task_id}",
            headers=intruder_headers,
        ).status_code
        == 404
    )

    intruder_tasks = client.get("/api/v1/tasks", headers=intruder_headers)
    assert intruder_tasks.status_code == 200
    assert intruder_tasks.json()["total"] == 0

    owner_task = client.get(f"/api/v1/tasks/{task_id}", headers=owner_headers)
    assert owner_task.status_code == 200
```

### `docs/AI_USAGE.md`

```markdown
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
```

### `docs/CURRENT_STATE.md`

```markdown
# Estado atual

## Concluído

- Diagnóstico do KanbanCore e decisões iniciais documentados.
- Arquitetura em camadas preservada.
- Revisions Alembic incluídas no versionamento.
- Baseline do esquema herdado criada.
- Migration incremental do contrato Taskly criada.
- Status `cancelled` adicionado.
- `short_description` adicionada como campo obrigatório.
- `due_date` substituído por `due_at` timezone-aware.
- Normalização UTC aplicada nos schemas de entrada.
- Persistência explícita dos valores textuais dos enums configurada.
- Regra de projeto arquivado como somente leitura aplicada às tarefas.
- Testes de ownership com dois usuários adicionados.
- Setup de testes alterado para executar migrations reais.
- CI ajustada para verificar todo o projeto com Ruff.

## Em desenvolvimento

- Validação da Etapa 02 no ambiente PostgreSQL do desenvolvedor.
- Correção de eventuais resultados reais de Ruff, Alembic e pytest.

## Pendente

- Registrar as saídas reais de `alembic upgrade head`, Ruff e pytest.
- Executar o commit da Etapa 02.
- Implementar endpoint de refresh token.
- Implementar tags relacionais.
- Implementar anexos e storage adapter.
- Criar frontend React/Vite/TypeScript.
- Implementar lista, kanban e drag-and-drop persistido.
- Consolidar Docker Compose fullstack, deploy e documentação final.

## Último commit

- Etapa 02 ainda não commitada.
- Mensagem planejada: `feat: adapta tarefas ao contrato do Taskly`
```

### `docs/DECISIONS.md`

```markdown
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
```

### `docs/prompts/etapa-02-modelo-tarefas.md`

```markdown
# Prompt da Etapa 02 — Baseline Alembic e modelo de tarefas

## Finalidade

Registrar como a IA foi utilizada para pesquisar alternativas, identificar riscos e revisar a proposta técnica da Etapa 02, mantendo decisão, aplicação e validação sob responsabilidade do desenvolvedor.

## Contexto fornecido pelo desenvolvedor

- Backend existente em FastAPI, SQLAlchemy 2.0, PostgreSQL e Alembic.
- Nenhuma revision Alembic estava versionada.
- O `.gitignore` descartava `alembic/versions/*.py`.
- A tarefa original possuía `description`, `due_date` e três status.
- O Taskly exige descrição curta, descrição completa, data e hora e status cancelado.
- Ownership, arquitetura em camadas, Ruff e testes devem ser preservados.
- O banco local anterior pode ser recriado.

## Solicitação feita à IA

> Compare estratégias de baseline Alembic e apresente uma implementação completa para adaptar tarefas ao Taskly. Considere enum PostgreSQL, migração de dados legados, timezone UTC, impacto em model, schema, repository, service, routes e testes. Inclua testes de ownership com dois usuários, não use pseudocódigo e não declare validações que não tenham sido executadas.

## Alternativas apresentadas

- baseline única já no modelo final;
- baseline do KanbanCore seguida de migration incremental;
- uso de `create_all()` versus aplicação real das migrations nos testes;
- persistência de nomes ou valores dos enums Python;
- conversão da data legada para início ou fim determinístico do dia.

## Decisões do desenvolvedor

- duas revisions Alembic;
- banco local recriável;
- enums persistidos pelos valores públicos minúsculos;
- `short_description` obrigatória;
- `due_at` timezone-aware normalizado em UTC;
- data legada convertida para 23:59 UTC;
- projetos arquivados somente leitura;
- Alembic executado no setup da suíte;
- ownership validado com duas contas independentes.

## Limites da assistência

A ferramenta organizou alternativas e produziu uma proposta sujeita a revisão. O desenvolvedor permanece responsável por aplicar os arquivos, revisar o diff, executar os comandos no PostgreSQL, interpretar resultados e aceitar ou corrigir a implementação.
```

## 6. Comandos de validação

### 6.1. Preparar banco local recriável

> Atenção: o comando abaixo remove o volume PostgreSQL local. Use apenas porque a decisão aprovada considera o banco desta fase descartável.

```bash
# Na raiz do backend
docker compose down -v
docker compose up -d db
```

Criar o banco de testes, caso ainda não exista:

```bash
docker exec -it projects-api-db createdb -U postgres projects_api_test
```

Se o banco já existir, o PostgreSQL informará isso; não é necessário recriá-lo.

### 6.2. Validar migrations

```bash
alembic history
alembic heads
alembic upgrade head
alembic current
```

Validação opcional de downgrade, somente em banco descartável:

```bash
alembic downgrade base
alembic upgrade head
```

Depois do teste de downgrade, mantenha o banco novamente em `head`.

### 6.3. Ruff

```bash
# Verificar erros de lint em todo o projeto
ruff check .

# Corrigir automaticamente o que for possível
ruff check . --fix

# Formatar o código
ruff format .

# Verificar formatação sem alterar
ruff format . --check
```

### 6.4. Testes

```bash
pytest
pytest --cov=app
```

O setup da suíte recria o schema apontado por `TEST_DATABASE_URL`. Confirme a variável antes de executar:

Linux/macOS:

```bash
echo "$DATABASE_URL"
echo "$TEST_DATABASE_URL"
```

PowerShell:

```powershell
$env:DATABASE_URL
$env:TEST_DATABASE_URL
```

### 6.5. Estado das validações na preparação

Foram executados:

- `python -m compileall -q app alembic`;
- `alembic heads`;
- `alembic history`;
- geração offline PostgreSQL de upgrade e downgrade;
- verificações diretas de schemas Pydantic;
- verificação do mapeamento dos enums SQLAlchemy;
- persistência auxiliar do model em SQLite.

Não foram executados com sucesso neste ambiente:

- Ruff, porque a ferramenta não estava instalada;
- pytest, porque dependências completas e PostgreSQL não estavam disponíveis;
- migrations online contra PostgreSQL.

Registre os resultados reais no `AI_USAGE.md` após executar os comandos no seu ambiente.

## 7. Passo a passo do commit

```bash
# 1. Verificar o que mudou
git status

# 2. Adicionar os arquivos da etapa
git add \
  .gitignore \
  .github/workflows/ci.yml \
  alembic/env.py \
  alembic/versions/0001_initial_kanbancore.py \
  alembic/versions/0002_adapt_tasks_to_taskly.py \
  app/models/project.py \
  app/models/task.py \
  app/schemas/task.py \
  app/repositories/task_repository.py \
  app/services/task_service.py \
  app/api/routes/tasks.py \
  app/tests/conftest.py \
  app/tests/test_tasks.py \
  app/tests/test_full_flow.py \
  app/tests/test_ownership.py \
  docs/AI_USAGE.md \
  docs/CURRENT_STATE.md \
  docs/DECISIONS.md \
  docs/prompts/etapa-02-modelo-tarefas.md \
  docs/etapas/etapa-02-modelo-tarefas.md

# 3. Rodar as validações antes de commitar
ruff check . --fix
ruff format .
ruff check .
ruff format . --check
pytest

# 4. Revisar o diff
git diff --cached

# 5. Commitar somente após validação real
git commit -m "feat: adapta tarefas ao contrato do Taskly"

# 6. Enviar para o remoto
git push origin main
```

## 8. Problemas comuns e como resolver

### Banco local já possui tabelas, mas não possui `alembic_version`

**Sintoma:** `relation "users" already exists` ao executar upgrade.

**Causa:** o banco foi criado anteriormente por `create_all()` ou por execução sem revisions.

**Solução desta fase:** como o banco foi aprovado como recriável, execute `docker compose down -v` e suba novamente.

### Enum apresenta valores em maiúsculas no banco antigo

**Sintoma:** labels como `TODO` e `ACTIVE` aparecem no PostgreSQL.

**Causa:** comportamento padrão de `Enum(PythonEnum)` no SQLAlchemy antigo.

**Solução:** recriar o banco com a baseline atual. Não aplique conversão manual em dados importantes sem uma migration específica de preservação.

### `TEST_DATABASE_URL` aponta para o banco de desenvolvimento

**Sintoma:** a suíte interrompe com mensagem de segurança.

**Solução:** configure um banco separado, por exemplo `projects_api_test`. Em CI, mantenha `APP_ENV=test` e use uma instância dedicada ao job.

### Datetime sem timezone retorna 422

**Sintoma:** payload como `2026-08-01T12:00:00` é rejeitado.

**Solução:** envie `Z` ou offset explícito, por exemplo `2026-08-01T12:00:00Z` ou `2026-08-01T09:00:00-03:00`.

### Downgrade transforma tarefas canceladas em não iniciadas

**Motivo:** o schema anterior não possuía `cancelled`. A migration documenta e aplica o mapeamento para `todo` antes de recriar o enum.

### Ruff altera arquivos após a geração

**Solução:** aceite a formatação, revise o diff e atualize a seção de validação do `AI_USAGE.md` com o resultado realmente obtido.

## 9. Checklist

- [x] Revisions deixaram de ser ignoradas pelo Git.
- [x] Baseline Alembic criada.
- [x] Migration incremental criada.
- [x] Upgrade e downgrade offline PostgreSQL inspecionados.
- [x] Valores textuais dos enums configurados.
- [x] Status `cancelled` implementado.
- [x] `short_description` implementada.
- [x] `due_at` timezone-aware implementado.
- [x] Filtro `due_before` adaptado para datetime.
- [x] Projetos arquivados tratados como somente leitura.
- [x] Testes de ownership entre dois usuários adicionados.
- [x] Testes passaram a preparar o banco por Alembic.
- [x] CI passou a aplicar Ruff em todo o projeto.
- [x] Documentação e prompt da etapa atualizados.
- [ ] `alembic upgrade head` executado online pelo desenvolvedor.
- [ ] Ruff executado e aprovado pelo desenvolvedor.
- [ ] pytest executado e aprovado pelo desenvolvedor.
- [ ] Resultados reais registrados em `AI_USAGE.md`.
- [ ] Commit executado.

## 10. Próxima etapa

**Etapa 03 — Tags relacionais**

A próxima etapa deverá criar:

- model `Tag` com ownership por usuário;
- associação many-to-many entre tarefas e tags;
- migration Alembic;
- schemas de entrada e resposta;
- resolução e normalização de tags no service;
- prevenção de associação cruzada entre usuários;
- filtros e testes de ownership;
- atualização da documentação e do uso de IA.
