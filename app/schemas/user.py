from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=120,
        examples=["Ana Silva"],
    )
    email: EmailStr = Field(
        examples=["ana.silva@example.com"],
    )


class UserCreate(UserBase):
    password: str = Field(
        min_length=8,
        max_length=128,
        examples=["StrongPassword123"],
    )


class UserUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=120,
        examples=["Ana Souza"],
    )
    email: EmailStr | None = Field(
        default=None,
        examples=["ana.souza@example.com"],
    )
    is_active: bool | None = Field(
        default=None,
        examples=[True],
    )


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
