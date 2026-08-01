from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    email: EmailStr = Field(
        examples=["ana.silva@example.com"],
    )
    password: str = Field(
        min_length=8,
        max_length=128,
        examples=["StrongPassword123"],
    )


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(
        min_length=1,
        examples=[
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example.refresh.token",
        ],
    )


class TokenResponse(BaseModel):
    access_token: str = Field(
        examples=[
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example.access.token",
        ],
    )
    refresh_token: str | None = Field(
        default=None,
        examples=[
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example.refresh.token",
        ],
    )
    token_type: str = Field(
        default="bearer",
        examples=["bearer"],
    )


class CurrentUserResponse(BaseModel):
    user: UserResponse
