from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


class UserRepository:
    """Camada de acesso a dados para usuários.

    Esta classe não deve conter regras de negócio, como validação de senha,
    geração de token ou decisão se um usuário pode acessar um recurso.
    Ela apenas consulta e persiste dados relacionados a `User`.
    """

    def __init__(self, db: Session) -> None:
        # A sessão é injetada para facilitar testes e controle transacional.
        self.db = db

    def create(self, user_data: UserCreate, hashed_password: str) -> User:
        """Cria um usuário com senha já criptografada.

        O repository recebe `hashed_password` pronto porque criptografia
        é regra de segurança, não responsabilidade da camada de banco.
        """
        user = User(
            name=user_data.name,
            email=user_data.email,
            hashed_password=hashed_password,
        )

        self.db.add(user)
        self.db.commit()

        # O refresh carrega valores gerados pelo banco, como id e timestamps.
        self.db.refresh(user)

        return user

    def get_by_id(self, user_id: UUID) -> User | None:
        """Busca um usuário pelo ID."""
        statement = select(User).where(User.id == user_id)

        return self.db.scalar(statement)

    def get_by_email(self, email: str) -> User | None:
        """Busca um usuário pelo e-mail.

        Esta consulta será usada principalmente no registro e login.
        """
        statement = select(User).where(User.email == email)

        return self.db.scalar(statement)

    def list(self, page: int = 1, size: int = 20) -> list[User]:
        """Lista usuários com paginação simples.

        Mesmo que usuários não sejam a listagem principal do sistema,
        manter paginação aqui ajuda a seguir um padrão consistente.
        """
        offset = (page - 1) * size

        statement = (
            select(User).order_by(User.created_at.desc()).offset(offset).limit(size)
        )

        return list(self.db.scalars(statement).all())

    def update(self, user: User, user_data: UserUpdate) -> User:
        """Atualiza um usuário existente.

        `exclude_unset=True` garante que apenas campos enviados na request
        sejam alterados. Campos omitidos permanecem com o valor atual.
        """
        update_data = user_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(user, field, value)

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        return user

    def delete(self, user: User) -> None:
        """Remove um usuário do banco.

        Os relacionamentos configurados nos models cuidam do cascade para
        projetos e tarefas, conforme definido na Etapa 3.
        """
        self.db.delete(user)
        self.db.commit()
