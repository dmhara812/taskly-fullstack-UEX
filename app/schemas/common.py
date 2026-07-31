from pydantic import BaseModel, Field


class MessageResponse(BaseModel):
    message: str = Field(
        examples=["Operation completed successfully"],
    )


class ErrorResponse(BaseModel):
    detail: str = Field(
        examples=["Resource not found"],
    )


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1, examples=[1])
    size: int = Field(default=20, ge=1, le=100, examples=[20])


class PaginatedResponse[T](BaseModel):
    items: list[T]
    total: int = Field(ge=0, examples=[100])
    page: int = Field(ge=1, examples=[1])
    size: int = Field(ge=1, le=100, examples=[20])
    pages: int = Field(ge=0, examples=[5])
