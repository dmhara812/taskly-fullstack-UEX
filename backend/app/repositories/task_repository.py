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
