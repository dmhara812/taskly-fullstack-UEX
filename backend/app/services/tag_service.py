from uuid import UUID

from sqlalchemy.orm import Session

from app.models.tag import Tag
from app.repositories.tag_repository import TagRepository


class TagService:
    """Expõe somente a consulta necessária para autocomplete de tarefas."""

    def __init__(self, db: Session) -> None:
        self.repository = TagRepository(db)

    def list_tags(
        self,
        owner_id: UUID,
        search: str | None = None,
        limit: int = 50,
    ) -> list[Tag]:
        return self.repository.list_by_owner(
            owner_id=owner_id,
            search=search,
            limit=limit,
        )
