from fastapi.testclient import TestClient


def test_full_user_project_task_flow(client: TestClient) -> None:
    """Cobre o fluxo principal com o contrato Taskly da tarefa."""
    user_payload = {
        "name": "Ana Silva",
        "email": "ana.flow@example.com",
        "password": "StrongPassword123",
    }

    register_response = client.post("/api/v1/auth/register", json=user_payload)
    assert register_response.status_code == 201

    login_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": user_payload["email"],
            "password": user_payload["password"],
        },
    )
    assert login_response.status_code == 200

    access_token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    me_response = client.get("/api/v1/auth/me", headers=headers)
    assert me_response.status_code == 200
    assert me_response.json()["user"]["email"] == user_payload["email"]

    project_response = client.post(
        "/api/v1/projects",
        json={
            "name": "Portfolio API",
            "description": "Full flow test project.",
        },
        headers=headers,
    )
    assert project_response.status_code == 201

    project_id = project_response.json()["id"]
    task_response = client.post(
        "/api/v1/tasks",
        json={
            "project_id": project_id,
            "title": "Create full flow test",
            "short_description": "Validate the complete backend flow.",
            "description": "Ensure the main Taskly backend flow works.",
            "priority": "high",
            "due_at": "2026-06-15T21:30:00Z",
        },
        headers=headers,
    )
    assert task_response.status_code == 201
    assert task_response.json()["project_id"] == project_id

    tasks_response = client.get(
        f"/api/v1/tasks?project_id={project_id}",
        headers=headers,
    )
    assert tasks_response.status_code == 200

    tasks_data = tasks_response.json()
    assert tasks_data["total"] == 1
    assert tasks_data["items"][0]["title"] == "Create full flow test"
