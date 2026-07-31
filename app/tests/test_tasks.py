from fastapi.testclient import TestClient


def test_create_task(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    response = client.post(
        "/api/v1/tasks",
        json={
            "project_id": created_project["id"],
            "title": "Create CRUD routes",
            "description": "Implement protected routes for projects and tasks.",
            "priority": "high",
            "due_date": "2026-06-15",
        },
        headers=auth_headers,
    )

    assert response.status_code == 201

    data = response.json()

    assert data["project_id"] == created_project["id"]
    assert data["title"] == "Create CRUD routes"
    assert data["status"] == "todo"
    assert data["priority"] == "high"


def test_list_tasks(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    client.post(
        "/api/v1/tasks",
        json={
            "project_id": created_project["id"],
            "title": "Create tests",
            "description": "Add pytest coverage.",
            "priority": "medium",
            "due_date": "2026-06-20",
        },
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
    client.post(
        "/api/v1/tasks",
        json={
            "project_id": created_project["id"],
            "title": "Write authentication tests",
            "description": "Cover register and login.",
            "priority": "high",
            "due_date": "2026-06-15",
        },
        headers=auth_headers,
    )
    client.post(
        "/api/v1/tasks",
        json={
            "project_id": created_project["id"],
            "title": "Update README",
            "description": "Document how to run tests.",
            "priority": "low",
            "due_date": "2026-07-01",
        },
        headers=auth_headers,
    )

    response = client.get(
        "/api/v1/tasks?priority=high&search=authentication",
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
        json={
            "project_id": created_project["id"],
            "title": "Create task detail endpoint",
            "priority": "medium",
        },
        headers=auth_headers,
    )

    task = create_response.json()

    response = client.get(f"/api/v1/tasks/{task['id']}", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["id"] == task["id"]


def test_update_task(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    create_response = client.post(
        "/api/v1/tasks",
        json={
            "project_id": created_project["id"],
            "title": "Old task title",
            "priority": "medium",
        },
        headers=auth_headers,
    )

    task = create_response.json()

    update_response = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"title": "New task title", "status": "in_progress"},
        headers=auth_headers,
    )

    assert update_response.status_code == 200
    assert update_response.json()["title"] == "New task title"
    assert update_response.json()["status"] == "in_progress"


def test_mark_task_as_done(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    create_response = client.post(
        "/api/v1/tasks",
        json={
            "project_id": created_project["id"],
            "title": "Finish task",
            "priority": "medium",
        },
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
        json={
            "project_id": created_project["id"],
            "title": "Delete me",
            "priority": "medium",
        },
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


def test_cannot_create_task_in_archived_project(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    archive_response = client.patch(
        f"/api/v1/projects/{created_project['id']}/archive",
        headers=auth_headers,
    )

    assert archive_response.status_code == 200

    task_response = client.post(
        "/api/v1/tasks",
        json={
            "project_id": created_project["id"],
            "title": "Should fail",
            "priority": "high",
        },
        headers=auth_headers,
    )

    assert task_response.status_code == 400
    assert task_response.json()["detail"] == "Cannot create tasks in archived projects"


def test_create_task_without_token_returns_401(
    client: TestClient,
    created_project: dict[str, str],
) -> None:
    response = client.post(
        "/api/v1/tasks",
        json={
            "project_id": created_project["id"],
            "title": "Unauthorized task",
            "priority": "high",
        },
    )

    assert response.status_code == 401
