"""Adapt tasks to the Taskly contract.

Revision ID: 0002_adapt_tasks_to_taskly
Revises: 0001_initial_kanbancore
Create Date: 2026-07-31
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_adapt_tasks_to_taskly"
down_revision: str | None = "0001_initial_kanbancore"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add Taskly fields while preserving rows from the inherited schema."""
    # PostgreSQL enums are altered explicitly because Alembic cannot infer a
    # safe value addition from SQLAlchemy metadata alone.
    op.execute("ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'cancelled'")

    op.add_column(
        "tasks",
        sa.Column("short_description", sa.String(length=280), nullable=True),
    )
    op.add_column(
        "tasks",
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Existing rows receive deterministic values before short_description is
    # made NOT NULL. Description is preferred; title is a safe fallback.
    op.execute(
        """
        UPDATE tasks
        SET short_description = LEFT(
            COALESCE(NULLIF(BTRIM(description), ''), title),
            280
        )
        WHERE short_description IS NULL
        """
    )

    # A legacy date had no timezone or hour. Converting it to 23:59 UTC keeps
    # the original calendar day and avoids silently choosing the DB timezone.
    op.execute(
        """
        UPDATE tasks
        SET due_at = (due_date + TIME '23:59:00') AT TIME ZONE 'UTC'
        WHERE due_date IS NOT NULL
        """
    )

    op.alter_column(
        "tasks",
        "short_description",
        existing_type=sa.String(length=280),
        nullable=False,
    )
    op.drop_column("tasks", "due_date")


def downgrade() -> None:
    """Restore the original task structure with a controlled data mapping."""
    op.add_column("tasks", sa.Column("due_date", sa.Date(), nullable=True))
    op.execute(
        """
        UPDATE tasks
        SET due_date = (due_at AT TIME ZONE 'UTC')::date
        WHERE due_at IS NOT NULL
        """
    )

    op.drop_column("tasks", "due_at")
    op.drop_column("tasks", "short_description")

    # PostgreSQL cannot remove an enum value directly. Cancelled tasks are
    # mapped to todo before the type is recreated with the original values.
    op.execute("UPDATE tasks SET status = 'todo' WHERE status = 'cancelled'")
    op.execute("ALTER TYPE task_status RENAME TO task_status_with_cancelled")
    op.execute("CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done')")
    op.execute(
        """
        ALTER TABLE tasks
        ALTER COLUMN status TYPE task_status
        USING status::text::task_status
        """
    )
    op.execute("DROP TYPE task_status_with_cancelled")
