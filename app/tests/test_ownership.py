from collections.abc import Callable

from fastapi.testclient import TestClient


def headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


def test_project_and_task_resources_are_isolated_by_owner(
    client: TestClient,
    authenticated_user_factory: Callable[[str, str], dict[str, str]],
) -> None:
    """Cobre leitura, escrita, listagem e criação cruzada entre duas contas."""
    owner = authenticated_user_factory("owner@example.com", "Project Owner")
    intruder = authenticated_user_factory("intruder@example.com", "Other User")
    owner_headers = headers(owner["access_token"])
    intruder_headers = headers(intruder["access_token"])

    project_response = client.post(
        "/api/v1/projects",
        json={"name": "Private project", "description": "Owner only"},
        headers=owner_headers,
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    task_response = client.post(
        "/api/v1/tasks",
        json={
            "project_id": project_id,
            "title": "Private task",
            "short_description": "Only the owner can access this task.",
            "description": "Ownership integration test.",
            "priority": "medium",
            "due_at": "2026-08-01T12:00:00Z",
        },
        headers=owner_headers,
    )
    assert task_response.status_code == 201
    task_id = task_response.json()["id"]

    assert (
        client.get(
            f"/api/v1/projects/{project_id}",
            headers=intruder_headers,
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/v1/projects/{project_id}",
            json={"name": "Unauthorized change"},
            headers=intruder_headers,
        ).status_code
        == 404
    )
    assert (
        client.delete(
            f"/api/v1/projects/{project_id}",
            headers=intruder_headers,
        ).status_code
        == 404
    )

    intruder_projects = client.get("/api/v1/projects", headers=intruder_headers)
    assert intruder_projects.status_code == 200
    assert intruder_projects.json()["total"] == 0

    cross_project_task = client.post(
        "/api/v1/tasks",
        json={
            "project_id": project_id,
            "title": "Unauthorized task",
            "short_description": "Must not be created in another account.",
            "priority": "high",
        },
        headers=intruder_headers,
    )
    assert cross_project_task.status_code == 404

    assert (
        client.get(
            f"/api/v1/tasks/{task_id}",
            headers=intruder_headers,
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/v1/tasks/{task_id}",
            json={"status": "cancelled"},
            headers=intruder_headers,
        ).status_code
        == 404
    )
    assert (
        client.delete(
            f"/api/v1/tasks/{task_id}",
            headers=intruder_headers,
        ).status_code
        == 404
    )

    intruder_tasks = client.get("/api/v1/tasks", headers=intruder_headers)
    assert intruder_tasks.status_code == 200
    assert intruder_tasks.json()["total"] == 0

    owner_task = client.get(f"/api/v1/tasks/{task_id}", headers=owner_headers)
    assert owner_task.status_code == 200
