from fastapi.testclient import TestClient


def test_register_user(
    client: TestClient,
    user_payload: dict[str, str],
) -> None:
    response = client.post("/api/v1/auth/register", json=user_payload)

    assert response.status_code == 201

    data = response.json()

    assert data["name"] == user_payload["name"]
    assert data["email"] == user_payload["email"]
    assert data["is_active"] is True
    assert "id" in data
    assert "hashed_password" not in data
    assert "password" not in data


def test_register_user_with_duplicate_email_returns_409(
    client: TestClient,
    user_payload: dict[str, str],
) -> None:
    first_response = client.post("/api/v1/auth/register", json=user_payload)
    second_response = client.post("/api/v1/auth/register", json=user_payload)

    assert first_response.status_code == 201
    assert second_response.status_code == 409
    assert second_response.json()["detail"] == "Email already registered"


def test_login_user(
    client: TestClient,
    user_payload: dict[str, str],
) -> None:
    client.post("/api/v1/auth/register", json=user_payload)

    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": user_payload["email"],
            "password": user_payload["password"],
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert data["refresh_token"]


def test_login_with_invalid_credentials_returns_403(
    client: TestClient,
    user_payload: dict[str, str],
) -> None:
    client.post("/api/v1/auth/register", json=user_payload)

    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": user_payload["email"],
            "password": "wrong-password",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Invalid credentials"


def test_get_current_user(
    client: TestClient,
    auth_headers: dict[str, str],
    user_payload: dict[str, str],
) -> None:
    response = client.get("/api/v1/auth/me", headers=auth_headers)

    assert response.status_code == 200

    data = response.json()

    assert data["user"]["name"] == user_payload["name"]
    assert data["user"]["email"] == user_payload["email"]


def test_get_current_user_without_token_returns_401(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
