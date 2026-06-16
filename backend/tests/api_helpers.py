"""Typed, reusable helpers for the Blueprint Flow API tests.

Keeping the HTTP plumbing here lets the individual test functions stay small
and low-complexity (no giant setup blocks, few local variables). Every helper
is fully type-annotated.
"""
from __future__ import annotations

import io
import os
import time
from typing import Any

import requests

BASE_URL: str = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or "https://floor-planning-stage.preview.emergentagent.com"
).rstrip("/")

TIMEOUT: int = 20

# (email, password) credentials seeded in the database.
ADMIN: tuple[str, str] = ("manish.uppal@blueprintflow.in", "password123")
DESIGNER: tuple[str, str] = ("amarpreet.padam@blueprintflow.in", "password123")
ONSITE: tuple[str, str] = ("sudama@blueprintflow.in", "password123")


def login(email: str, password: str) -> requests.Session:
    """Authenticate and return a session carrying the bpf_session cookie.

    The cookie is pinned as an explicit header so the session works over both
    the https preview URL and a plain http://localhost proxy (where a Secure
    cookie would otherwise be dropped).
    """
    session = requests.Session()
    resp = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=TIMEOUT,
    )
    assert resp.status_code == 200, f"login {email}: {resp.status_code} {resp.text}"
    token = resp.cookies.get("bpf_session")
    if token:
        session.headers.update({"Cookie": f"bpf_session={token}"})
    return session


def unique_suffix() -> int:
    """A monotonically-increasing suffix for unique names/codes."""
    return int(time.time() * 1000)


def _entity_id(payload: dict[str, Any], wrapper_key: str) -> str:
    """Read an id from either a flat ``{id}`` or wrapped ``{key:{id}}`` body."""
    return payload.get("id") or payload.get(wrapper_key, {}).get("id")


def create_project(admin: requests.Session, name: str, code: str, **extra: Any) -> str:
    body: dict[str, Any] = {
        "name": name,
        "code": code,
        "clientName": "x",
        "client": "x",
        "location": "x",
        **extra,
    }
    resp = admin.post(f"{BASE_URL}/api/projects", json=body, timeout=TIMEOUT)
    assert resp.status_code in (200, 201), resp.text
    return _entity_id(resp.json(), "project")


def delete_project(admin: requests.Session, pid: str) -> None:
    admin.delete(f"{BASE_URL}/api/projects/{pid}", timeout=TIMEOUT)


def add_floor(admin: requests.Session, pid: str, name: str, ftype: str) -> requests.Response:
    return admin.post(
        f"{BASE_URL}/api/projects/{pid}/floors",
        json={"floorName": name, "floorType": ftype},
        timeout=TIMEOUT,
    )


def add_floors(admin: requests.Session, pid: str, floors: list[tuple[str, str]]) -> None:
    for name, ftype in floors:
        resp = add_floor(admin, pid, name, ftype)
        assert resp.status_code in (200, 201), f"{name}/{ftype}: {resp.status_code} {resp.text}"


def list_floors(admin: requests.Session, pid: str) -> list[dict[str, Any]]:
    data = admin.get(f"{BASE_URL}/api/projects/{pid}/floors", timeout=TIMEOUT).json()
    return data if isinstance(data, list) else data.get("floors") or data.get("items") or []


def floor_type(floor: dict[str, Any]) -> str:
    return floor.get("floorType") or floor.get("type")


def floor_id_of_type(floors: list[dict[str, Any]], ftype: str) -> str:
    return next(f["id"] for f in floors if floor_type(f) == ftype)


def list_users(admin: requests.Session) -> list[dict[str, Any]]:
    data = admin.get(f"{BASE_URL}/api/users", timeout=TIMEOUT).json()
    return data if isinstance(data, list) else data.get("users") or data.get("items") or []


def user_id(admin: requests.Session, email: str) -> str:
    return next(u["id"] for u in list_users(admin) if u.get("email") == email)


def interior_spec_id(admin: requests.Session) -> str:
    data = admin.get(f"{BASE_URL}/api/specializations", timeout=TIMEOUT).json()
    specs = data if isinstance(data, list) else data.get("items") or data.get("specializations") or []
    return next((s["id"] for s in specs if "Interior" in (s.get("name") or "")), specs[0]["id"])


def add_member(admin: requests.Session, pid: str, uid: str, role: str = "DESIGNER") -> requests.Response:
    resp = admin.post(
        f"{BASE_URL}/api/projects/{pid}/members",
        json={"userId": uid, "role": role},
        timeout=TIMEOUT,
    )
    assert resp.status_code in (200, 201), resp.text
    return resp


def create_category(
    admin: requests.Session,
    pid: str,
    name: str,
    spec_id: str,
    discipline: str = "INTERIOR",
    applies_to: tuple[str, ...] = ("FLOOR",),
) -> str:
    body: dict[str, Any] = {
        "name": name,
        "projectId": pid,
        "appliesTo": list(applies_to),
        "discipline": discipline,
        "specializationId": spec_id,
    }
    resp = admin.post(f"{BASE_URL}/api/categories", json=body, timeout=TIMEOUT)
    assert resp.status_code in (200, 201), resp.text
    return _entity_id(resp.json(), "category")


def assign_task(
    admin: requests.Session,
    pid: str,
    floor_id: str,
    cat_id: str,
    designer_id: str,
    reviewer_id: str,
) -> str:
    body: dict[str, Any] = {
        "projectId": pid,
        "floorId": floor_id,
        "designCategoryId": cat_id,
        "categoryId": cat_id,
        "assigneeId": designer_id,
        "designerId": designer_id,
        "reviewerId": reviewer_id,
        "deadline": "2026-12-31T00:00:00.000Z",
        "dueDate": "2026-12-31T00:00:00.000Z",
        "priority": "HIGH",
    }
    resp = admin.post(f"{BASE_URL}/api/tasks", json=body, timeout=TIMEOUT)
    assert resp.status_code in (200, 201), resp.text
    return _entity_id(resp.json(), "task")


def upload_file(
    session: requests.Session, tid: str, filename: str, content: bytes = b"%PDF-1.4 test"
) -> str:
    files = {"file": (filename, io.BytesIO(content), "application/pdf")}
    resp = session.post(f"{BASE_URL}/api/tasks/{tid}/files", files=files, timeout=30)
    assert resp.status_code in (200, 201), resp.text
    return _entity_id(resp.json(), "file")


def review(session: requests.Session, tid: str, decision: str, comments: str = "") -> requests.Response:
    return session.post(
        f"{BASE_URL}/api/tasks/{tid}/reviews",
        json={"decision": decision, "comments": comments},
        timeout=TIMEOUT,
    )


def get_task(session: requests.Session, tid: str) -> dict[str, Any]:
    data = session.get(f"{BASE_URL}/api/tasks/{tid}", timeout=TIMEOUT).json()
    return data.get("task") or data


def task_file_ids(task_obj: dict[str, Any]) -> list[str]:
    files = task_obj.get("files") or task_obj.get("versions") or task_obj.get("designFiles") or []
    return [f.get("id") for f in files]


def task_reviews(session: requests.Session, tid: str) -> list[dict[str, Any]]:
    task = get_task(session, tid)
    reviews = task.get("reviews") or task.get("reviewHistory") or []
    if reviews:
        return reviews
    resp = session.get(f"{BASE_URL}/api/tasks/{tid}/reviews", timeout=TIMEOUT)
    if resp.status_code != 200:
        return []
    data = resp.json()
    return data if isinstance(data, list) else data.get("reviews", [])


def review_text(review_obj: dict[str, Any]) -> str:
    return review_obj.get("comments") or review_obj.get("comment") or review_obj.get("reason") or ""


def file_status(session: requests.Session, fid: str) -> int:
    return session.get(f"{BASE_URL}/api/files/{fid}", timeout=TIMEOUT).status_code


def build_reject_scenario(
    admin: requests.Session, designer: requests.Session, onsite: requests.Session
) -> dict[str, str]:
    """End-to-end: project -> floor -> category -> task -> upload v1 -> REJECT.

    Returns the ids needed to assert visibility rules. Linear (low-complexity).
    """
    sfx = unique_suffix()
    pid = create_project(admin, f"TEST_hide_{sfx}", f"THD{sfx}")
    add_floors(admin, pid, [("Stilt", "STILT"), ("Floor 1", "FLOOR")])
    floor_id = floor_id_of_type(list_floors(admin, pid), "FLOOR")
    designer_id = user_id(admin, DESIGNER[0])
    onsite_id = user_id(admin, ONSITE[0])
    add_member(admin, pid, designer_id)
    cat_id = create_category(admin, pid, f"TEST_HideCat_{sfx}", interior_spec_id(admin))
    tid = assign_task(admin, pid, floor_id, cat_id, designer_id, onsite_id)
    fid_v1 = upload_file(designer, tid, "v1.pdf", b"%PDF-1.4 v1")
    resp = review(onsite, tid, "REJECTED", "fix it - missing dimensions")
    assert resp.status_code in (200, 201), f"reject: {resp.status_code} {resp.text}"
    return {"task_id": tid, "file_id": fid_v1, "project_id": pid}
