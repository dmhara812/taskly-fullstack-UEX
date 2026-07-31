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
