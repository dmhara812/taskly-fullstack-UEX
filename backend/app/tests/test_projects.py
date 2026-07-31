from fastapi.testclient import TestClient


def test_create_project(
    client: TestClient,
    auth_headers: dict[str, str],
    project_payload: dict[str, str],
) -> None:
    response = client.post(
        "/api/v1/projects",
        json=project_payload,
        headers=auth_headers,
    )

    assert response.status_code == 201

    data = response.json()

    assert data["name"] == project_payload["name"]
    assert data["description"] == project_payload["description"]
    assert data["status"] == "active"
    assert "id" in data
    assert "owner_id" in data


def test_list_projects(
    client: TestClient,
    auth_headers: dict[str, str],
    project_payload: dict[str, str],
) -> None:
    client.post("/api/v1/projects", json=project_payload, headers=auth_headers)

    response = client.get(
        "/api/v1/projects?page=1&size=20",
        headers=auth_headers,
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 1
    assert data["page"] == 1
    assert data["size"] == 20
    assert data["pages"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["name"] == project_payload["name"]


def test_list_projects_with_search_filter(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    client.post(
        "/api/v1/projects",
        json={"name": "Portfolio API", "description": "First project"},
        headers=auth_headers,
    )
    client.post(
        "/api/v1/projects",
        json={"name": "Internal Tool", "description": "Second project"},
        headers=auth_headers,
    )

    response = client.get(
        "/api/v1/projects?search=portfolio",
        headers=auth_headers,
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 1
    assert data["items"][0]["name"] == "Portfolio API"


def test_get_project_by_id(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    response = client.get(
        f"/api/v1/projects/{created_project['id']}",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["id"] == created_project["id"]


def test_update_project(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    response = client.patch(
        f"/api/v1/projects/{created_project['id']}",
        json={"name": "Updated Portfolio API"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Updated Portfolio API"


def test_archive_project(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    response = client.patch(
        f"/api/v1/projects/{created_project['id']}/archive",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["status"] == "archived"


def test_delete_project(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    delete_response = client.delete(
        f"/api/v1/projects/{created_project['id']}",
        headers=auth_headers,
    )

    get_response = client.get(
        f"/api/v1/projects/{created_project['id']}",
        headers=auth_headers,
    )

    assert delete_response.status_code == 204
    assert get_response.status_code == 404


def test_create_project_without_token_returns_401(
    client: TestClient,
    project_payload: dict[str, str],
) -> None:
    response = client.post("/api/v1/projects", json=project_payload)

    assert response.status_code == 401
