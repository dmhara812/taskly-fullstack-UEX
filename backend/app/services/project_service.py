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
