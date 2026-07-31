from collections.abc import Callable

from fastapi.testclient import TestClient


def headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


def create_project(
    client: TestClient,
    auth_headers: dict[str, str],
    name: str = "Tagged project",
) -> str:
    response = client.post(
        "/api/v1/projects",
        json={"name": name, "description": "Project used by tag tests."},
        headers=auth_headers,
    )
    assert response.status_code == 201

    return response.json()["id"]


def create_task_with_tags(
    client: TestClient,
    auth_headers: dict[str, str],
    project_id: str,
    tags: list[str],
) -> dict[str, object]:
    response = client.post(
        "/api/v1/tasks",
        json={
            "project_id": project_id,
            "title": "Implement tags",
            "short_description": "Associate reusable tags with the task.",
            "priority": "medium",
            "tags": tags,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201

    return response.json()


def test_create_task_normalizes_and_deduplicates_tags(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    task = create_task_with_tags(
        client,
        auth_headers,
        created_project["id"],
        [" Backend ", "backend", "  High   Priority  "],
    )

    assert [tag["name"] for tag in task["tags"]] == ["Backend", "High Priority"]

    response = client.get("/api/v1/tags", headers=auth_headers)

    assert response.status_code == 200
    assert [tag["name"] for tag in response.json()] == ["Backend", "High Priority"]


def test_update_task_replaces_and_clears_tags(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    task = create_task_with_tags(
        client,
        auth_headers,
        created_project["id"],
        ["Backend", "API"],
    )

    replace_response = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"tags": ["Frontend"]},
        headers=auth_headers,
    )

    assert replace_response.status_code == 200
    assert [tag["name"] for tag in replace_response.json()["tags"]] == ["Frontend"]

    clear_response = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"tags": []},
        headers=auth_headers,
    )

    assert clear_response.status_code == 200
    assert clear_response.json()["tags"] == []


def test_update_task_rejects_null_tags(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    task = create_task_with_tags(
        client,
        auth_headers,
        created_project["id"],
        ["Backend"],
    )

    response = client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"tags": None},
        headers=auth_headers,
    )

    assert response.status_code == 422
    assert "tags cannot be null" in response.text


def test_tag_search_is_scoped_to_authenticated_user(
    client: TestClient,
    authenticated_user_factory: Callable[[str, str], dict[str, str]],
) -> None:
    first_user = authenticated_user_factory("tags-a@example.com", "Tags A")
    second_user = authenticated_user_factory("tags-b@example.com", "Tags B")
    first_headers = headers(first_user["access_token"])
    second_headers = headers(second_user["access_token"])

    first_project = create_project(client, first_headers, "First project")
    second_project = create_project(client, second_headers, "Second project")

    first_task = create_task_with_tags(
        client,
        first_headers,
        first_project,
        ["Backend", "Private A"],
    )
    second_task = create_task_with_tags(
        client,
        second_headers,
        second_project,
        ["backend", "Private B"],
    )

    first_tags = client.get(
        "/api/v1/tags",
        params={"search": "back"},
        headers=first_headers,
    )
    second_tags = client.get(
        "/api/v1/tags",
        params={"search": "back"},
        headers=second_headers,
    )

    assert first_tags.status_code == 200
    assert second_tags.status_code == 200
    assert [tag["name"] for tag in first_tags.json()] == ["Backend"]
    assert [tag["name"] for tag in second_tags.json()] == ["backend"]
    assert first_task["tags"][0]["id"] != second_task["tags"][0]["id"]


def test_create_task_rejects_more_than_ten_tags(
    client: TestClient,
    auth_headers: dict[str, str],
    created_project: dict[str, str],
) -> None:
    response = client.post(
        "/api/v1/tasks",
        json={
            "project_id": created_project["id"],
            "title": "Too many tags",
            "short_description": "This payload must be rejected.",
            "tags": [f"tag-{index}" for index in range(11)],
        },
        headers=auth_headers,
    )

    assert response.status_code == 422
