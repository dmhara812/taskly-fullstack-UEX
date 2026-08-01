from collections.abc import Callable

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.storage import LocalStorageBackend

PNG_CONTENT = b"\x89PNG\r\n\x1a\n" + b"taskly-image"
PDF_CONTENT = b"%PDF-1.7\n% taskly test"


def headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def create_project(
    client: TestClient,
    auth_headers: dict[str, str],
    name: str = "Attachments project",
) -> dict[str, str]:
    response = client.post(
        "/api/v1/projects",
        json={"name": name, "description": "Project used by attachment tests."},
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()


def create_task(
    client: TestClient,
    auth_headers: dict[str, str],
    project_id: str,
) -> dict[str, object]:
    response = client.post(
        "/api/v1/tasks",
        json={
            "project_id": project_id,
            "title": "Implement attachments",
            "short_description": "Store task files behind an adapter.",
            "tags": ["backend"],
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()


def upload_png(
    client: TestClient,
    auth_headers: dict[str, str],
    task_id: str,
    name: str = "evidence.png",
) -> dict[str, object]:
    response = client.post(
        f"/api/v1/tasks/{task_id}/attachments",
        files={"file": (name, PNG_CONTENT, "image/png")},
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()


def test_upload_list_download_and_task_response(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    task = create_task(client, auth_headers, created_project["id"])
    attachment = upload_png(client, auth_headers, str(task["id"]), "../evidence.png")

    assert attachment["name"] == "evidence.png"
    assert attachment["content_type"] == "image/png"
    assert attachment["size_bytes"] == len(PNG_CONTENT)
    assert attachment["url"].endswith(f"/{attachment['id']}/content")

    list_response = client.get(
        f"/api/v1/tasks/{task['id']}/attachments",
        headers=auth_headers,
    )
    assert list_response.status_code == 200
    assert list_response.json() == [attachment]

    task_response = client.get(
        f"/api/v1/tasks/{task['id']}",
        headers=auth_headers,
    )
    assert task_response.status_code == 200
    assert task_response.json()["attachments"] == [attachment]

    content_response = client.get(attachment["url"], headers=auth_headers)
    assert content_response.status_code == 200
    assert content_response.content == PNG_CONTENT
    assert content_response.headers["content-type"] == "image/png"
    assert "evidence.png" in content_response.headers["content-disposition"]


def test_rejects_unsupported_mismatched_empty_and_oversized_files(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    task = create_task(client, auth_headers, created_project["id"])
    endpoint = f"/api/v1/tasks/{task['id']}/attachments"

    unsupported = client.post(
        endpoint,
        files={"file": ("notes.txt", b"text", "text/plain")},
        headers=auth_headers,
    )
    assert unsupported.status_code == 415

    mismatched = client.post(
        endpoint,
        files={"file": ("fake.png", PDF_CONTENT, "image/png")},
        headers=auth_headers,
    )
    assert mismatched.status_code == 415

    empty = client.post(
        endpoint,
        files={"file": ("empty.pdf", b"", "application/pdf")},
        headers=auth_headers,
    )
    assert empty.status_code == 400

    oversized_content = b"%PDF-" + b"x" * get_settings().attachment_max_size_bytes
    oversized = client.post(
        endpoint,
        files={"file": ("large.pdf", oversized_content, "application/pdf")},
        headers=auth_headers,
    )
    assert oversized.status_code == 413


def test_attachment_ownership_is_enforced(
    client: TestClient,
    authenticated_user_factory: Callable[[str, str], dict[str, str]],
) -> None:
    first = authenticated_user_factory("attachment-a@example.com", "Attachment A")
    second = authenticated_user_factory("attachment-b@example.com", "Attachment B")
    first_headers = headers(first["access_token"])
    second_headers = headers(second["access_token"])

    project = create_project(client, first_headers)
    task = create_task(client, first_headers, project["id"])
    attachment = upload_png(client, first_headers, str(task["id"]))

    foreign_upload = client.post(
        f"/api/v1/tasks/{task['id']}/attachments",
        files={"file": ("foreign.png", PNG_CONTENT, "image/png")},
        headers=second_headers,
    )
    foreign_list = client.get(
        f"/api/v1/tasks/{task['id']}/attachments",
        headers=second_headers,
    )
    foreign_download = client.get(attachment["url"], headers=second_headers)
    foreign_delete = client.delete(
        f"/api/v1/attachments/{attachment['id']}",
        headers=second_headers,
    )

    assert foreign_upload.status_code == 404
    assert foreign_list.status_code == 404
    assert foreign_download.status_code == 404
    assert foreign_delete.status_code == 404


def test_archived_project_is_read_only_for_attachments(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    task = create_task(client, auth_headers, created_project["id"])
    attachment = upload_png(client, auth_headers, str(task["id"]))

    archive_response = client.patch(
        f"/api/v1/projects/{created_project['id']}/archive",
        headers=auth_headers,
    )
    assert archive_response.status_code == 200

    upload_response = client.post(
        f"/api/v1/tasks/{task['id']}/attachments",
        files={"file": ("new.png", PNG_CONTENT, "image/png")},
        headers=auth_headers,
    )
    delete_response = client.delete(
        f"/api/v1/attachments/{attachment['id']}",
        headers=auth_headers,
    )
    download_response = client.get(attachment["url"], headers=auth_headers)

    assert upload_response.status_code == 400
    assert delete_response.status_code == 400
    assert download_response.status_code == 200


def test_delete_attachment_and_task_remove_physical_files(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
    storage_backend: LocalStorageBackend,
) -> None:
    first_task = create_task(client, auth_headers, created_project["id"])
    first_attachment = upload_png(client, auth_headers, str(first_task["id"]))
    assert any(path.is_file() for path in storage_backend.root.rglob("*"))

    delete_attachment = client.delete(
        f"/api/v1/attachments/{first_attachment['id']}",
        headers=auth_headers,
    )
    assert delete_attachment.status_code == 204
    assert not any(path.is_file() for path in storage_backend.root.rglob("*"))

    second_task = create_task(client, auth_headers, created_project["id"])
    upload_png(client, auth_headers, str(second_task["id"]), "task-delete.png")
    assert any(path.is_file() for path in storage_backend.root.rglob("*"))

    delete_task = client.delete(
        f"/api/v1/tasks/{second_task['id']}",
        headers=auth_headers,
    )
    assert delete_task.status_code == 204
    assert not any(path.is_file() for path in storage_backend.root.rglob("*"))


def test_delete_project_removes_all_attachment_files(
    client: TestClient,
    auth_headers: dict[str, str],
    storage_backend: LocalStorageBackend,
) -> None:
    project = create_project(client, auth_headers, "Project deletion cleanup")
    first_task = create_task(client, auth_headers, project["id"])
    second_task = create_task(client, auth_headers, project["id"])
    upload_png(client, auth_headers, str(first_task["id"]), "first.png")
    upload_png(client, auth_headers, str(second_task["id"]), "second.png")

    stored_files = [path for path in storage_backend.root.rglob("*") if path.is_file()]
    assert len(stored_files) == 2

    response = client.delete(
        f"/api/v1/projects/{project['id']}",
        headers=auth_headers,
    )

    assert response.status_code == 204
    assert not any(path.is_file() for path in storage_backend.root.rglob("*"))
