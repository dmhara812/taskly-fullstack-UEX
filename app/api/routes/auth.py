from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import CurrentUserResponse, TokenResponse
from app.schemas.user import UserCreate, UserResponse
from app.services.exceptions import ForbiddenError
from app.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    user_data: UserCreate,
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """Registra um novo usuário.

    A senha é recebida pelo schema `UserCreate`, mas a resposta nunca retorna
    a senha nem o hash.
    """
    user_service = UserService(db)

    return user_service.create_user(user_data)


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    """Autentica usuário e retorna tokens JWT.

    `OAuth2PasswordRequestForm` usa campos chamados `username` e `password`.
    Neste projeto, usaremos o campo `username` como e-mail.

    Isso melhora a integração com o Swagger, que já entende esse padrão.
    """
    user_service = UserService(db)
    user = user_service.get_user_by_email(form_data.username)

    # A mensagem é genérica de propósito para não revelar se o e-mail existe.
    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise ForbiddenError("Invalid credentials")

    if not user.is_active:
        raise ForbiddenError("Inactive user")

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.get("/me", response_model=CurrentUserResponse)
def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> CurrentUserResponse:
    """Retorna os dados do usuário autenticado."""
    return CurrentUserResponse(user=UserResponse.model_validate(current_user))
