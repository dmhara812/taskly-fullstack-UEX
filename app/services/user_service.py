from uuid import UUID

from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate, UserUpdate
from app.services.exceptions import ConflictError, NotFoundError


class UserService:
    """Regras de negócio relacionadas a usuários.

    O service coordena validações de negócio e delega persistência ao repository.
    Ele não deve conhecer detalhes de HTTP, como status codes de endpoints.
    """

    def __init__(self, db: Session) -> None:
        self.repository = UserRepository(db)

    def create_user(self, user_data: UserCreate) -> User:
        """Cria um usuário garantindo que o e-mail seja único.

        A senha recebida em texto puro vem do schema `UserCreate`.
        Antes de persistir, transformamos essa senha em hash usando
        `get_password_hash`.

        A senha original nunca deve ser salva no banco.
        """
        existing_user = self.repository.get_by_email(user_data.email)

        if existing_user is not None:
            raise ConflictError("Email already registered")

        hashed_password = get_password_hash(user_data.password)

        return self.repository.create(
            user_data=user_data,
            hashed_password=hashed_password,
        )

    def get_user_by_id(self, user_id: UUID) -> User:
        """Retorna um usuário ou lança erro de negócio se ele não existir."""
        user = self.repository.get_by_id(user_id)

        if user is None:
            raise NotFoundError("User not found")

        return user

    def get_user_by_email(self, email: str) -> User | None:
        """Busca usuário por e-mail.

        Este método retorna `None` quando não encontra porque será útil
        no login, onde a mensagem de erro deve ser genérica.
        """
        return self.repository.get_by_email(email)

    def update_user(self, user_id: UUID, user_data: UserUpdate) -> User:
        """Atualiza usuário e evita conflito de e-mail.

        Se o usuário tentar alterar o e-mail para um endereço já usado
        por outra conta, levantamos `ConflictError`.
        """
        user = self.get_user_by_id(user_id)

        if user_data.email is not None and user_data.email != user.email:
            existing_user = self.repository.get_by_email(user_data.email)

            if existing_user is not None:
                raise ConflictError("Email already registered")

        return self.repository.update(user, user_data)

    def delete_user(self, user_id: UUID) -> None:
        """Remove usuário existente.

        A remoção em cascade de projetos/tarefas foi configurada nos models.
        """
        user = self.get_user_by_id(user_id)

        self.repository.delete(user)
