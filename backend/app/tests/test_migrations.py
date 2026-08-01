from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def test_database_is_at_the_single_alembic_head(db_session: Session) -> None:
    """Garante que a suíte está validando exatamente a revision de deploy."""
    config = Config(BACKEND_ROOT / "alembic.ini")
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    script = ScriptDirectory.from_config(config)

    assert script.get_heads() == ["0004_add_attachments"]

    current_revision = db_session.execute(
        text("SELECT version_num FROM alembic_version")
    ).scalar_one()

    assert current_revision == script.get_current_head()


def test_migrated_schema_contains_taskly_relations_and_constraints(
    db_session: Session,
) -> None:
    """Detecta divergências entre models e a estrutura criada pelo Alembic."""
    inspector = inspect(db_session.get_bind())
    expected_tables = {
        "alembic_version",
        "attachments",
        "projects",
        "tags",
        "task_tags",
        "tasks",
        "users",
    }

    assert expected_tables.issubset(set(inspector.get_table_names()))

    task_columns = {column["name"]: column for column in inspector.get_columns("tasks")}
    assert {
        "short_description",
        "description",
        "due_at",
        "priority",
        "status",
    }.issubset(task_columns)
    assert task_columns["short_description"]["nullable"] is False
    assert getattr(task_columns["due_at"]["type"], "timezone", False) is True

    tag_unique_constraints = {
        tuple(constraint["column_names"])
        for constraint in inspector.get_unique_constraints("tags")
    }
    assert ("owner_id", "normalized_name") in tag_unique_constraints

    attachment_foreign_keys = inspector.get_foreign_keys("attachments")
    task_foreign_key = next(
        foreign_key
        for foreign_key in attachment_foreign_keys
        if foreign_key["constrained_columns"] == ["task_id"]
    )
    assert task_foreign_key["referred_table"] == "tasks"
    assert task_foreign_key.get("options", {}).get("ondelete") == "CASCADE"


def test_postgresql_enums_expose_the_public_api_values(
    db_session: Session,
) -> None:
    """Impede regressão para nomes internos como TODO ou IN_PROGRESS."""
    rows = db_session.execute(
        text(
            """
            SELECT type.typname,
                   array_agg(enum.enumlabel ORDER BY enum.enumsortorder) AS labels
            FROM pg_type AS type
            JOIN pg_enum AS enum ON enum.enumtypid = type.oid
            WHERE type.typname IN ('project_status', 'task_priority', 'task_status')
            GROUP BY type.typname
            """
        )
    ).mappings()

    values = {row["typname"]: list(row["labels"]) for row in rows}

    assert values == {
        "project_status": ["active", "archived"],
        "task_priority": ["low", "medium", "high"],
        "task_status": ["todo", "in_progress", "done", "cancelled"],
    }
