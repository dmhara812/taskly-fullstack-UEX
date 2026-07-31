from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.project import ProjectStatus
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services.project_service import ProjectService

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
) -> ProjectResponse:
    """Cria um projeto para o usuário autenticado.

    O `owner_id` não vem do body da request. Ele vem do usuário autenticado,
    garantindo que ninguém crie projetos em nome de outro usuário.
    """
    service = ProjectService(db)
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
    service = ProjectService(db)

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
) -> ProjectResponse:
    """Busca um projeto específico do usuário autenticado.

    O service valida ownership. Se o projeto não for do usuário,
    retornaremos 404 para não revelar a existência de recurso de outra conta.
    """
    service = ProjectService(db)
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
) -> ProjectResponse:
    """Atualiza parcialmente um projeto do usuário autenticado.

    Como usamos `ProjectUpdate`, todos os campos são opcionais.
    Apenas os campos enviados serão alterados.
    """
    service = ProjectService(db)
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
) -> ProjectResponse:
    """Arquiva um projeto.

    Esta rota representa uma ação de negócio explícita, mais clara do que
    apenas fazer PATCH manual no campo `status`.
    """
    service = ProjectService(db)
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
) -> Response:
    """Remove um projeto do usuário autenticado.

    As tarefas relacionadas serão removidas por cascade conforme configurado
    nos models SQLAlchemy.
    """
    service = ProjectService(db)
    service.delete_project(
        project_id=project_id,
        owner_id=current_user.id,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
