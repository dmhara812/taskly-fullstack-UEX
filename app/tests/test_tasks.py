from datetime import UTC, datetime

from fastapi.testclient import TestClient


def task_payload(project_id: str, title: str = "Create CRUD routes") -> dict[str, str]:
    """Monta o contrato mínimo de tarefa sem ocultar campos obrigatórios."""
    return {
        "project_id": project_id,
        "title": title,
        "short_description": "Implement the main task flow.",
        "description": "Implement protected routes for projects and tasks.",
        "priority": "high",
        "due_at": "2026-06-15T18:30:00-03:00",
    }


def parse_datetime(value: str) -> datetime:
    """Aceita a representação UTC com `Z` devolvida pelo JSON."""
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def test_create_task_normalizes_due_at_to_utc(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    response = client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"]),
        headers=auth_headers,
    )

    assert response.status_code == 201

    data = response.json()

    assert data["project_id"] == created_project["id"]
    assert data["title"] == "Create CRUD routes"
    assert data["short_description"] == "Implement the main task flow."
    assert data["status"] == "todo"
    assert data["priority"] == "high"
    assert parse_datetime(data["due_at"]) == datetime(
        2026,
        6,
        15,
        21,
        30,
        tzinfo=UTC,
    )


def test_create_task_rejects_due_at_without_timezone(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    payload = task_payload(created_project["id"])
    payload["due_at"] = "2026-06-15T18:30:00"

    response = client.post(
        "/api/v1/tasks",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 422
    assert "due_at must include a timezone offset" in response.text


def test_create_task_requires_short_description(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    payload = task_payload(created_project["id"])
    payload.pop("short_description")

    response = client.post(
        "/api/v1/tasks",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_list_tasks(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"], "Create tests"),
        headers=auth_headers,
    )

    response = client.get("/api/v1/tasks?page=1&size=20", headers=auth_headers)

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 1
    assert data["pages"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["title"] == "Create tests"


def test_list_tasks_with_filters(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    high_priority = task_payload(
        created_project["id"],
        "Write authentication tests",
    )
    low_priority = task_payload(created_project["id"], "Update README")
    low_priority["priority"] = "low"
    low_priority["due_at"] = "2026-07-01T10:00:00Z"

    client.post("/api/v1/tasks", json=high_priority, headers=auth_headers)
    client.post("/api/v1/tasks", json=low_priority, headers=auth_headers)

    response = client.get(
        "/api/v1/tasks",
        params={
            "priority": "high",
            "search": "authentication",
            "due_before": "2026-06-30T23:59:59Z",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 1
    assert data["items"][0]["title"] == "Write authentication tests"


def test_get_task_by_id(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    create_response = client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"], "Create task detail endpoint"),
        headers=auth_headers,
    )

    task = create_response.json()
    response = client.get(f"/api/v1/tasks/{task['id']}", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["id"] == task["id"]


def test_update_task_and_cancel_it(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    create_response = client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"], "Old task title"),
        headers=auth_headers,
    )
    task = create_response.json()

    update_response = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={
            "title": "New task title",
            "short_description": "Task cancelled after scope review.",
            "status": "cancelled",
        },
        headers=auth_headers,
    )

    assert update_response.status_code == 200
    assert update_response.json()["title"] == "New task title"
    assert update_response.json()["status"] == "cancelled"


def test_update_task_rejects_null_short_description(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    create_response = client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"]),
        headers=auth_headers,
    )

    response = client.patch(
        f"/api/v1/tasks/{create_response.json()['id']}",
        json={"short_description": None},
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_mark_task_as_done(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    create_response = client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"], "Finish task"),
        headers=auth_headers,
    )
    task = create_response.json()

    done_response = client.patch(
        f"/api/v1/tasks/{task['id']}/done",
        headers=auth_headers,
    )

    assert done_response.status_code == 200
    assert done_response.json()["status"] == "done"


def test_delete_task(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    create_response = client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"], "Delete me"),
        headers=auth_headers,
    )
    task = create_response.json()

    delete_response = client.delete(
        f"/api/v1/tasks/{task['id']}",
        headers=auth_headers,
    )
    get_response = client.get(f"/api/v1/tasks/{task['id']}", headers=auth_headers)

    assert delete_response.status_code == 204
    assert get_response.status_code == 404


def test_archived_project_is_read_only_for_tasks(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    create_response = client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"], "Existing task"),
        headers=auth_headers,
    )
    task_id = create_response.json()["id"]

    archive_response = client.patch(
        f"/api/v1/projects/{created_project['id']}/archive",
        headers=auth_headers,
    )
    assert archive_response.status_code == 200

    create_after_archive = client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"], "Should fail"),
        headers=auth_headers,
    )
    update_after_archive = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"status": "in_progress"},
        headers=auth_headers,
    )
    delete_after_archive = client.delete(
        f"/api/v1/tasks/{task_id}",
        headers=auth_headers,
    )

    assert create_after_archive.status_code == 400
    assert update_after_archive.status_code == 400
    assert delete_after_archive.status_code == 400
    assert update_after_archive.json()["detail"] == (
        "Cannot modify tasks in archived projects"
    )


def test_create_task_without_token_returns_401(
    client: TestClient,
    created_project: dict[str, str],
) -> None:
    response = client.post(
        "/api/v1/tasks",
        json=task_payload(created_project["id"], "Unauthorized task"),
    )

    assert response.status_code == 401
