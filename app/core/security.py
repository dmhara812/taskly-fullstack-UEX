from datetime import UTC, datetime, timedelta
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

# CryptContext centraliza a estratégia de hash de senha.
# bcrypt é uma escolha sólida e amplamente usada para senhas.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """Gera o hash seguro de uma senha em texto puro.

    A senha original nunca deve ser armazenada no banco.
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Compara uma senha em texto puro com um hash salvo no banco."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: UUID | str) -> str:
    """Cria um access token JWT.

    O `subject` será o ID do usuário. Ele é salvo no claim `sub`,
    que é o local padrão para identificar o dono do token.

    Access tokens devem ter vida curta.
    """
    expire = datetime.now(UTC) + timedelta(
        minutes=settings.access_token_expire_minutes,
    )

    payload = {
        "sub": str(subject),
        "type": "access",
        "exp": expire,
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(subject: UUID | str) -> str:
    """Cria um refresh token JWT.

    Refresh tokens têm vida mais longa e podem ser usados futuramente
    para renovar access tokens sem exigir novo login.
    """
    expire = datetime.now(UTC) + timedelta(
        days=settings.refresh_token_expire_days,
    )

    payload = {
        "sub": str(subject),
        "type": "refresh",
        "exp": expire,
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> dict[str, object]:
    """Decodifica e valida um token JWT.

    Se o token estiver expirado, adulterado ou assinado com segredo incorreto,
    `python-jose` levantará `JWTError`.
    """
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )


def get_token_subject(token: str, expected_type: str = "access") -> UUID:
    """Extrai o ID do usuário de um token válido.

    Também validamos o claim `type` para evitar usar refresh token
    como se fosse access token.
    """
    try:
        payload = decode_token(token)
        token_type = payload.get("type")
        subject = payload.get("sub")

        if token_type != expected_type or subject is None:
            raise JWTError

        return UUID(str(subject))
    except (JWTError, ValueError) as exc:
        raise JWTError("Invalid token") from exc
