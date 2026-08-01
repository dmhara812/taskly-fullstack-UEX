from datetime import UTC, datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.models.task import TaskPriority, TaskStatus
from app.schemas.attachment import AttachmentResponse
from app.schemas.tag import TagName, TagResponse, deduplicate_tag_names


def normalize_due_at(value: datetime | None) -> datetime | None:
    """Valida timezone e converte o prazo para o contrato UTC da API."""
    if value is None:
        return None

    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("due_at must include a timezone offset")

    return value.astimezone(UTC)


UtcDateTime = Annotated[datetime, AfterValidator(normalize_due_at)]


class TaskBase(BaseModel):
    title: str = Field(
        min_length=2,
        max_length=180,
        examples=["Create authentication endpoints"],
    )
    short_description: str = Field(
        min_length=2,
        max_length=280,
        examples=["Implement the authentication flow for the application."],
    )
    description: str | None = Field(
        default=None,
        max_length=5000,
        examples=["Implement register, login and current user endpoints."],
    )
    priority: TaskPriority = Field(
        default=TaskPriority.MEDIUM,
        examples=[TaskPriority.HIGH],
    )
    due_at: UtcDateTime | None = Field(
        default=None,
        examples=["2026-06-15T21:30:00Z"],
    )


class TaskCreate(TaskBase):
    project_id: UUID = Field(
        examples=["4b01951d-5f36-465d-b438-6de1aa2cd170"],
    )
    tags: list[TagName] = Field(default_factory=list, max_length=10)

    @field_validator("tags")
    @classmethod
    def make_tags_unique(cls, value: list[str]) -> list[str]:
        return deduplicate_tag_names(value)


class TaskUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=2,
        max_length=180,
        examples=["Update authentication endpoints"],
    )
    short_description: str | None = Field(
        default=None,
        min_length=2,
        max_length=280,
        examples=["Add refresh token support to the authentication flow."],
    )
    description: str | None = Field(
        default=None,
        max_length=5000,
        examples=["Add refresh token support."],
    )
    status: TaskStatus | None = Field(
        default=None,
        examples=[TaskStatus.IN_PROGRESS],
    )
    priority: TaskPriority | None = Field(
        default=None,
        examples=[TaskPriority.HIGH],
    )
    due_at: UtcDateTime | None = Field(
        default=None,
        examples=["2026-06-30T18:00:00Z"],
    )
    # `[]` remove todas as tags. `null` é rejeitado para evitar semântica
    # ambígua em uma atualização parcial.
    tags: list[TagName] | None = Field(default=None, max_length=10)

    @field_validator("tags")
    @classmethod
    def make_tags_unique(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None

        return deduplicate_tag_names(value)

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> Self:
        """Distingue campo ausente de `null` em atualizações parciais."""
        non_nullable_fields = {"title", "short_description", "tags"}

        for field_name in non_nullable_fields & self.model_fields_set:
            if getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")

        return self


class TaskFilters(BaseModel):
    project_id: UUID | None = Field(
        default=None,
        examples=["4b01951d-5f36-465d-b438-6de1aa2cd170"],
    )
    status: TaskStatus | None = Field(
        default=None,
        examples=[TaskStatus.TODO],
    )
    priority: TaskPriority | None = Field(
        default=None,
        examples=[TaskPriority.HIGH],
    )
    due_before: UtcDateTime | None = Field(
        default=None,
        examples=["2026-06-30T23:59:59Z"],
    )
    search: str | None = Field(
        default=None,
        min_length=1,
        max_length=180,
        examples=["authentication"],
    )


class TaskResponse(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    status: TaskStatus
    tags: list[TagResponse]
    attachments: list[AttachmentResponse]
    created_at: datetime
    updated_at: datetime
