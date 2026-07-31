from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.task import TaskPriority, TaskStatus


class TaskBase(BaseModel):
    title: str = Field(
        min_length=2,
        max_length=180,
        examples=["Create authentication endpoints"],
    )
    description: str | None = Field(
        default=None,
        max_length=3000,
        examples=["Implement register, login and current user endpoints."],
    )
    priority: TaskPriority = Field(
        default=TaskPriority.MEDIUM,
        examples=[TaskPriority.HIGH],
    )
    due_date: date | None = Field(
        default=None,
        examples=["2026-06-15"],
    )


class TaskCreate(TaskBase):
    project_id: UUID = Field(
        examples=["4b01951d-5f36-465d-b438-6de1aa2cd170"],
    )


class TaskUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=2,
        max_length=180,
        examples=["Update authentication endpoints"],
    )
    description: str | None = Field(
        default=None,
        max_length=3000,
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
    due_date: date | None = Field(
        default=None,
        examples=["2026-06-30"],
    )


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
    due_before: date | None = Field(
        default=None,
        examples=["2026-06-30"],
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
    created_at: datetime
    updated_at: datetime
