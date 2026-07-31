from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
)


def clean_tag_name(value: object) -> object:
    """Remove espaços redundantes antes de validar o limite de caracteres."""
    if not isinstance(value, str):
        return value

    return " ".join(value.split())


TagName = Annotated[
    str,
    BeforeValidator(clean_tag_name),
    StringConstraints(min_length=1, max_length=40),
]


def deduplicate_tag_names(names: list[str]) -> list[str]:
    """Mantém a ordem de entrada e remove duplicatas sem diferenciar caixa."""
    unique_names: list[str] = []
    normalized_names: set[str] = set()

    for name in names:
        normalized_name = name.casefold()
        if normalized_name in normalized_names:
            continue

        normalized_names.add(normalized_name)
        unique_names.append(name)

    return unique_names


class TagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    created_at: datetime
    updated_at: datetime


class TagListParams(BaseModel):
    search: str | None = Field(default=None, min_length=1, max_length=40)
    limit: int = Field(default=50, ge=1, le=100)
