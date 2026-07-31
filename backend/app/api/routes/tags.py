from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.tag import TagResponse
from app.services.tag_service import TagService

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagResponse])
def list_tags(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    search: Annotated[
        str | None,
        Query(min_length=1, max_length=40, examples=["backend"]),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[TagResponse]:
    """Lista somente tags do usuário para seleção e autocomplete."""
    service = TagService(db)
    tags = service.list_tags(
        owner_id=current_user.id,
        search=search,
        limit=limit,
    )

    return [TagResponse.model_validate(tag) for tag in tags]
