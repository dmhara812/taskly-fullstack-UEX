from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app import models  # noqa: F401
from app.core.config import get_settings
from app.core.database import Base, get_db
from app.main import app

settings = get_settings()

if settings.test_database_url is None:
    raise RuntimeError("TEST_DATABASE_URL must be configured to run tests")


test_engine = create_engine(
    settings.test_database_url,
    pool_pre_ping=True,
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database() -> Generator[None, None, None]:
    """Cria as tabelas no início da sessão de testes e remove ao final.

    Isso mantém o banco de teste isolado do banco de desenvolvimento.
    Nunca use `DATABASE_URL` aqui, apenas `TEST_DATABASE_URL`.
    """
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)

    yield

    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    """Fornece uma sessão limpa para cada teste.

    Cada teste abre uma transação e faz rollback no final. Isso evita que
    dados de um teste interfiram nos demais.
    """
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
    """Cria um TestClient usando override da dependência `get_db`.

    Assim, as rotas usam a sessão de teste em vez da sessão real da aplicação.
    """

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
