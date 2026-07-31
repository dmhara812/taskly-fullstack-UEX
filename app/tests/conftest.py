from collections.abc import Callable, Generator

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.core.database import get_db
from app.main import app

settings = get_settings()

if settings.test_database_url is None:
    raise RuntimeError("TEST_DATABASE_URL must be configured to run tests")

if (
    settings.test_database_url == settings.database_url
    and settings.app_env.lower() != "test"
):
    raise RuntimeError(
        "TEST_DATABASE_URL must differ from DATABASE_URL outside the test environment"
    )


test_engine = create_engine(
    settings.test_database_url,
    pool_pre_ping=True,
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
)


def reset_test_schema() -> None:
    """Recria o schema público do banco exclusivo de testes.

    O reset é PostgreSQL-specific de propósito: a stack obrigatória usa
    PostgreSQL e o banco apontado por TEST_DATABASE_URL deve ser descartável.
    """
    with test_engine.begin() as connection:
        connection.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))


def run_test_migrations() -> None:
    """Aplica a mesma cadeia Alembic utilizada no deploy da aplicação."""
    alembic_config = Config("alembic.ini")
    alembic_config.attributes["database_url"] = settings.test_database_url
    command.upgrade(alembic_config, "head")


@pytest.fixture(scope="session", autouse=True)
def setup_test_database() -> Generator[None, None, None]:
    """Valida as migrations em banco vazio antes de executar a suíte."""
    reset_test_schema()
    run_test_migrations()

    yield

    reset_test_schema()


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    """Isola cada teste em uma transação revertida ao final."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Substitui a sessão da aplicação pela sessão transacional do teste."""

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture()
def user_payload() -> dict[str, str]:
    """Payload padrão para criação de usuário nos testes."""
    return {
        "name": "Ana Silva",
        "email": "ana.silva@example.com",
        "password": "StrongPassword123",
    }


@pytest.fixture()
def authenticated_user_factory(
    client: TestClient,
) -> Callable[[str, str], dict[str, str]]:
    """Cria usuários independentes para cenários reais de ownership."""

    def create_authenticated_user(email: str, name: str) -> dict[str, str]:
        password = "StrongPassword123"
        register_response = client.post(
            "/api/v1/auth/register",
            json={"name": name, "email": email, "password": password},
        )
        assert register_response.status_code == 201

        login_response = client.post(
            "/api/v1/auth/login",
            data={"username": email, "password": password},
        )
        assert login_response.status_code == 200

        return {
            "access_token": login_response.json()["access_token"],
            "user_id": register_response.json()["id"],
        }

    return create_authenticated_user


@pytest.fixture()
def access_token(client: TestClient, user_payload: dict[str, str]) -> str:
    """Registra usuário, faz login e retorna o access token."""
    client.post("/api/v1/auth/register", json=user_payload)

    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": user_payload["email"],
            "password": user_payload["password"],
        },
    )

    assert response.status_code == 200

    return response.json()["access_token"]


@pytest.fixture()
def auth_headers(access_token: str) -> dict[str, str]:
    """Headers de autenticação usados em rotas protegidas."""
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture()
def project_payload() -> dict[str, str]:
    """Payload padrão para criação de projeto."""
    return {
        "name": "Portfolio API",
        "description": "Backend project built with FastAPI and PostgreSQL.",
    }


@pytest.fixture()
def created_project(
    client: TestClient,
    auth_headers: dict[str, str],
    project_payload: dict[str, str],
) -> dict[str, str]:
    """Cria um projeto autenticado e retorna a resposta JSON."""
    response = client.post(
        "/api/v1/projects",
        json=project_payload,
        headers=auth_headers,
    )

    assert response.status_code == 201

    return response.json()
