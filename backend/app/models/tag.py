from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Column, ForeignKey, String, Table, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.task import Task
    from app.models.user import User


# A tabela associativa não possui identidade própria porque a combinação
# task/tag já representa integralmente o vínculo e impede duplicidade.
task_tags_table = Table(
    "task_tags",
    Base.metadata,
    Column(
        "task_id",
        Uuid(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "tag_id",
        Uuid(as_uuid=True),
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    ),
)


def normalize_tag_name(value: str) -> str:
    """Produz a chave usada para comparar tags sem perder o nome exibido."""
    return " ".join(value.split()).casefold()


class Tag(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tags"
    __table_args__ = (
        UniqueConstraint(
            "owner_id",
            "normalized_name",
            name="uq_tags_owner_normalized_name",
        ),
    )

    owner_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(40), nullable=False)
    # A coluna normalizada garante unicidade por usuário sem depender de
    # extensões específicas do PostgreSQL ou de collation do ambiente.
    normalized_name: Mapped[str] = mapped_column(String(40), nullable=False)

    owner: Mapped[User] = relationship(back_populates="tags")
    tasks: Mapped[list[Task]] = relationship(
        secondary=task_tags_table,
        back_populates="tags",
    )
