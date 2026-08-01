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
