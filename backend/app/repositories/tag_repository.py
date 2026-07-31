from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tag import Tag, normalize_tag_name


class TagRepository:
    """Acesso a tags sempre limitado ao proprietário autenticado."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_owner(
        self,
        owner_id: UUID,
        search: str | None = None,
        limit: int = 50,
    ) -> list[Tag]:
        statement = select(Tag).where(Tag.owner_id == owner_id)

        if search:
            statement = statement.where(Tag.name.ilike(f"%{search}%"))

        statement = statement.order_by(Tag.name.asc()).limit(limit)

        return list(self.db.scalars(statement).all())

    def resolve_for_owner(self, owner_id: UUID, names: list[str]) -> list[Tag]:
        """Reutiliza tags existentes e prepara as ausentes na mesma transação."""
        if not names:
            return []

        display_by_normalized = {normalize_tag_name(name): name for name in names}
        normalized_names = list(display_by_normalized)

        statement = select(Tag).where(
            Tag.owner_id == owner_id,
            Tag.normalized_name.in_(normalized_names),
        )
        existing_tags = list(self.db.scalars(statement).all())
        tags_by_normalized = {tag.normalized_name: tag for tag in existing_tags}

        for normalized_name, display_name in display_by_normalized.items():
            if normalized_name in tags_by_normalized:
                continue

            tag = Tag(
                owner_id=owner_id,
                name=display_name,
                normalized_name=normalized_name,
            )
            self.db.add(tag)
            tags_by_normalized[normalized_name] = tag

        # Flush atribui UUIDs e detecta violações antes do commit da tarefa,
        # preservando a atomicidade entre a associação e a criação das tags.
        self.db.flush()

        return [tags_by_normalized[name] for name in normalized_names]
