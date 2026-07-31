from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.task import Task, TaskPriority, TaskStatus
from app.schemas.task import TaskCreate, TaskUpdate


class TaskRepository:
    """Camada de acesso a dados para tarefas.

    Tarefas pertencem a projetos. Como projetos pertencem a usuários,
    algumas consultas fazem join com `Project` para garantir que a tarefa
    acessada pertence a um projeto do usuário autenticado.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, task_data: TaskCreate) -> Task:
        """Cria uma tarefa.

        A validação de que `project_id` existe e pertence ao usuário será feita
        na camada de service. Aqui assumimos que os dados já foram autorizados.
        """
        task = Task(
            project_id=task_data.project_id,
            title=task_data.title,
            description=task_data.description,
            priority=task_data.priority,
            due_date=task_data.due_date,
        )

        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        return task

    def get_by_id(self, task_id: UUID) -> Task | None:
        """Busca uma tarefa apenas pelo ID."""
        statement = select(Task).where(Task.id == task_id)

        return self.db.scalar(statement)

    def get_by_id_and_owner(self, task_id: UUID, owner_id: UUID) -> Task | None:
        """Busca uma tarefa garantindo que ela pertence ao usuário informado.

        Como `Task` não possui `owner_id` diretamente, fazemos join com
        `Project` e filtramos pelo dono do projeto.
        """
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
        due_before: date | None = None,
        search: str | None = None,
    ) -> list[Task]:
        """Lista tarefas pertencentes ao usuário com filtros e paginação.

        A consulta usa join com `Project` para garantir que só sejam retornadas
        tarefas de projetos cujo `owner_id` seja o usuário informado.
        """
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
            statement = statement.where(Task.due_date <= due_before)

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
        due_before: date | None = None,
        search: str | None = None,
    ) -> int:
        """Conta tarefas aplicando os mesmos filtros da listagem."""
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
            statement = statement.where(Task.due_date <= due_before)

        if search:
            statement = statement.where(Task.title.ilike(f"%{search}%"))

        return self.db.scalar(statement) or 0

    def update(self, task: Task, task_data: TaskUpdate) -> Task:
        """Atualiza uma tarefa existente."""
        update_data = task_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(task, field, value)

        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        return task

    def delete(self, task: Task) -> None:
        """Remove uma tarefa."""
        self.db.delete(task)
        self.db.commit()
