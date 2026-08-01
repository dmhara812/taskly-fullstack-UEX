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
