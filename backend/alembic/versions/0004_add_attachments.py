"""Add attachment metadata linked to tasks.

Revision ID: 0004_add_attachments
Revises: 0003_add_relational_tags
Create Date: 2026-07-31
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_add_attachments"
down_revision: str | None = "0003_add_relational_tags"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create attachment metadata while keeping file bytes outside PostgreSQL."""
    op.create_table(
        "attachments",
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key"),
        sa.UniqueConstraint("url"),
    )
    op.create_index(
        "ix_attachments_task_id",
        "attachments",
        ["task_id"],
        unique=False,
    )


def downgrade() -> None:
    """Remove metadata; physical files require external cleanup if downgraded."""
    op.drop_index("ix_attachments_task_id", table_name="attachments")
    op.drop_table("attachments")
