# Etapa 04 — Anexos e abstração de armazenamento

## 1. Objetivo da etapa

Implementar anexos e fotos vinculados às tarefas do Taskly, mantendo os metadados no PostgreSQL e os bytes em um armazenamento desacoplado, com autenticação, ownership, validação de conteúdo, limites configuráveis e limpeza coordenada nas exclusões.

A etapa preserva a arquitetura em camadas do backend e mantém o provider externo de produção como decisão da fase de deploy.

## 2. O que foi feito e por quê

Foram preparados:

- entidade `Attachment` ligada à tarefa por chave estrangeira;
- migration `0004_add_attachments`;
- schemas de resposta de anexos;
- repository com ownership aplicado por `Attachment → Task → Project → owner_id`;
- service responsável por upload, validações, consulta e exclusão;
- interface `StorageBackend` e implementação local;
- endpoints autenticados de upload, listagem, conteúdo e exclusão;
- inclusão dos anexos nas respostas de tarefas;
- eager loading para evitar consultas N+1;
- limpeza física ao excluir anexo, tarefa ou projeto;
- configuração de tamanho, tipos permitidos e diretório;
- volume persistente no Docker Compose;
- storage temporário isolado nos testes;
- testes de ownership, tipo, assinatura, tamanho, projeto arquivado e limpeza;
- atualização de `AI_USAGE.md` e `CURRENT_STATE.md`;
- registro separado do prompt em `docs/prompts/prompt-etapa-04-anexos.md`.

Os bytes não são persistidos no banco porque isso aumentaria o tamanho das transações e acoplaria a evolução do storage ao PostgreSQL. O banco mantém somente os metadados necessários ao domínio e à interface.

## 3. Decisões técnicas tomadas

### 3.1. Interface de storage

**Alternativas consideradas:** filesystem direto no service, provider externo acoplado ou interface intercambiável.

**Decisão do desenvolvedor:** usar `StorageBackend` e um adapter local nesta etapa.

**Prós:** domínio independente do provider, testes isolados e troca futura por S3 sem alterar ownership.
**Contras:** exige uma camada adicional e o provider de produção ainda deverá ser configurado.

### 3.2. URL autenticada

**Alternativas consideradas:** URL pública do arquivo, URL assinada do provider ou endpoint protegido da API.

**Decisão do desenvolvedor:** armazenar uma URL relativa para endpoint autenticado.

**Prós:** reutiliza JWT e a mesma regra de ownership da API.
**Contras:** o backend participa do tráfego de download; em produção, URLs assinadas podem ser mais eficientes.

### 3.3. Tipos e tamanho

O MVP aceita JPEG, PNG, WebP e PDF, com limite padrão de 5 MiB. MIME, tamanho e assinatura inicial são validados.

**Prós:** reduz uploads acidentais ou evidentemente incompatíveis.
**Contras:** assinatura inicial não substitui antivírus ou inspeção profunda de conteúdo em um produto real.

### 3.4. Nome e chave física

O nome original é sanitizado apenas para exibição. A chave física usa usuário, tarefa e UUID.

**Prós:** evita colisões, caminhos manipulados e dependência do nome enviado pelo cliente.
**Contras:** o arquivo não pode ser localizado no provider apenas pelo nome original, exigindo os metadados.

### 3.5. Projetos arquivados

Upload e exclusão são bloqueados, enquanto listagem e download continuam permitidos.

**Motivo:** mantém a política de projeto arquivado como somente leitura sem tornar documentos históricos inacessíveis.

### 3.6. Limpeza física

Antes de excluir metadados, tarefa ou projeto, os arquivos associados são removidos pelo storage. A exclusão local é idempotente quando o arquivo já não existe.

**Trade-off:** falha de banco após remoção física é menos provável, mas ainda é uma possibilidade distribuída. Um produto com storage externo poderia adotar fila de compensação ou garbage collector.

### 3.7. `DECISIONS.md`

Não foi criada nova entrada global nesta etapa. A implementação concretiza a decisão já registrada sobre abstração de storage. Os detalhes operacionais ficam neste documento de etapa e em `AI_USAGE.md`, evitando decisões artificiais ou duplicadas.

## 4. Dependências entre arquivos e ordem de criação/alteração

A ordem recomendada é:

1. configuração: `backend/app/core/config.py` e `backend/.env.example`;
2. contrato do storage: `backend/app/storage/`;
3. model e migration: `attachment.py`, relacionamento em `task.py` e revision `0004`;
4. schema de resposta;
5. repository de metadados;
6. service de anexos e novos erros de domínio;
7. dependency provider do storage;
8. rotas e registro no router principal;
9. integração de anexos às queries e respostas de tarefas;
10. limpeza física nos services de tarefa e projeto;
11. isolamento do storage e testes;
12. Docker Compose e `.gitignore`;
13. documentação da etapa, prompt, `AI_USAGE.md` e `CURRENT_STATE.md`.

## 5. Conteúdo completo dos arquivos criados ou alterados

O conteúdo deste próprio arquivo não é repetido dentro dele para evitar recursão. Os demais arquivos da etapa aparecem integralmente abaixo.

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

# Frontend
node_modules/
frontend/dist/
frontend/.vite/
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
```

### `backend/.env.example`

```env
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
# Anexos são armazenados fora do banco; caminhos relativos partem de backend/.
ATTACHMENT_STORAGE_DIR="storage/attachments"
ATTACHMENT_MAX_SIZE_BYTES=5242880
ATTACHMENT_ALLOWED_CONTENT_TYPES="image/jpeg,image/png,image/webp,application/pdf"
```

### `backend/alembic/versions/0004_add_attachments.py`

```python
"""Add attachment metadata linked to tasks.

Revision ID: 0004_add_attachments
Revises: 0003_add_relational_tags
Create Date: 2026-07-31
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_add_attachments"
down_revision: str | None = "0003_add_relational_tags"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create attachment metadata while keeping file bytes outside PostgreSQL."""
    op.create_table(
        "attachments",
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
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
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key"),
        sa.UniqueConstraint("url"),
    )
    op.create_index(
        "ix_attachments_task_id",
        "attachments",
        ["task_id"],
        unique=False,
    )


def downgrade() -> None:
    """Remove metadata; physical files require external cleanup if downgraded."""
    op.drop_index("ix_attachments_task_id", table_name="attachments")
    op.drop_table("attachments")
```

### `backend/app/api/router.py`

```python
from fastapi import APIRouter

from app.api.routes.attachments import router as attachments_router
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
api_router.include_router(attachments_router)
```

### `backend/app/api/routes/attachments.py`

```python
from typing import Annotated
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_storage_backend
from app.models.user import User
from app.schemas.attachment import AttachmentResponse
from app.services.attachment_service import AttachmentService
from app.storage import StorageBackend

router = APIRouter(tags=["attachments"])


@router.post(
    "/tasks/{task_id}/attachments",
    response_model=AttachmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    task_id: UUID,
    file: Annotated[UploadFile, File(description="JPEG, PNG, WebP or PDF")],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[StorageBackend, Depends(get_storage_backend)],
) -> AttachmentResponse:
    """Adiciona um anexo a uma tarefa própria de projeto ativo."""
    service = AttachmentService(db, storage)
    attachment = await service.upload_attachment(
        owner_id=current_user.id,
        task_id=task_id,
        upload=file,
    )
    return AttachmentResponse.model_validate(attachment)


@router.get(
    "/tasks/{task_id}/attachments",
    response_model=list[AttachmentResponse],
)
def list_attachments(
    task_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[StorageBackend, Depends(get_storage_backend)],
) -> list[AttachmentResponse]:
    """Lista os metadados dos anexos de uma tarefa autorizada."""
    service = AttachmentService(db, storage)
    attachments = service.list_task_attachments(current_user.id, task_id)
    return [AttachmentResponse.model_validate(item) for item in attachments]


@router.get("/attachments/{attachment_id}/content")
def download_attachment(
    attachment_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[StorageBackend, Depends(get_storage_backend)],
) -> StreamingResponse:
    """Entrega o conteúdo apenas quando o anexo pertence ao usuário atual."""
    service = AttachmentService(db, storage)
    attachment = service.get_attachment_for_owner(attachment_id, current_user.id)
    stream = storage.open(attachment.storage_key)
    encoded_name = quote(attachment.name)

    return StreamingResponse(
        stream,
        media_type=attachment.content_type,
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{encoded_name}",
            "Content-Length": str(attachment.size_bytes),
        },
        background=BackgroundTask(stream.close),
    )


@router.delete(
    "/attachments/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_attachment(
    attachment_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[StorageBackend, Depends(get_storage_backend)],
) -> Response:
    """Remove metadados e conteúdo físico de um anexo próprio."""
    service = AttachmentService(db, storage)
    service.delete_attachment(attachment_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

### `backend/app/api/routes/projects.py`

```python
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_storage_backend
from app.models.project import ProjectStatus
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services.project_service import ProjectService
from app.storage import StorageBackend

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    project_data: ProjectCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[StorageBackend, Depends(get_storage_backend)],
) -> ProjectResponse:
    """Cria um projeto para o usuário autenticado.

    O `owner_id` não vem do body da request. Ele vem do usuário autenticado,
    garantindo que ninguém crie projetos em nome de outro usuário.
    """
    service = ProjectService(db, storage)
    project = service.create_project(
        owner_id=current_user.id,
        project_data=project_data,
    )

    return ProjectResponse.model_validate(project)


@router.get(
    "",
    response_model=PaginatedResponse[ProjectResponse],
)
def list_projects(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[StorageBackend, Depends(get_storage_backend)],
    page: Annotated[int, Query(ge=1, examples=[1])] = 1,
    size: Annotated[int, Query(ge=1, le=100, examples=[20])] = 20,
    status_filter: Annotated[
        ProjectStatus | None,
        Query(alias="status", examples=[ProjectStatus.ACTIVE]),
    ] = None,
    search: Annotated[
        str | None,
        Query(min_length=1, max_length=160, examples=["portfolio"]),
    ] = None,
) -> PaginatedResponse[ProjectResponse]:
    """Lista projetos do usuário autenticado com paginação e filtros.

    Filtros disponíveis:
    - `status`: active ou archived;
    - `search`: busca parcial no nome do projeto.
    """
    service = ProjectService(db, storage)

    return service.list_projects(
        owner_id=current_user.id,
        page=page,
        size=size,
        status=status_filter,
        search=search,
    )


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
)
def get_project(
    project_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[StorageBackend, Depends(get_storage_backend)],
) -> ProjectResponse:
    """Busca um projeto específico do usuário autenticado.

    O service valida ownership. Se o projeto não for do usuário,
    retornaremos 404 para não revelar a existência de recurso de outra conta.
    """
    service = ProjectService(db, storage)
    project = service.get_project_for_owner(
        project_id=project_id,
        owner_id=current_user.id,
    )

    return ProjectResponse.model_validate(project)


@router.patch(
    "/{project_id}",
    response_model=ProjectResponse,
)
def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[StorageBackend, Depends(get_storage_backend)],
) -> ProjectResponse:
    """Atualiza parcialmente um projeto do usuário autenticado.

    Como usamos `ProjectUpdate`, todos os campos são opcionais.
    Apenas os campos enviados serão alterados.
    """
    service = ProjectService(db, storage)
    project = service.update_project(
        project_id=project_id,
        owner_id=current_user.id,
        project_data=project_data,
    )

    return ProjectResponse.model_validate(project)


@router.patch(
    "/{project_id}/archive",
    response_model=ProjectResponse,
)
def archive_project(
    project_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[StorageBackend, Depends(get_storage_backend)],
) -> ProjectResponse:
    """Arquiva um projeto.

    Esta rota representa uma ação de negócio explícita, mais clara do que
    apenas fazer PATCH manual no campo `status`.
    """
    service = ProjectService(db, storage)
    project = service.archive_project(
        project_id=project_id,
        owner_id=current_user.id,
    )

    return ProjectResponse.model_validate(project)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_project(
    project_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[StorageBackend, Depends(get_storage_backend)],
) -> Response:
    """Remove um projeto do usuário autenticado.

    As tarefas relacionadas serão removidas por cascade conforme configurado
    nos models SQLAlchemy.
    """
    service = ProjectService(db, storage)
    service.delete_project(
        project_id=project_id,
        owner_id=current_user.id,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

### `backend/app/api/routes/tasks.py`

```python
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_storage_backend
from app.models.task import TaskPriority, TaskStatus
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate, UtcDateTime
from app.services.task_service import TaskService
from app.storage import StorageBackend

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
    storage: Annotated[StorageBackend, Depends(get_storage_backend)],
) -> TaskResponse:
    """Cria uma tarefa em um projeto ativo do usuário autenticado."""
    service = TaskService(db, storage)
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
    storage: Annotated[StorageBackend, Depends(get_storage_backend)],
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
    service = TaskService(db, storage)

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
    storage: Annotated[StorageBackend, Depends(get_storage_backend)],
) -> TaskResponse:
    """Busca uma tarefa específica do usuário autenticado."""
    service = TaskService(db, storage)
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
    storage: Annotated[StorageBackend, Depends(get_storage_backend)],
) -> TaskResponse:
    """Atualiza parcialmente uma tarefa de projeto ativo."""
    service = TaskService(db, storage)
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
    storage: Annotated[StorageBackend, Depends(get_storage_backend)],
) -> TaskResponse:
    """Marca uma tarefa como concluída quando o projeto está ativo."""
    service = TaskService(db, storage)
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
    storage: Annotated[StorageBackend, Depends(get_storage_backend)],
) -> Response:
    """Remove uma tarefa de projeto ativo do usuário autenticado."""
    service = TaskService(db, storage)
    service.delete_task(
        task_id=task_id,
        owner_id=current_user.id,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

### `backend/app/core/config.py`

```python
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

    attachment_storage_dir: Path = Field(
        default=Path("storage/attachments"),
        alias="ATTACHMENT_STORAGE_DIR",
    )
    attachment_max_size_bytes: int = Field(
        default=5 * 1024 * 1024,
        alias="ATTACHMENT_MAX_SIZE_BYTES",
        gt=0,
    )
    attachment_allowed_content_types: str = Field(
        default="image/jpeg,image/png,image/webp,application/pdf",
        alias="ATTACHMENT_ALLOWED_CONTENT_TYPES",
    )

    model_config = SettingsConfigDict(
        # O caminho absoluto evita que a leitura dependa de executar o comando
        # na raiz do repositório ou dentro de `backend/`.
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def attachment_storage_path(self) -> Path:
        """Resolve caminhos relativos a partir da raiz real do backend."""
        if self.attachment_storage_dir.is_absolute():
            return self.attachment_storage_dir

        return BACKEND_ROOT / self.attachment_storage_dir

    @property
    def attachment_allowed_content_type_set(self) -> set[str]:
        return {
            content_type.strip().lower()
            for content_type in self.attachment_allowed_content_types.split(",")
            if content_type.strip()
        }

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
```

### `backend/app/core/dependencies.py`

```python
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_token_subject
from app.models.user import User
from app.services.exceptions import ForbiddenError
from app.services.user_service import UserService
from app.storage import LocalStorageBackend, StorageBackend

# tokenUrl informa ao Swagger onde o usuário consegue obter um token.
# Como nossas rotas terão prefixo /api/v1, o caminho completo fica abaixo.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """Retorna o usuário autenticado a partir do token Bearer.

    Esta dependência será usada em rotas protegidas.
    Ela valida:
    - token JWT;
    - tipo do token;
    - existência do usuário;
    - se o usuário está ativo.
    """
    try:
        user_id = get_token_subject(token, expected_type="access")
    except JWTError as exc:
        raise ForbiddenError("Invalid or expired token") from exc

    user_service = UserService(db)
    user = user_service.get_user_by_id(user_id)

    if not user.is_active:
        raise ForbiddenError("Inactive user")

    return user


@lru_cache(maxsize=1)
def get_storage_backend() -> StorageBackend:
    """Fornece o adapter configurado sem acoplar services ao filesystem."""
    settings = get_settings()
    return LocalStorageBackend(settings.attachment_storage_path)
```

### `backend/app/models/__init__.py`

```python
from app.models.attachment import Attachment
from app.models.project import Project, ProjectStatus
from app.models.tag import Tag, task_tags_table
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User

__all__ = [
    "Attachment",
    "Project",
    "ProjectStatus",
    "Tag",
    "Task",
    "TaskPriority",
    "TaskStatus",
    "User",
    "task_tags_table",
]
```

### `backend/app/models/attachment.py`

```python
from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.task import Task


class Attachment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "attachments"

    task_id: Mapped[UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    url: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)

    task: Mapped[Task] = relationship(back_populates="attachments")
```

### `backend/app/models/task.py`

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
from app.models.tag import task_tags_table

if TYPE_CHECKING:
    from app.models.attachment import Attachment
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
    attachments: Mapped[list[Attachment]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Attachment.created_at",
    )
    tags: Mapped[list[Tag]] = relationship(
        secondary=task_tags_table,
        back_populates="tasks",
        order_by="Tag.name",
    )
```

### `backend/app/repositories/attachment_repository.py`

```python
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.attachment import Attachment
from app.models.project import Project
from app.models.task import Task


class AttachmentRepository:
    """Acesso a metadados de anexos com ownership validado na query."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, attachment: Attachment) -> Attachment:
        self.db.add(attachment)
        self.db.commit()
        self.db.refresh(attachment)
        return attachment

    def get_by_id_and_owner(
        self,
        attachment_id: UUID,
        owner_id: UUID,
    ) -> Attachment | None:
        statement = (
            select(Attachment)
            .join(Task, Attachment.task_id == Task.id)
            .join(Project, Task.project_id == Project.id)
            .where(
                Attachment.id == attachment_id,
                Project.owner_id == owner_id,
            )
        )
        return self.db.scalar(statement)

    def list_by_task_and_owner(
        self,
        task_id: UUID,
        owner_id: UUID,
    ) -> list[Attachment]:
        statement = (
            select(Attachment)
            .join(Task, Attachment.task_id == Task.id)
            .join(Project, Task.project_id == Project.id)
            .where(
                Attachment.task_id == task_id,
                Project.owner_id == owner_id,
            )
            .order_by(Attachment.created_at.asc())
        )
        return list(self.db.scalars(statement).all())

    def list_by_project_and_owner(
        self,
        project_id: UUID,
        owner_id: UUID,
    ) -> list[Attachment]:
        statement = (
            select(Attachment)
            .join(Task, Attachment.task_id == Task.id)
            .join(Project, Task.project_id == Project.id)
            .where(
                Project.id == project_id,
                Project.owner_id == owner_id,
            )
            .order_by(Attachment.created_at.asc())
        )
        return list(self.db.scalars(statement).all())

    def delete(self, attachment: Attachment) -> None:
        self.db.delete(attachment)
        self.db.commit()
```

### `backend/app/repositories/task_repository.py`

```python
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
            .options(selectinload(Task.tags), selectinload(Task.attachments))
            .where(Task.id == task_id)
        )

        return self.db.scalar(statement)

    def get_by_id_and_owner(self, task_id: UUID, owner_id: UUID) -> Task | None:
        """Busca a tarefa somente quando seu projeto pertence ao usuário."""
        statement = (
            select(Task)
            .options(selectinload(Task.tags), selectinload(Task.attachments))
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
            .options(selectinload(Task.tags), selectinload(Task.attachments))
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
```

### `backend/app/schemas/attachment.py`

```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    name: str
    url: str
    content_type: str
    size_bytes: int
    created_at: datetime
```

### `backend/app/schemas/task.py`

```python
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
from app.schemas.attachment import AttachmentResponse
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
    attachments: list[AttachmentResponse]
    created_at: datetime
    updated_at: datetime
```

### `backend/app/services/attachment_service.py`

```python
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.models.attachment import Attachment
from app.models.project import ProjectStatus
from app.models.task import Task
from app.repositories.attachment_repository import AttachmentRepository
from app.repositories.project_repository import ProjectRepository
from app.repositories.task_repository import TaskRepository
from app.services.exceptions import (
    BadRequestError,
    NotFoundError,
    PayloadTooLargeError,
    UnsupportedMediaTypeError,
)
from app.storage import StorageBackend

_CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
}


class AttachmentService:
    """Orquestra ownership, validação, metadados e armazenamento de anexos."""

    def __init__(
        self,
        db: Session,
        storage: StorageBackend,
        settings: Settings | None = None,
    ) -> None:
        self.repository = AttachmentRepository(db)
        self.task_repository = TaskRepository(db)
        self.project_repository = ProjectRepository(db)
        self.storage = storage
        self.settings = settings or get_settings()

    async def upload_attachment(
        self,
        owner_id: UUID,
        task_id: UUID,
        upload: UploadFile,
    ) -> Attachment:
        """Valida e persiste um arquivo somente em tarefa própria e editável."""
        task = self._get_task_for_owner(task_id=task_id, owner_id=owner_id)
        self._ensure_project_is_active(task.project_id, owner_id)

        content_type = (upload.content_type or "").strip().lower()
        if (
            content_type not in self.settings.attachment_allowed_content_type_set
            or content_type not in _CONTENT_TYPE_EXTENSIONS
        ):
            raise UnsupportedMediaTypeError("Attachment type is not allowed")

        original_name = self._sanitize_name(upload.filename)

        try:
            content = await upload.read(self.settings.attachment_max_size_bytes + 1)
        finally:
            await upload.close()

        if not content:
            raise BadRequestError("Attachment cannot be empty")

        if len(content) > self.settings.attachment_max_size_bytes:
            raise PayloadTooLargeError(
                "Attachment exceeds the configured size limit"
            )

        if not self._matches_signature(content_type, content):
            raise UnsupportedMediaTypeError(
                "Attachment content does not match its declared type"
            )

        attachment_id = uuid4()
        extension = _CONTENT_TYPE_EXTENSIONS[content_type]
        storage_key = f"{owner_id}/{task_id}/{attachment_id.hex}{extension}"
        url = f"/api/v1/attachments/{attachment_id}/content"
        attachment = Attachment(
            id=attachment_id,
            task_id=task_id,
            name=original_name,
            storage_key=storage_key,
            url=url,
            content_type=content_type,
            size_bytes=len(content),
        )

        self.storage.save(storage_key, content)
        try:
            return self.repository.create(attachment)
        except Exception:
            # Se a persistência dos metadados falhar, o arquivo não deve ficar
            # órfão no provider. A exceção original continua sendo propagada.
            self.storage.delete(storage_key)
            raise

    def list_task_attachments(
        self,
        owner_id: UUID,
        task_id: UUID,
    ) -> list[Attachment]:
        self._get_task_for_owner(task_id=task_id, owner_id=owner_id)
        return self.repository.list_by_task_and_owner(task_id, owner_id)

    def get_attachment_for_owner(
        self,
        attachment_id: UUID,
        owner_id: UUID,
    ) -> Attachment:
        attachment = self.repository.get_by_id_and_owner(attachment_id, owner_id)
        if attachment is None:
            raise NotFoundError("Attachment not found")

        return attachment

    def delete_attachment(self, attachment_id: UUID, owner_id: UUID) -> None:
        attachment = self.get_attachment_for_owner(attachment_id, owner_id)
        task = self._get_task_for_owner(attachment.task_id, owner_id)
        self._ensure_project_is_active(task.project_id, owner_id)

        # A remoção física vem primeiro: se o provider estiver indisponível, os
        # metadados permanecem e a operação pode ser repetida com segurança.
        self.storage.delete(attachment.storage_key)
        self.repository.delete(attachment)

    def _get_task_for_owner(self, task_id: UUID, owner_id: UUID) -> Task:
        task = self.task_repository.get_by_id_and_owner(task_id, owner_id)
        if task is None:
            raise NotFoundError("Task not found")
        return task

    def _ensure_project_is_active(self, project_id: UUID, owner_id: UUID) -> None:
        project = self.project_repository.get_by_id_and_owner(project_id, owner_id)
        if project is None:
            raise NotFoundError("Project not found")
        if project.status == ProjectStatus.ARCHIVED:
            raise BadRequestError("Cannot modify attachments in archived projects")

    @staticmethod
    def _sanitize_name(filename: str | None) -> str:
        if filename is None or not filename.strip():
            raise BadRequestError("Attachment filename is required")

        # Path.name remove segmentos fornecidos pelo cliente e impede que o
        # nome original seja interpretado como caminho pelo storage.
        name = Path(filename.replace("\\", "/")).name.strip()
        if not name or "\x00" in name:
            raise BadRequestError("Invalid attachment filename")

        return name[:255]

    @staticmethod
    def _matches_signature(content_type: str, content: bytes) -> bool:
        if content_type == "image/jpeg":
            return content.startswith(b"\xff\xd8\xff")
        if content_type == "image/png":
            return content.startswith(b"\x89PNG\r\n\x1a\n")
        if content_type == "image/webp":
            return (
                len(content) >= 12
                and content.startswith(b"RIFF")
                and content[8:12] == b"WEBP"
            )
        if content_type == "application/pdf":
            return content.startswith(b"%PDF-")

        return False
```

### `backend/app/services/exceptions.py`

```python
class ServiceError(Exception):
    """Classe base para erros esperados da camada de service.

    Criar uma base comum facilita o tratamento global de erros depois,
    quando adicionarmos handlers no FastAPI.
    """

    status_code = 400
    detail = "Service error"

    def __init__(self, detail: str | None = None) -> None:
        if detail is not None:
            self.detail = detail

        super().__init__(self.detail)


class NotFoundError(ServiceError):
    """Erro para recursos não encontrados."""

    status_code = 404
    detail = "Resource not found"


class ConflictError(ServiceError):
    """Erro para conflitos de estado, como e-mail duplicado."""

    status_code = 409
    detail = "Resource already exists"


class ForbiddenError(ServiceError):
    """Erro para ações não permitidas para o usuário atual."""

    status_code = 403
    detail = "Forbidden"


class BadRequestError(ServiceError):
    """Erro para requisições inválidas do ponto de vista de negócio."""

    status_code = 400
    detail = "Bad request"


class UnsupportedMediaTypeError(ServiceError):
    """Erro para anexos com tipo declarado ou assinatura não permitidos."""

    status_code = 415
    detail = "Unsupported media type"


class PayloadTooLargeError(ServiceError):
    """Erro para arquivos que ultrapassam o limite configurado."""

    status_code = 413
    detail = "Payload too large"


class StorageError(ServiceError):
    """Erro de infraestrutura ao gravar, ler ou excluir conteúdo físico."""

    status_code = 500
    detail = "Attachment storage error"
```

### `backend/app/services/project_service.py`

```python
from math import ceil
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.project import Project, ProjectStatus
from app.repositories.attachment_repository import AttachmentRepository
from app.repositories.project_repository import ProjectRepository
from app.schemas.common import PaginatedResponse
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services.exceptions import NotFoundError
from app.storage import StorageBackend


class ProjectService:
    """Regras de negócio relacionadas a projetos."""

    def __init__(self, db: Session, storage: StorageBackend) -> None:
        self.repository = ProjectRepository(db)
        self.attachment_repository = AttachmentRepository(db)
        self.storage = storage

    def create_project(self, owner_id: UUID, project_data: ProjectCreate) -> Project:
        """Cria um projeto para o usuário autenticado.

        A rota futura obterá `owner_id` a partir do token JWT.
        """
        return self.repository.create(owner_id=owner_id, project_data=project_data)

    def get_project_for_owner(self, project_id: UUID, owner_id: UUID) -> Project:
        """Busca um projeto garantindo que pertence ao usuário.

        Essa validação é essencial para impedir acesso cruzado entre contas.
        """
        project = self.repository.get_by_id_and_owner(
            project_id=project_id,
            owner_id=owner_id,
        )

        if project is None:
            # Retornamos "not found" em vez de "forbidden" para não revelar
            # se o recurso existe em outra conta.
            raise NotFoundError("Project not found")

        return project

    def list_projects(
        self,
        owner_id: UUID,
        page: int = 1,
        size: int = 20,
        status: ProjectStatus | None = None,
        search: str | None = None,
    ) -> PaginatedResponse[ProjectResponse]:
        """Lista projetos do usuário com paginação e filtros.

        O service monta a resposta paginada porque ela é uma regra de
        apresentação da aplicação, não uma query isolada do banco.
        """
        items = self.repository.list_by_owner(
            owner_id=owner_id,
            page=page,
            size=size,
            status=status,
            search=search,
        )
        total = self.repository.count_by_owner(
            owner_id=owner_id,
            status=status,
            search=search,
        )

        pages = ceil(total / size) if total > 0 else 0

        return PaginatedResponse[ProjectResponse](
            items=[ProjectResponse.model_validate(item) for item in items],
            total=total,
            page=page,
            size=size,
            pages=pages,
        )

    def update_project(
        self,
        project_id: UUID,
        owner_id: UUID,
        project_data: ProjectUpdate,
    ) -> Project:
        """Atualiza um projeto pertencente ao usuário."""
        project = self.get_project_for_owner(
            project_id=project_id,
            owner_id=owner_id,
        )

        return self.repository.update(project, project_data)

    def archive_project(self, project_id: UUID, owner_id: UUID) -> Project:
        """Arquiva um projeto.

        Arquivar é uma regra de negócio mais expressiva do que apenas
        atualizar o campo `status` diretamente.
        """
        project = self.get_project_for_owner(
            project_id=project_id,
            owner_id=owner_id,
        )

        project_data = ProjectUpdate(status=ProjectStatus.ARCHIVED)

        return self.repository.update(project, project_data)

    def delete_project(self, project_id: UUID, owner_id: UUID) -> None:
        """Remove um projeto pertencente ao usuário."""
        project = self.get_project_for_owner(
            project_id=project_id,
            owner_id=owner_id,
        )

        attachments = self.attachment_repository.list_by_project_and_owner(
            project_id=project_id,
            owner_id=owner_id,
        )
        for attachment in attachments:
            self.storage.delete(attachment.storage_key)

        self.repository.delete(project)
```

### `backend/app/services/task_service.py`

```python
from datetime import datetime
from math import ceil
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.project import ProjectStatus
from app.models.tag import Tag
from app.models.task import Task, TaskPriority, TaskStatus
from app.repositories.attachment_repository import AttachmentRepository
from app.repositories.project_repository import ProjectRepository
from app.repositories.tag_repository import TagRepository
from app.repositories.task_repository import TaskRepository
from app.schemas.common import PaginatedResponse
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate
from app.services.exceptions import BadRequestError, NotFoundError
from app.storage import StorageBackend


class TaskService:
    """Regras de negócio relacionadas a tarefas."""

    def __init__(self, db: Session, storage: StorageBackend) -> None:
        self.repository = TaskRepository(db)
        self.attachment_repository = AttachmentRepository(db)
        self.storage = storage
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

        attachments = self.attachment_repository.list_by_task_and_owner(
            task_id=task_id,
            owner_id=owner_id,
        )
        for attachment in attachments:
            self.storage.delete(attachment.storage_key)

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
```

### `backend/app/storage/__init__.py`

```python
from app.storage.base import StorageBackend
from app.storage.local import LocalStorageBackend

__all__ = ["LocalStorageBackend", "StorageBackend"]
```

### `backend/app/storage/base.py`

```python
from abc import ABC, abstractmethod
from typing import BinaryIO


class StorageBackend(ABC):
    """Contrato mínimo para armazenar bytes fora do banco de dados.

    A camada de serviço conhece apenas esta interface. Assim, a implementação
    local usada no case pode ser trocada por S3 ou outro provider sem alterar
    regras de ownership, validação de arquivos ou metadados persistidos.
    """

    @abstractmethod
    def save(self, key: str, content: bytes) -> None:
        """Persiste o conteúdo usando uma chave interna não fornecida pelo usuário."""

    @abstractmethod
    def open(self, key: str) -> BinaryIO:
        """Abre o arquivo para leitura binária pelo endpoint autenticado."""

    @abstractmethod
    def delete(self, key: str) -> None:
        """Remove o arquivo; a operação deve ser idempotente quando ele não existir."""

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Informa se a chave possui conteúdo persistido."""
```

### `backend/app/storage/local.py`

```python
from pathlib import Path
from typing import BinaryIO

from app.services.exceptions import StorageError
from app.storage.base import StorageBackend


class LocalStorageBackend(StorageBackend):
    """Armazena anexos em diretório local com proteção contra path traversal."""

    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, key: str, content: bytes) -> None:
        destination = self._resolve_key(key)
        destination.parent.mkdir(parents=True, exist_ok=True)

        # A escrita temporária reduz o risco de manter arquivo parcialmente
        # gravado caso o processo seja interrompido durante o upload.
        temporary = destination.with_name(f".{destination.name}.tmp")
        try:
            temporary.write_bytes(content)
            temporary.replace(destination)
        except OSError as exc:
            temporary.unlink(missing_ok=True)
            raise StorageError("Could not store attachment") from exc

    def open(self, key: str) -> BinaryIO:
        path = self._resolve_key(key)

        try:
            return path.open("rb")
        except FileNotFoundError as exc:
            raise StorageError("Attachment content not found") from exc
        except OSError as exc:
            raise StorageError("Could not read attachment") from exc

    def delete(self, key: str) -> None:
        path = self._resolve_key(key)

        try:
            path.unlink(missing_ok=True)
        except OSError as exc:
            raise StorageError("Could not delete attachment") from exc

    def exists(self, key: str) -> bool:
        return self._resolve_key(key).is_file()

    def _resolve_key(self, key: str) -> Path:
        """Mantém qualquer chave, inclusive uma vinda do banco, dentro da raiz."""
        candidate = (self.root / key).resolve()

        if candidate != self.root and self.root not in candidate.parents:
            raise StorageError("Invalid attachment storage key")

        return candidate
```

### `backend/app/tests/conftest.py`

```python
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
from app.core.dependencies import get_storage_backend
from app.main import app
from app.storage import LocalStorageBackend

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
def storage_backend(tmp_path: Path) -> LocalStorageBackend:
    """Isola os bytes de anexos em um diretório temporário por teste."""
    return LocalStorageBackend(tmp_path / "attachments")


@pytest.fixture()
def client(
    db_session: Session,
    storage_backend: LocalStorageBackend,
) -> Generator[TestClient, None, None]:
    """Substitui a sessão da aplicação pela sessão transacional do teste."""

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    def override_storage_backend() -> LocalStorageBackend:
        return storage_backend

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_storage_backend] = override_storage_backend

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

### `backend/app/tests/test_attachments.py`

```python
from collections.abc import Callable

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.storage import LocalStorageBackend

PNG_CONTENT = b"\x89PNG\r\n\x1a\n" + b"taskly-image"
PDF_CONTENT = b"%PDF-1.7\n% taskly test"


def headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def create_project(
    client: TestClient,
    auth_headers: dict[str, str],
    name: str = "Attachments project",
) -> dict[str, str]:
    response = client.post(
        "/api/v1/projects",
        json={"name": name, "description": "Project used by attachment tests."},
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()


def create_task(
    client: TestClient,
    auth_headers: dict[str, str],
    project_id: str,
) -> dict[str, object]:
    response = client.post(
        "/api/v1/tasks",
        json={
            "project_id": project_id,
            "title": "Implement attachments",
            "short_description": "Store task files behind an adapter.",
            "tags": ["backend"],
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()


def upload_png(
    client: TestClient,
    auth_headers: dict[str, str],
    task_id: str,
    name: str = "evidence.png",
) -> dict[str, object]:
    response = client.post(
        f"/api/v1/tasks/{task_id}/attachments",
        files={"file": (name, PNG_CONTENT, "image/png")},
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()


def test_upload_list_download_and_task_response(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    task = create_task(client, auth_headers, created_project["id"])
    attachment = upload_png(client, auth_headers, str(task["id"]), "../evidence.png")

    assert attachment["name"] == "evidence.png"
    assert attachment["content_type"] == "image/png"
    assert attachment["size_bytes"] == len(PNG_CONTENT)
    assert attachment["url"].endswith(f"/{attachment['id']}/content")

    list_response = client.get(
        f"/api/v1/tasks/{task['id']}/attachments",
        headers=auth_headers,
    )
    assert list_response.status_code == 200
    assert list_response.json() == [attachment]

    task_response = client.get(
        f"/api/v1/tasks/{task['id']}",
        headers=auth_headers,
    )
    assert task_response.status_code == 200
    assert task_response.json()["attachments"] == [attachment]

    content_response = client.get(attachment["url"], headers=auth_headers)
    assert content_response.status_code == 200
    assert content_response.content == PNG_CONTENT
    assert content_response.headers["content-type"] == "image/png"
    assert "evidence.png" in content_response.headers["content-disposition"]


def test_rejects_unsupported_mismatched_empty_and_oversized_files(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    task = create_task(client, auth_headers, created_project["id"])
    endpoint = f"/api/v1/tasks/{task['id']}/attachments"

    unsupported = client.post(
        endpoint,
        files={"file": ("notes.txt", b"text", "text/plain")},
        headers=auth_headers,
    )
    assert unsupported.status_code == 415

    mismatched = client.post(
        endpoint,
        files={"file": ("fake.png", PDF_CONTENT, "image/png")},
        headers=auth_headers,
    )
    assert mismatched.status_code == 415

    empty = client.post(
        endpoint,
        files={"file": ("empty.pdf", b"", "application/pdf")},
        headers=auth_headers,
    )
    assert empty.status_code == 400

    oversized_content = b"%PDF-" + b"x" * get_settings().attachment_max_size_bytes
    oversized = client.post(
        endpoint,
        files={"file": ("large.pdf", oversized_content, "application/pdf")},
        headers=auth_headers,
    )
    assert oversized.status_code == 413


def test_attachment_ownership_is_enforced(
    client: TestClient,
    authenticated_user_factory: Callable[[str, str], dict[str, str]],
) -> None:
    first = authenticated_user_factory("attachment-a@example.com", "Attachment A")
    second = authenticated_user_factory("attachment-b@example.com", "Attachment B")
    first_headers = headers(first["access_token"])
    second_headers = headers(second["access_token"])

    project = create_project(client, first_headers)
    task = create_task(client, first_headers, project["id"])
    attachment = upload_png(client, first_headers, str(task["id"]))

    foreign_upload = client.post(
        f"/api/v1/tasks/{task['id']}/attachments",
        files={"file": ("foreign.png", PNG_CONTENT, "image/png")},
        headers=second_headers,
    )
    foreign_list = client.get(
        f"/api/v1/tasks/{task['id']}/attachments",
        headers=second_headers,
    )
    foreign_download = client.get(attachment["url"], headers=second_headers)
    foreign_delete = client.delete(
        f"/api/v1/attachments/{attachment['id']}",
        headers=second_headers,
    )

    assert foreign_upload.status_code == 404
    assert foreign_list.status_code == 404
    assert foreign_download.status_code == 404
    assert foreign_delete.status_code == 404


def test_archived_project_is_read_only_for_attachments(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    task = create_task(client, auth_headers, created_project["id"])
    attachment = upload_png(client, auth_headers, str(task["id"]))

    archive_response = client.patch(
        f"/api/v1/projects/{created_project['id']}/archive",
        headers=auth_headers,
    )
    assert archive_response.status_code == 200

    upload_response = client.post(
        f"/api/v1/tasks/{task['id']}/attachments",
        files={"file": ("new.png", PNG_CONTENT, "image/png")},
        headers=auth_headers,
    )
    delete_response = client.delete(
        f"/api/v1/attachments/{attachment['id']}",
        headers=auth_headers,
    )
    download_response = client.get(attachment["url"], headers=auth_headers)

    assert upload_response.status_code == 400
    assert delete_response.status_code == 400
    assert download_response.status_code == 200


def test_delete_attachment_and_task_remove_physical_files(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
    storage_backend: LocalStorageBackend,
) -> None:
    first_task = create_task(client, auth_headers, created_project["id"])
    first_attachment = upload_png(client, auth_headers, str(first_task["id"]))
    assert any(path.is_file() for path in storage_backend.root.rglob("*"))

    delete_attachment = client.delete(
        f"/api/v1/attachments/{first_attachment['id']}",
        headers=auth_headers,
    )
    assert delete_attachment.status_code == 204
    assert not any(path.is_file() for path in storage_backend.root.rglob("*"))

    second_task = create_task(client, auth_headers, created_project["id"])
    upload_png(client, auth_headers, str(second_task["id"]), "task-delete.png")
    assert any(path.is_file() for path in storage_backend.root.rglob("*"))

    delete_task = client.delete(
        f"/api/v1/tasks/{second_task['id']}",
        headers=auth_headers,
    )
    assert delete_task.status_code == 204
    assert not any(path.is_file() for path in storage_backend.root.rglob("*"))


def test_delete_project_removes_all_attachment_files(
    client: TestClient,
    auth_headers: dict[str, str],
    storage_backend: LocalStorageBackend,
) -> None:
    project = create_project(client, auth_headers, "Project deletion cleanup")
    first_task = create_task(client, auth_headers, project["id"])
    second_task = create_task(client, auth_headers, project["id"])
    upload_png(client, auth_headers, str(first_task["id"]), "first.png")
    upload_png(client, auth_headers, str(second_task["id"]), "second.png")

    stored_files = [
        path for path in storage_backend.root.rglob("*") if path.is_file()
    ]
    assert len(stored_files) == 2

    response = client.delete(
        f"/api/v1/projects/{project['id']}",
        headers=auth_headers,
    )

    assert response.status_code == 204
    assert not any(path.is_file() for path in storage_backend.root.rglob("*"))
```

### `docker-compose.yml`

```yaml
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
      ATTACHMENT_STORAGE_DIR: "storage/attachments"
      ATTACHMENT_MAX_SIZE_BYTES: "5242880"
      ATTACHMENT_ALLOWED_CONTENT_TYPES: "image/jpeg,image/png,image/webp,application/pdf"
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./backend:/app
      - attachment_data:/app/storage/attachments
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
  attachment_data:
```

### `docs/AI_USAGE.md`

````markdown
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
````

### `docs/CURRENT_STATE.md`

````markdown
# Estado atual

## Concluído

- Diagnóstico e decisões iniciais documentados.
- Baseline Alembic criada e contrato de tarefas adaptado.
- Status `cancelled`, `short_description` e `due_at` em UTC implementados.
- Testes de ownership com dois usuários adicionados.
- Repositório organizado como monorepo com `backend/`, `frontend/` e `docs/`.
- Tags relacionais por usuário e associação many-to-many implementadas.
- Normalização, deduplicação e autocomplete de tags implementados.
- Entidade relacional `Attachment` preparada.
- Migration `0004_add_attachments` preparada.
- Interface `StorageBackend` e adapter local implementados.
- Upload, listagem, download autenticado e exclusão de anexos implementados.
- Validação de MIME, assinatura, arquivo vazio e tamanho máximo implementada.
- Ownership de anexos aplicado por tarefa e projeto.
- Projetos arquivados mantidos como somente leitura para anexos.
- Limpeza física de anexos integrada às exclusões de anexo, tarefa e projeto.
- Storage temporário isolado e testes de anexos preparados.
- Volume persistente de anexos configurado no Docker Compose.

## Em desenvolvimento

- Aplicação da Etapa 04 no repositório do desenvolvedor.
- Validação online da migration em PostgreSQL.
- Execução real de Ruff e pytest.
- Registro das saídas reais nos documentos da etapa.

## Pendente

- Corrigir eventuais falhas encontradas na validação local da Etapa 04.
- Executar o commit da Etapa 04.
- Implementar endpoint de refresh token.
- Inicializar frontend React/Vite/TypeScript.
- Implementar autenticação persistente no frontend.
- Implementar projetos e tarefas no frontend.
- Implementar lista, kanban e drag-and-drop persistido.
- Integrar tags e anexos ao frontend.
- Consolidar testes, Docker fullstack, deploy e documentação final.

## Último commit

- Etapa 04 ainda não commitada.
- Mensagem planejada: `feat: adiciona anexos com storage desacoplado`
````

### `docs/prompts/prompt-etapa-04-anexos.md`

````markdown
# Prompt da Etapa 04 — Anexos e armazenamento

## Finalidade

Registrar como a IA foi utilizada como apoio de pesquisa, comparação e revisão na implementação de anexos, mantendo decisões, aplicação e validação sob responsabilidade do desenvolvedor.

## Contexto fornecido pelo desenvolvedor

- O repositório já está organizado em `backend/`, `frontend/` e `docs/`.
- O backend usa FastAPI, SQLAlchemy, PostgreSQL, Alembic e arquitetura em camadas.
- Tarefas já possuem ownership indireto por projeto.
- Tags relacionais foram implementadas na etapa anterior.
- O Taskly exige anexos e/ou fotos editáveis após a criação da tarefa.
- Os metadados devem permanecer no banco e o storage deve poder ser trocado futuramente.
- Projetos arquivados são somente leitura.
- Nenhum teste pode ser declarado como aprovado sem saída real do ambiente do desenvolvedor.

## Solicitação feita à IA

> Analise o estado posterior à Etapa 03 e apresente uma implementação completa de anexos. Crie entidade e migration, interface de armazenamento, adapter local, endpoints de upload, listagem, download e exclusão, integração à resposta de tarefas, validação de ownership, tipos e tamanho, limpeza física ao excluir anexos, tarefas ou projetos e testes automatizados. Preserve a arquitetura em camadas e documente alternativas e riscos. Separe claramente o documento da etapa em `docs/etapas/` e este prompt em `docs/prompts/`.

## Restrições aplicadas

- Não armazenar bytes diretamente no PostgreSQL.
- Não usar o nome original como caminho físico.
- Não expor anexos de outra conta.
- Não permitir alteração de anexos em projeto arquivado.
- Não acoplar regras de negócio diretamente ao filesystem.
- Não adicionar provider externo sem necessidade real do ambiente de deploy.
- Não aceitar qualquer MIME sem validação adicional.
- Não afirmar que Ruff, pytest, Docker ou PostgreSQL foram validados sem evidência real.

## Resultado utilizado pelo desenvolvedor

O material de apoio foi usado para:

- definir o contrato de `StorageBackend`;
- comparar consistência entre arquivo e metadados;
- escolher os tipos aceitos no MVP;
- estruturar as consultas de ownership;
- definir endpoints protegidos;
- organizar a limpeza física em cascatas de aplicação;
- preparar cenários de teste e comandos de validação.

## Decisões aplicadas pelo desenvolvedor

- storage local atrás de interface intercambiável;
- metadados relacionais com URL protegida e chave interna;
- JPEG, PNG, WebP e PDF no MVP;
- limite padrão de 5 MiB configurável;
- validação de MIME e assinatura inicial;
- nomes físicos gerados com UUID;
- download autenticado pela API;
- upload e exclusão bloqueados em projetos arquivados;
- limpeza de arquivos ao excluir anexo, tarefa ou projeto;
- provider de produção adiado para a etapa de deploy.
````

## 6. Comandos de validação

### 6.1. Na raiz do repositório

```powershell
# Conferir os arquivos da etapa antes de executar qualquer comando destrutivo
git status

# Subir o PostgreSQL
docker compose up -d db
docker compose ps

# Criar o banco de testes apenas se ainda não existir
docker exec -it taskly-db createdb -U postgres projects_api_test
```

Caso `createdb` informe que o banco já existe, prossiga normalmente.

### 6.2. Na raiz do backend

```powershell
cd backend

# Ativar a venv que pode continuar na raiz do repositório
..\.venv\Scripts\Activate.ps1

# Instalar/atualizar dependências declaradas
python -m pip install -e ".[dev]"

# Validar a cadeia de migrations
alembic history
alembic heads
alembic upgrade head
alembic current

# O head esperado é 0004_add_attachments

# Ruff obrigatório
ruff check . --fix
ruff format .
ruff check .
ruff format . --check

# Suíte completa e testes específicos
python -m pytest
python -m pytest app/tests/test_attachments.py -vv
```

### 6.3. Smoke test manual

Com a API em execução, use o Swagger em `/docs`:

1. registre e autentique um usuário;
2. crie um projeto e uma tarefa;
3. envie uma imagem ou PDF em `POST /api/v1/tasks/{task_id}/attachments`;
4. confirme o anexo em `GET /api/v1/tasks/{task_id}`;
5. faça o download pelo campo `url` usando o mesmo Bearer token;
6. exclua o anexo e confirme resposta 204;
7. repita com projeto arquivado para confirmar que upload/exclusão retornam 400.

### 6.4. Validações realizadas durante a preparação

Foram executados:

```text
python -m compileall -q backend/app backend/alembic
git diff --check
```

Também foram verificados estaticamente encadeamento da migration, relações ORM, limites de linha e fluxos de limpeza.

Não foram executados neste ambiente Ruff, pytest completo, migration online em PostgreSQL ou Docker Compose. Registre somente os resultados reais obtidos no seu ambiente.

## 7. Passo a passo do commit

Execute a partir da raiz do repositório:

```powershell
# 1. Verificar o que mudou
git status

# 2. Adicionar os arquivos da Etapa 04
git add `
  .gitignore `
  backend/.env.example `
  backend/alembic/versions/0004_add_attachments.py `
  backend/app/api/router.py `
  backend/app/api/routes/attachments.py `
  backend/app/api/routes/projects.py `
  backend/app/api/routes/tasks.py `
  backend/app/core/config.py `
  backend/app/core/dependencies.py `
  backend/app/models/__init__.py `
  backend/app/models/attachment.py `
  backend/app/models/task.py `
  backend/app/repositories/attachment_repository.py `
  backend/app/repositories/task_repository.py `
  backend/app/schemas/attachment.py `
  backend/app/schemas/task.py `
  backend/app/services/attachment_service.py `
  backend/app/services/exceptions.py `
  backend/app/services/project_service.py `
  backend/app/services/task_service.py `
  backend/app/storage/__init__.py `
  backend/app/storage/base.py `
  backend/app/storage/local.py `
  backend/app/tests/conftest.py `
  backend/app/tests/test_attachments.py `
  docker-compose.yml `
  docs/AI_USAGE.md `
  docs/CURRENT_STATE.md `
  docs/prompts/prompt-etapa-04-anexos.md `
  docs/etapas/etapa-04-anexos.md

# 3. Revisar exatamente o conteúdo staged
git diff --cached

# 4. Confirmar que o .env e arquivos físicos não entraram no stage
git status

# 5. Commit semântico
git commit -m "feat: adiciona anexos com storage desacoplado"

# 6. Enviar ao remoto
git push origin main
```

## 8. Problemas comuns e como resolver

### `alembic current` não mostra `0004_add_attachments`

Confirme que está dentro de `backend/`, que a revision está em `backend/alembic/versions/` e execute `alembic upgrade head`.

### Upload retorna 415

O tipo permitido deve coincidir com o conteúdo real. Renomear um `.txt` para `.png` não é suficiente. Tipos padrão: JPEG, PNG, WebP e PDF.

### Upload retorna 413

O arquivo ultrapassou `ATTACHMENT_MAX_SIZE_BYTES`. Ajuste o limite conscientemente em `backend/.env` e reinicie a API.

### Upload ou exclusão retorna 400 em projeto arquivado

Esse é o comportamento esperado. O projeto arquivado é somente leitura. Download e listagem continuam disponíveis.

### Recurso de outro usuário retorna 404

Esse é o comportamento esperado para não revelar a existência de recursos de outra conta.

### Download retorna 500 com conteúdo não encontrado

O metadado existe, mas o arquivo físico não está no provider configurado. Confira `ATTACHMENT_STORAGE_DIR`, volume Docker e se o backend foi iniciado a partir da configuração correta.

### Arquivos desaparecem ao recriar container

Confirme o volume `attachment_data:/app/storage/attachments` no Docker Compose. Sem volume persistente, o filesystem interno é descartável.

### Testes gravam arquivos dentro do projeto

Confirme que `get_storage_backend` foi sobrescrito no fixture `client` e que `storage_backend` usa `tmp_path`.

### `.env` não é encontrado

O arquivo deve ficar em `backend/.env`. As variáveis de anexo possuem valores padrão, mas `DATABASE_URL` e `JWT_SECRET_KEY` continuam obrigatórias.

### Downgrade deixa arquivos no storage

A migration controla somente metadados. Antes de downgrade em ambiente não descartável, execute uma rotina explícita de limpeza ou backup dos bytes.

## 9. Checklist da etapa

- [x] Migration `0004_add_attachments` preparada.
- [x] Entidade `Attachment` criada.
- [x] Metadados vinculados à tarefa.
- [x] Interface `StorageBackend` criada.
- [x] Adapter local criado.
- [x] Proteção contra path traversal implementada.
- [x] Upload autenticado implementado.
- [x] Listagem de anexos implementada.
- [x] Download autenticado implementado.
- [x] Exclusão implementada.
- [x] MIME, assinatura, tamanho e arquivo vazio validados.
- [x] Ownership testado em cenários com dois usuários.
- [x] Projeto arquivado tratado como somente leitura.
- [x] Respostas de tarefas incluem anexos.
- [x] Eager loading de anexos aplicado.
- [x] Limpeza integrada à exclusão de anexo, tarefa e projeto.
- [x] Storage de testes isolado em diretório temporário.
- [x] Volume persistente configurado no Docker Compose.
- [x] `AI_USAGE.md` atualizado.
- [x] `CURRENT_STATE.md` atualizado.
- [x] Prompt separado em `docs/prompts/prompt-etapa-04-anexos.md`.
- [x] Documento separado em `docs/etapas/etapa-04-anexos.md`.
- [ ] Migration online validada pelo desenvolvedor.
- [ ] Ruff executado e aprovado pelo desenvolvedor.
- [ ] Pytest executado e aprovado pelo desenvolvedor.
- [ ] Smoke test manual realizado.
- [ ] Commit executado.

## 10. Próxima etapa

**Etapa 05 — Frontend base e autenticação persistente**

A próxima etapa deverá:

1. implementar o endpoint backend de refresh token;
2. inicializar React + Vite + TypeScript em `frontend/`;
3. configurar TanStack Query, React Hook Form e Zod;
4. criar cliente HTTP e tratamento de access/refresh token;
5. implementar registro, login, logout e rota protegida;
6. criar estados de carregamento, erro e sessão expirada;
7. adicionar testes críticos com Vitest;
8. atualizar `AI_USAGE.md` e `CURRENT_STATE.md`;
9. manter documento e prompt claramente separados em suas respectivas pastas.
