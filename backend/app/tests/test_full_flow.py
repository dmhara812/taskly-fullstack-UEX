from fastapi.testclient import TestClient


def test_full_user_project_task_flow(client: TestClient) -> None:
    """Cobre autenticação, tags, anexos, status e arquivamento em conjunto."""
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
            "tags": ["Backend", "Release"],
        },
        headers=headers,
    )
    assert task_response.status_code == 201

    task_data = task_response.json()
    task_id = task_data["id"]
    assert task_data["project_id"] == project_id
    assert [tag["name"] for tag in task_data["tags"]] == [
        "Backend",
        "Release",
    ]

    upload_response = client.post(
        f"/api/v1/tasks/{task_id}/attachments",
        files={
            "file": (
                "evidence.pdf",
                b"%PDF-1.4\nTaskly integration evidence",
                "application/pdf",
            )
        },
        headers=headers,
    )
    assert upload_response.status_code == 201
    attachment = upload_response.json()

    update_response = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"status": "done"},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "done"
    assert len(update_response.json()["attachments"]) == 1

    tasks_response = client.get(
        f"/api/v1/tasks?project_id={project_id}",
        headers=headers,
    )
    assert tasks_response.status_code == 200
    assert tasks_response.json()["total"] == 1
    assert tasks_response.json()["items"][0]["status"] == "done"

    download_response = client.get(attachment["url"], headers=headers)
    assert download_response.status_code == 200
    assert download_response.content.startswith(b"%PDF-")

    archive_response = client.patch(
        f"/api/v1/projects/{project_id}/archive",
        headers=headers,
    )
    assert archive_response.status_code == 200
    assert archive_response.json()["status"] == "archived"

    blocked_update = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"status": "cancelled"},
        headers=headers,
    )
    assert blocked_update.status_code == 400
    assert blocked_update.json()["detail"] == (
        "Cannot modify tasks in archived projects"
    )

    read_only_task = client.get(f"/api/v1/tasks/{task_id}", headers=headers)
    assert read_only_task.status_code == 200

    read_only_download = client.get(attachment["url"], headers=headers)
    assert read_only_download.status_code == 200
