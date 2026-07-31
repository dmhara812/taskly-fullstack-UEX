from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.task import TaskPriority, TaskStatus
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate
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
    """Cria uma tarefa em um projeto do usuário autenticado.

    O body recebe `project_id`, mas o service valida se esse projeto
    realmente pertence ao usuário atual.
    """
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
        date | None,
        Query(examples=["2026-06-30"]),
    ] = None,
    search: Annotated[
        str | None,
        Query(min_length=1, max_length=180, examples=["authentication"]),
    ] = None,
) -> PaginatedResponse[TaskResponse]:
    """Lista tarefas do usuário autenticado com paginação e filtros.

    Filtros disponíveis:
    - `project_id`;
    - `status`;
    - `priority`;
    - `due_before`;
    - `search`.
    """
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
    """Atualiza parcialmente uma tarefa.

    Todos os campos de `TaskUpdate` são opcionais.
    Apenas os campos enviados serão alterados.
    """
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
    """Marca uma tarefa como concluída.

    Esta rota deixa a intenção da ação clara para quem consome a API.
    """
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
    """Remove uma tarefa do usuário autenticado."""
    service = TaskService(db)
    service.delete_task(
        task_id=task_id,
        owner_id=current_user.id,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
