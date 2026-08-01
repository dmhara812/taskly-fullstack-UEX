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
            raise PayloadTooLargeError("Attachment exceeds the configured size limit")

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
