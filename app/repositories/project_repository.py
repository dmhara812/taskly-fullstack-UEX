from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.project import Project, ProjectStatus
from app.schemas.project import ProjectCreate, ProjectUpdate


class ProjectRepository:
    """Camada de acesso a dados para projetos.

    Projetos pertencem a usuários. Por isso, quase todas as consultas recebem
    `owner_id`, garantindo que a camada de dados já filtre os registros pelo
    dono correto.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, owner_id: UUID, project_data: ProjectCreate) -> Project:
        """Cria um projeto para um usuário específico."""
        project = Project(
            owner_id=owner_id,
            name=project_data.name,
            description=project_data.description,
        )

        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)

        return project

    def get_by_id(self, project_id: UUID) -> Project | None:
        """Busca um projeto apenas pelo ID.

        Este método é útil internamente, mas para rotas protegidas prefira
        `get_by_id_and_owner`, que valida o ownership na própria query.
        """
        statement = select(Project).where(Project.id == project_id)

        return self.db.scalar(statement)

    def get_by_id_and_owner(self, project_id: UUID, owner_id: UUID) -> Project | None:
        """Busca um projeto garantindo que ele pertence ao usuário informado."""
        statement = select(Project).where(
            Project.id == project_id,
            Project.owner_id == owner_id,
        )

        return self.db.scalar(statement)

    def list_by_owner(
        self,
        owner_id: UUID,
        page: int = 1,
        size: int = 20,
        status: ProjectStatus | None = None,
        search: str | None = None,
    ) -> list[Project]:
        """Lista projetos de um usuário com filtros e paginação.

        Filtros previstos:
        - status: active ou archived;
        - search: busca parcial e case-insensitive no nome do projeto.
        """
        offset = (page - 1) * size

        statement = select(Project).where(Project.owner_id == owner_id)

        if status is not None:
            statement = statement.where(Project.status == status)

        if search:
            # `ilike` faz busca case-insensitive no PostgreSQL.
            statement = statement.where(Project.name.ilike(f"%{search}%"))

        statement = (
            statement.order_by(Project.created_at.desc()).offset(offset).limit(size)
        )

        return list(self.db.scalars(statement).all())

    def count_by_owner(
        self,
        owner_id: UUID,
        status: ProjectStatus | None = None,
        search: str | None = None,
    ) -> int:
        """Conta projetos de um usuário aplicando os mesmos filtros da listagem.

        Esse total será usado pelos services/routers para montar respostas
        paginadas com `total`, `page`, `size` e `pages`.
        """
        statement = (
            select(func.count())
            .select_from(Project)
            .where(
                Project.owner_id == owner_id,
            )
        )

        if status is not None:
            statement = statement.where(Project.status == status)

        if search:
            statement = statement.where(Project.name.ilike(f"%{search}%"))

        return self.db.scalar(statement) or 0

    def update(self, project: Project, project_data: ProjectUpdate) -> Project:
        """Atualiza um projeto existente."""
        update_data = project_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(project, field, value)

        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)

        return project

    def delete(self, project: Project) -> None:
        """Remove um projeto.

        As tarefas relacionadas serão removidas por cascade, conforme definido
        no relacionamento `Project.tasks`.
        """
        self.db.delete(project)
        self.db.commit()
