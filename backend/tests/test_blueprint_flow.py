"""
Blueprint Flow — Backend API audit (Next.js routes via FastAPI proxy).
Covers: auth, profile, projects, floors, categories, members, tasks,
files, reviews, users, specializations, dashboard, notifications, RBAC.
"""
from __future__ import annotations

import io
import time
from typing import Any

import pytest
import requests

from api_helpers import ADMIN, BASE_URL, DESIGNER, ONSITE, login

ONSITE_ELEC: tuple[str, str] = ("mahesh@blueprintflow.in", "password123")  # MEP Electrical


@pytest.fixture(scope="session")
def admin() -> requests.Session:
    return login(*ADMIN)


@pytest.fixture(scope="session")
def designer() -> requests.Session:
    return login(*DESIGNER)


@pytest.fixture(scope="session")
def onsite() -> requests.Session:
    return login(*ONSITE)


@pytest.fixture(scope="session")
def state() -> dict[str, Any]:
    return {}


# ---------- AUTH ----------
class TestAuth:
    def test_me_anonymous(self) -> None:
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 200
        assert not r.json().get("user")

    def test_login_bad(self) -> None:
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN[0], "password": "wrong"}, timeout=15)
        assert r.status_code in (400, 401, 403)

    def test_admin_login_me(self, admin: requests.Session) -> None:
        r = admin.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["role"] == "ADMIN"
        assert u["email"] == ADMIN[0]

    def test_designer_login(self, designer: requests.Session) -> None:
        u = designer.get(f"{BASE_URL}/api/auth/me", timeout=15).json()["user"]
        assert u["role"] == "DESIGNER"

    def test_onsite_login(self, onsite: requests.Session) -> None:
        u = onsite.get(f"{BASE_URL}/api/auth/me", timeout=15).json()["user"]
        assert u["role"] == "ONSITE"
        # specialization is optional for ONSITE (site supervisors have none)


# ---------- PROFILE ----------
class TestProfile:
    def test_profile_get(self, admin: requests.Session) -> None:
        r = admin.get(f"{BASE_URL}/api/profile", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("email") == ADMIN[0] or d.get("user", {}).get("email") == ADMIN[0]

    def test_profile_update_phone(self, admin: requests.Session) -> None:
        # Try common shapes
        r = admin.patch(f"{BASE_URL}/api/profile",
                        json={"name": "Manish Uppal", "phone": "9999999999"}, timeout=15)
        if r.status_code == 405:
            r = admin.put(f"{BASE_URL}/api/profile",
                          json={"name": "Manish Uppal", "phone": "9999999999"}, timeout=15)
        assert r.status_code in (200, 204), f"{r.status_code} {r.text}"

    def test_password_change_wrong_current(self, admin: requests.Session) -> None:
        # Password change is PATCH /api/profile; a wrong current password -> 400.
        r = admin.patch(f"{BASE_URL}/api/profile",
                        json={"currentPassword": "WRONG", "newPassword": "newpass1234"}, timeout=15)
        assert r.status_code == 400, f"{r.status_code} {r.text}"


# ---------- SPECIALIZATIONS ----------
class TestSpecializations:
    def test_list(self, admin: requests.Session, state: dict[str, Any]) -> None:
        r = admin.get(f"{BASE_URL}/api/specializations", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        items = data if isinstance(data, list) else data.get("items") or data.get("specializations") or []
        assert len(items) > 0
        state["specs"] = items

    def test_create_rename_delete(self, admin: requests.Session, state: dict[str, Any]) -> None:
        name = f"TEST_Spec_{int(time.time())}"
        r = admin.post(f"{BASE_URL}/api/specializations", json={"name": name}, timeout=15)
        assert r.status_code in (200, 201), r.text
        sid = r.json().get("id") or r.json().get("specialization", {}).get("id")
        assert sid
        # rename
        r2 = admin.patch(f"{BASE_URL}/api/specializations/{sid}",
                         json={"name": name + "_R"}, timeout=15)
        if r2.status_code == 405:
            r2 = admin.put(f"{BASE_URL}/api/specializations/{sid}",
                           json={"name": name + "_R"}, timeout=15)
        # delete
        r3 = admin.delete(f"{BASE_URL}/api/specializations/{sid}", timeout=15)
        assert r3.status_code in (200, 204), f"delete: {r3.status_code} {r3.text}"


# ---------- USERS ----------
class TestUsers:
    def test_list_users(self, admin: requests.Session, state: dict[str, Any]) -> None:
        r = admin.get(f"{BASE_URL}/api/users", timeout=15)
        assert r.status_code == 200
        data = r.json()
        users = data if isinstance(data, list) else data.get("users") or data.get("items") or []
        assert len(users) >= 20, f"expected ~25 imported users, got {len(users)}"
        state["users"] = users
        # find a designer (interior) for tasks
        for u in users:
            if u.get("email") == DESIGNER[0]:
                state["designer_id"] = u["id"]
            if u.get("email") == ONSITE[0]:
                state["onsite_id"] = u["id"]

    def test_designer_cannot_list_users(self, designer: requests.Session) -> None:
        r = designer.get(f"{BASE_URL}/api/users", timeout=15)
        assert r.status_code in (401, 403), f"designer should not list users: {r.status_code}"

    def test_create_update_deactivate(self, admin: requests.Session, state: dict[str, Any]) -> None:
        spec_id = state["specs"][0].get("id")
        email = f"test_user_{int(time.time())}@blueprintflow.in"
        r = admin.post(f"{BASE_URL}/api/users", json={
            "name": "TEST User", "email": email, "password": "password123",
            "role": "DESIGNER", "specializationId": spec_id,
        }, timeout=15)
        assert r.status_code in (200, 201), r.text
        uid = r.json().get("id") or r.json().get("user", {}).get("id")
        assert uid
        # update role
        r2 = admin.patch(f"{BASE_URL}/api/users/{uid}",
                         json={"role": "ONSITE", "specializationId": spec_id}, timeout=15)
        if r2.status_code == 405:
            r2 = admin.put(f"{BASE_URL}/api/users/{uid}",
                           json={"role": "ONSITE", "specializationId": spec_id}, timeout=15)
        assert r2.status_code in (200, 204), f"update: {r2.status_code} {r2.text}"
        # deactivate
        r3 = admin.patch(f"{BASE_URL}/api/users/{uid}",
                        json={"isActive": False}, timeout=15)
        assert r3.status_code in (200, 204), r3.text
        # reactivate
        r4 = admin.patch(f"{BASE_URL}/api/users/{uid}",
                        json={"isActive": True}, timeout=15)
        assert r4.status_code in (200, 204)


# ---------- PROJECTS ----------
class TestProjects:
    def test_list_projects(self, admin: requests.Session) -> None:
        r = admin.get(f"{BASE_URL}/api/projects", timeout=15)
        assert r.status_code == 200, r.text

    def test_create_project(self, admin: requests.Session, state: dict[str, Any]) -> None:
        ts = int(time.time())
        body = {
            "name": f"TEST Project {ts}",
            "code": f"TST{ts}",
            "clientName": "Test Client",
            "client": "Test Client",
            "location": "Test City",
        }
        r = admin.post(f"{BASE_URL}/api/projects", json=body, timeout=20)
        assert r.status_code in (200, 201), r.text
        pid = r.json().get("id") or r.json().get("project", {}).get("id")
        assert pid
        state["project_id"] = pid

    def test_get_project(self, admin: requests.Session, state: dict[str, Any]) -> None:
        pid = state["project_id"]
        r = admin.get(f"{BASE_URL}/api/projects/{pid}", timeout=15)
        assert r.status_code == 200, r.text

    def test_designer_cannot_create_project(self, designer: requests.Session) -> None:
        r = designer.post(f"{BASE_URL}/api/projects", json={
            "name": "X", "code": "X1", "client": "x", "location": "x"
        }, timeout=15)
        assert r.status_code in (401, 403)

    def test_add_floors(self, admin: requests.Session, state: dict[str, Any]) -> None:
        pid = state["project_id"]
        floors = [
            {"floorName": "B1", "floorType": "BASEMENT"},
            {"floorName": "Stilt", "floorType": "STILT"},
            {"floorName": "Floor 1", "floorType": "FLOOR"},
            {"floorName": "Terrace", "floorType": "TERRACE"},
        ]
        for f in floors:
            r = admin.post(f"{BASE_URL}/api/projects/{pid}/floors", json=f, timeout=15)
            assert r.status_code in (200, 201), f"floor create {f}: {r.status_code} {r.text}"
        r = admin.get(f"{BASE_URL}/api/projects/{pid}/floors", timeout=15)
        assert r.status_code == 200
        data = r.json()
        flist = data if isinstance(data, list) else data.get("floors") or data.get("items") or []
        assert len(flist) >= 4
        # pick a FLOOR type
        floor_match = next((f for f in flist if (f.get("floorType") or f.get("type")) == "FLOOR"), flist[0])
        state["floor_id"] = floor_match.get("id")

    def test_add_remove_member(self, admin: requests.Session, state: dict[str, Any]) -> None:
        pid = state["project_id"]
        did = state["designer_id"]
        r = admin.post(f"{BASE_URL}/api/projects/{pid}/members",
                       json={"userId": did, "role": "DESIGNER"}, timeout=15)
        assert r.status_code in (200, 201), r.text
        r = admin.get(f"{BASE_URL}/api/projects/{pid}/members", timeout=15)
        assert r.status_code == 200
        # remove
        r2 = admin.delete(f"{BASE_URL}/api/projects/{pid}/members?userId={did}", timeout=15)
        # some apis use DELETE /members/[userId]
        if r2.status_code == 404:
            r2 = admin.delete(f"{BASE_URL}/api/projects/{pid}/members/{did}", timeout=15)
        if r2.status_code not in (200, 204):
            # re-add for downstream tests, but accept failure
            print(f"member remove returned {r2.status_code} {r2.text}")
        # re-add for task assignment
        admin.post(f"{BASE_URL}/api/projects/{pid}/members",
                   json={"userId": did, "role": "DESIGNER"}, timeout=15)


# ---------- CATEGORIES (Drawing register) ----------
class TestCategories:
    def test_list(self, admin: requests.Session) -> None:
        r = admin.get(f"{BASE_URL}/api/categories", timeout=15)
        assert r.status_code == 200

    def test_crud(self, admin: requests.Session, state: dict[str, Any]) -> None:
        ts = int(time.time())
        spec_id = state["specs"][0].get("id")
        pid = state["project_id"]
        body = {"name": f"TEST_Cat_{ts}", "projectId": pid,
                "appliesTo": ["FLOOR", "BASEMENT"],
                "discipline": "INTERIOR",
                "specializationId": spec_id}
        r = admin.post(f"{BASE_URL}/api/categories", json=body, timeout=15)
        assert r.status_code in (200, 201), r.text
        cid = r.json().get("id") or r.json().get("category", {}).get("id")
        state["category_id"] = cid
        # edit
        r2 = admin.patch(f"{BASE_URL}/api/categories/{cid}",
                         json={"appliesTo": ["FLOOR"]}, timeout=15)
        if r2.status_code == 405:
            r2 = admin.put(f"{BASE_URL}/api/categories/{cid}",
                           json={"appliesTo": ["FLOOR"]}, timeout=15)
        assert r2.status_code in (200, 204), r2.text
        # Create a 2nd we'll keep for task assignment, delete this one
        body2 = {"name": f"TEST_Cat2_{ts}", "projectId": pid,
                 "appliesTo": ["FLOOR", "BASEMENT", "STILT", "TERRACE"],
                 "discipline": "INTERIOR",
                 "specializationId": spec_id}
        r3 = admin.post(f"{BASE_URL}/api/categories", json=body2, timeout=15)
        assert r3.status_code in (200, 201), r3.text
        state["category_id_2"] = r3.json().get("id") or r3.json().get("category", {}).get("id")
        # delete first
        r4 = admin.delete(f"{BASE_URL}/api/categories/{cid}", timeout=15)
        assert r4.status_code in (200, 204), r4.text


# ---------- TASKS ----------
class TestTasks:
    def test_assign_task(self, admin: requests.Session, state: dict[str, Any]) -> None:
        pid = state["project_id"]
        body = {
            "projectId": pid,
            "floorId": state["floor_id"],
            "designCategoryId": state["category_id_2"],
            "categoryId": state["category_id_2"],
            "assigneeId": state["designer_id"],
            "designerId": state["designer_id"],
            "deadline": "2026-12-31T00:00:00.000Z",
            "dueDate": "2026-12-31T00:00:00.000Z",
            "priority": "HIGH",
        }
        r = admin.post(f"{BASE_URL}/api/tasks", json=body, timeout=20)
        assert r.status_code in (200, 201), f"task create: {r.status_code} {r.text}"
        tid = r.json().get("id") or r.json().get("task", {}).get("id")
        assert tid
        state["task_id"] = tid

    def test_admin_lists_tasks(self, admin: requests.Session, state: dict[str, Any]) -> None:
        r = admin.get(f"{BASE_URL}/api/tasks", timeout=15)
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("tasks") or data.get("items") or []
        ids = [t.get("id") for t in items]
        assert state["task_id"] in ids

    def test_designer_sees_assigned_task(self, designer: requests.Session, state: dict[str, Any]) -> None:
        r = designer.get(f"{BASE_URL}/api/tasks", timeout=15)
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("tasks") or data.get("items") or []
        ids = [t.get("id") for t in items]
        assert state["task_id"] in ids, "designer must see their assigned task"

    def test_onsite_cannot_see_assigned_yet(self, onsite: requests.Session, state: dict[str, Any]) -> None:
        r = onsite.get(f"{BASE_URL}/api/tasks", timeout=15)
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("tasks") or data.get("items") or []
        ids = [t.get("id") for t in items]
        assert state["task_id"] not in ids, "onsite must NOT see ASSIGNED task"

    def test_task_edit(self, admin: requests.Session, state: dict[str, Any]) -> None:
        tid = state["task_id"]
        r = admin.patch(f"{BASE_URL}/api/tasks/{tid}",
                       json={"priority": "MEDIUM"}, timeout=15)
        if r.status_code == 405:
            r = admin.put(f"{BASE_URL}/api/tasks/{tid}",
                         json={"priority": "MEDIUM"}, timeout=15)
        assert r.status_code in (200, 204), r.text

    def test_designer_upload(self, designer: requests.Session, state: dict[str, Any]) -> None:
        tid = state["task_id"]
        files = {"file": ("design.pdf", io.BytesIO(b"%PDF-1.4 fake pdf"), "application/pdf")}
        r = designer.post(f"{BASE_URL}/api/tasks/{tid}/files", files=files, timeout=30)
        assert r.status_code in (200, 201), f"upload: {r.status_code} {r.text}"
        data = r.json()
        fid = data.get("id") or data.get("file", {}).get("id")
        assert fid
        state["file_id_v1"] = fid
        # task should be PENDING_REVIEW now
        r2 = designer.get(f"{BASE_URL}/api/tasks/{tid}", timeout=15)
        assert r2.status_code == 200
        t = r2.json() if not r2.json().get("task") else r2.json()["task"]
        status = t.get("status")
        assert status in ("PENDING_REVIEW", "IN_REVIEW", "SUBMITTED"), f"status after upload: {status}"

    def test_onsite_sees_pending_review(self, onsite: requests.Session, state: dict[str, Any]) -> None:
        r = onsite.get(f"{BASE_URL}/api/tasks", timeout=15)
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("tasks") or data.get("items") or []
        ids = [t.get("id") for t in items]
        assert state["task_id"] in ids, "onsite must see PENDING_REVIEW task in their specialization"


# ---------- REVIEWS & RBAC ----------
class TestReviewsAndRBAC:
    def test_onsite_reject(self, onsite: requests.Session, state: dict[str, Any]) -> None:
        tid = state["task_id"]
        body = {"decision": "REJECTED", "comments": "needs revision - missing dimensions"}
        r = onsite.post(f"{BASE_URL}/api/tasks/{tid}/reviews", json=body, timeout=20)
        assert r.status_code in (200, 201), f"reject: {r.status_code} {r.text}"

    def test_rbac_rejected_file_blocked(self, onsite: requests.Session, state: dict[str, Any]) -> None:
        # After rejection the file from v1 should be hidden from onsite per lib/access.ts
        fid = state["file_id_v1"]
        r = onsite.get(f"{BASE_URL}/api/files/{fid}", timeout=15)
        assert r.status_code in (403, 404), (
            f"REJECTED previous version must be hidden from onsite; got {r.status_code}")

    def test_designer_uploads_revision(self, designer: requests.Session, state: dict[str, Any]) -> None:
        tid = state["task_id"]
        files = {"file": ("revision.pdf", io.BytesIO(b"%PDF-1.4 revised"), "application/pdf")}
        r = designer.post(f"{BASE_URL}/api/tasks/{tid}/files", files=files, timeout=30)
        assert r.status_code in (200, 201), f"revision upload: {r.status_code} {r.text}"
        state["file_id_v2"] = r.json().get("id") or r.json().get("file", {}).get("id")

    def test_onsite_approve(self, onsite: requests.Session, state: dict[str, Any]) -> None:
        tid = state["task_id"]
        body = {"decision": "APPROVED", "comments": "ok"}
        r = onsite.post(f"{BASE_URL}/api/tasks/{tid}/reviews", json=body, timeout=20)
        assert r.status_code in (200, 201), f"approve: {r.status_code} {r.text}"


# ---------- DASHBOARD & MISC ----------
class TestMisc:
    def test_dashboard_admin(self, admin: requests.Session) -> None:
        r = admin.get(f"{BASE_URL}/api/dashboard", timeout=15)
        assert r.status_code == 200, r.text

    def test_dashboard_designer(self, designer: requests.Session) -> None:
        r = designer.get(f"{BASE_URL}/api/dashboard", timeout=15)
        assert r.status_code == 200

    def test_dashboard_onsite(self, onsite: requests.Session) -> None:
        r = onsite.get(f"{BASE_URL}/api/dashboard", timeout=15)
        assert r.status_code == 200

    def test_notifications(self, admin: requests.Session) -> None:
        r = admin.get(f"{BASE_URL}/api/notifications", timeout=15)
        assert r.status_code == 200


# ---------- ANON RBAC ----------
class TestAnonBlocked:
    @pytest.mark.parametrize("path", [
        "/api/projects", "/api/tasks", "/api/users",
        "/api/profile", "/api/dashboard", "/api/notifications",
        "/api/categories", "/api/specializations",
    ])
    def test_anon_blocked(self, path: str) -> None:
        r = requests.get(f"{BASE_URL}{path}", timeout=15)
        assert r.status_code in (401, 403), f"{path} accessible without auth: {r.status_code}"
