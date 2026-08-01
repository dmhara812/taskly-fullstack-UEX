from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_token_subject
from app.models.user import User
from app.services.exceptions import ForbiddenError
from app.services.user_service import UserService
from app.storage import LocalStorageBackend, StorageBackend

# tokenUrl informa ao Swagger onde o usuário consegue obter um token.
# Como nossas rotas terão prefixo /api/v1, o caminho completo fica abaixo.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """Retorna o usuário autenticado a partir do token Bearer.

    Esta dependência será usada em rotas protegidas.
    Ela valida:
    - token JWT;
    - tipo do token;
    - existência do usuário;
    - se o usuário está ativo.
    """
    try:
        user_id = get_token_subject(token, expected_type="access")
    except JWTError as exc:
        raise ForbiddenError("Invalid or expired token") from exc

    user_service = UserService(db)
    user = user_service.get_user_by_id(user_id)

    if not user.is_active:
        raise ForbiddenError("Inactive user")

    return user


@lru_cache(maxsize=1)
def get_storage_backend() -> StorageBackend:
    """Fornece o adapter configurado sem acoplar services ao filesystem."""
    settings = get_settings()
    return LocalStorageBackend(settings.attachment_storage_path)
