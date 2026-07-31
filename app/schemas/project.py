from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.project import ProjectStatus


class ProjectBase(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=160,
        examples=["Portfolio API"],
    )
    description: str | None = Field(
        default=None,
        max_length=2000,
        examples=["Backend project built with FastAPI and PostgreSQL."],
    )


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=160,
        examples=["Updated Portfolio API"],
    )
    description: str | None = Field(
        default=None,
        max_length=2000,
        examples=["Updated project description."],
    )
    status: ProjectStatus | None = Field(
        default=None,
        examples=[ProjectStatus.ACTIVE],
    )


class ProjectFilters(BaseModel):
    status: ProjectStatus | None = Field(
        default=None,
        examples=[ProjectStatus.ACTIVE],
    )
    search: str | None = Field(
        default=None,
        min_length=1,
        max_length=160,
        examples=["portfolio"],
    )


class ProjectResponse(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_id: UUID
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime
