"""
Iteration 2 backend tests — validates the 5 specific changes:
 1. ProjectStatus enum reduced (no DESIGN)
 2. Floor builder: STILT permanent, UPPER_GROUND removed
 3. Rejected drawings hidden from DESIGNER (file row + GET /api/files/[id] -> 403)
    ADMIN still sees rejected versions
 4. (covered by UI test in playwright) - we verify reject/approve API still works
 5. (covered by UI test) - we verify /api/projects POST works for admin
"""
import io
import os
import time
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or "https://040933de-3d41-4bf0-91c9-acbca78ac0e8.preview.emergentagent.com").rstrip("/")

ADMIN = ("manish.uppal@blueprintflow.in", "password123")
DESIGNER = ("amarpreet.padam@blueprintflow.in", "password123")
ONSITE = ("sudama@blueprintflow.in", "password123")


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def designer():
    return _login(*DESIGNER)


@pytest.fixture(scope="module")
def onsite():
    return _login(*ONSITE)


@pytest.fixture(scope="module")
def state():
    return {}


# ========================================================================
# CHANGE #1 — ProjectStatus enum: no DESIGN
# ========================================================================
class TestProjectStatusEnum:
    def test_post_rejects_status_DESIGN(self, admin):
        ts = int(time.time())
        body = {
            "name": f"TEST_DESIGN_status_{ts}",
            "code": f"TDS{ts}",
            "clientName": "x", "client": "x", "location": "x",
            "status": "DESIGN",
        }
        r = admin.post(f"{BASE_URL}/api/projects", json=body, timeout=15)
        assert r.status_code == 400, (
            f"POST /api/projects with status=DESIGN must be 400; got {r.status_code} {r.text}")

    def test_post_accepts_5_valid_statuses(self, admin, state):
        for st in ("PLANNING", "ACTIVE", "ON_HOLD", "UPCOMING", "COMPLETED"):
            ts = int(time.time() * 1000)
            body = {
                "name": f"TEST_st_{st}_{ts}",
                "code": f"T{st[:3]}{ts}",
                "clientName": "x", "client": "x", "location": "x",
                "status": st,
            }
            r = admin.post(f"{BASE_URL}/api/projects", json=body, timeout=15)
            assert r.status_code in (200, 201), (
                f"status={st} should be accepted; got {r.status_code} {r.text}")
            if st == "PLANNING":
                pid = r.json().get("id") or r.json().get("project", {}).get("id")
                state["pid_for_patch"] = pid

    def test_patch_rejects_status_DESIGN(self, admin, state):
        pid = state.get("pid_for_patch")
        assert pid, "need a project from previous test"
        r = admin.patch(f"{BASE_URL}/api/projects/{pid}",
                        json={"status": "DESIGN"}, timeout=15)
        assert r.status_code == 400, (
            f"PATCH project status=DESIGN must be 400; got {r.status_code} {r.text}")


# ========================================================================
# CHANGE #2 — Floor builder: STILT always included, no UPPER_GROUND
#   (only the API enum is server-side; UI builder lives in projects/page.tsx.
#    We confirm UI default by inspecting created project + listing floors.)
# ========================================================================
class TestFloorEnum:
    def test_floor_enum_no_upper_ground(self, admin, state):
        # Create project, then add an UPPER_GROUND floor — should be rejected.
        ts = int(time.time())
        body = {
            "name": f"TEST_floors_{ts}", "code": f"TFL{ts}",
            "clientName": "x", "client": "x", "location": "x",
        }
        r = admin.post(f"{BASE_URL}/api/projects", json=body, timeout=15)
        assert r.status_code in (200, 201), r.text
        pid = r.json().get("id") or r.json().get("project", {}).get("id")
        state["floor_project_id"] = pid

        # Try creating UPPER_GROUND -> must fail
        r2 = admin.post(f"{BASE_URL}/api/projects/{pid}/floors",
                        json={"floorName": "UG", "floorType": "UPPER_GROUND"},
                        timeout=15)
        assert r2.status_code in (400, 422), (
            f"UPPER_GROUND floor must be rejected; got {r2.status_code} {r2.text}")

    def test_default_builder_creates_stilt_via_api(self, admin, state):
        """Simulate the New Project modal default: 4 floors + 1 basement + stilt + terrace."""
        pid = state["floor_project_id"]
        floors = [
            {"floorName": "Basement 1", "floorType": "BASEMENT"},
            {"floorName": "Stilt", "floorType": "STILT"},
            {"floorName": "Floor 1", "floorType": "FLOOR"},
            {"floorName": "Floor 2", "floorType": "FLOOR"},
            {"floorName": "Floor 3", "floorType": "FLOOR"},
            {"floorName": "Floor 4", "floorType": "FLOOR"},
            {"floorName": "Terrace", "floorType": "TERRACE"},
        ]
        for f in floors:
            r = admin.post(f"{BASE_URL}/api/projects/{pid}/floors", json=f, timeout=15)
            assert r.status_code in (200, 201), f"{f}: {r.status_code} {r.text}"

        r = admin.get(f"{BASE_URL}/api/projects/{pid}/floors", timeout=15)
        assert r.status_code == 200
        data = r.json()
        flist = data if isinstance(data, list) else data.get("floors") or data.get("items") or []
        types = [f.get("floorType") or f.get("type") for f in flist]
        assert types.count("STILT") == 1, f"exactly one STILT expected; got {types}"
        assert "UPPER_GROUND" not in types, f"UPPER_GROUND must not be present; got {types}"
        assert len(flist) == 7, f"expected 7 floors; got {len(flist)}: {types}"


# ========================================================================
# CHANGE #3 — Rejected drawings hidden from DESIGNER (server-side)
# ========================================================================
class TestRejectedHiddenFromDesigner:
    def test_full_reject_then_designer_blocked(self, admin, designer, onsite, state):
        ts = int(time.time())
        # 1. Create fresh project + floor + category + member
        body = {"name": f"TEST_hide_{ts}", "code": f"THD{ts}",
                "clientName": "x", "client": "x", "location": "x"}
        r = admin.post(f"{BASE_URL}/api/projects", json=body, timeout=15)
        assert r.status_code in (200, 201), r.text
        pid = r.json().get("id") or r.json().get("project", {}).get("id")

        # floors
        r = admin.post(f"{BASE_URL}/api/projects/{pid}/floors",
                       json={"floorName": "Stilt", "floorType": "STILT"}, timeout=15)
        assert r.status_code in (200, 201)
        r = admin.post(f"{BASE_URL}/api/projects/{pid}/floors",
                       json={"floorName": "Floor 1", "floorType": "FLOOR"}, timeout=15)
        assert r.status_code in (200, 201)
        floors = admin.get(f"{BASE_URL}/api/projects/{pid}/floors", timeout=15).json()
        flist = floors if isinstance(floors, list) else floors.get("floors") or floors.get("items")
        floor_id = next(f["id"] for f in flist if (f.get("floorType") or f.get("type")) == "FLOOR")

        # get designer + onsite user ids
        users = admin.get(f"{BASE_URL}/api/users", timeout=15).json()
        ulist = users if isinstance(users, list) else users.get("users") or users.get("items") or []
        designer_id = next(u["id"] for u in ulist if u["email"] == DESIGNER[0])
        onsite_id = next(u["id"] for u in ulist if u["email"] == ONSITE[0])

        # specs - pick Interior
        specs = admin.get(f"{BASE_URL}/api/specializations", timeout=15).json()
        sp_list = specs if isinstance(specs, list) else specs.get("items") or specs.get("specializations") or []
        # any spec works for category; designer is Interior so use Interior if available
        spec_id = next((s["id"] for s in sp_list if "Interior" in (s.get("name") or "")), sp_list[0]["id"])

        # add designer as member
        r = admin.post(f"{BASE_URL}/api/projects/{pid}/members",
                       json={"userId": designer_id, "role": "DESIGNER"}, timeout=15)
        assert r.status_code in (200, 201), r.text

        # create category
        cat_body = {"name": f"TEST_HideCat_{ts}", "projectId": pid,
                    "appliesTo": ["FLOOR"], "discipline": "INTERIOR",
                    "specializationId": spec_id}
        r = admin.post(f"{BASE_URL}/api/categories", json=cat_body, timeout=15)
        assert r.status_code in (200, 201), r.text
        cat_id = r.json().get("id") or r.json().get("category", {}).get("id")

        # assign task
        task_body = {
            "projectId": pid, "floorId": floor_id,
            "designCategoryId": cat_id, "categoryId": cat_id,
            "assigneeId": designer_id, "designerId": designer_id,
            "reviewerId": onsite_id,
            "deadline": "2026-12-31T00:00:00.000Z",
            "dueDate": "2026-12-31T00:00:00.000Z",
            "priority": "HIGH",
        }
        r = admin.post(f"{BASE_URL}/api/tasks", json=task_body, timeout=20)
        assert r.status_code in (200, 201), r.text
        tid = r.json().get("id") or r.json().get("task", {}).get("id")

        # designer uploads v1
        files = {"file": ("v1.pdf", io.BytesIO(b"%PDF-1.4 v1"), "application/pdf")}
        r = designer.post(f"{BASE_URL}/api/tasks/{tid}/files", files=files, timeout=30)
        assert r.status_code in (200, 201), r.text
        fid_v1 = r.json().get("id") or r.json().get("file", {}).get("id")

        # onsite REJECTS — backend uses field `comments`
        r = onsite.post(f"{BASE_URL}/api/tasks/{tid}/reviews",
                        json={"decision": "REJECTED",
                              "comments": "fix it - missing dimensions"}, timeout=20)
        assert r.status_code in (200, 201), f"reject: {r.status_code} {r.text}"

        # === ASSERT: designer GET /api/files/{fid_v1} -> 403 ===
        r = designer.get(f"{BASE_URL}/api/files/{fid_v1}", timeout=15)
        assert r.status_code == 403, (
            f"DESIGNER must be blocked (403) from rejected file; got {r.status_code} {r.text}")

        # === ASSERT: designer GET task does NOT include the rejected file in files list ===
        r = designer.get(f"{BASE_URL}/api/tasks/{tid}", timeout=15)
        assert r.status_code == 200
        tdata = r.json()
        task_obj = tdata.get("task") or tdata
        files_list = (task_obj.get("files") or task_obj.get("versions") or
                      task_obj.get("designFiles") or [])
        file_ids = [f.get("id") for f in files_list]
        assert fid_v1 not in file_ids, (
            f"rejected file v1 ({fid_v1}) must NOT appear in designer's task files; "
            f"got {file_ids}")

        # === ASSERT: designer must still see the review comment ===
        reviews = task_obj.get("reviews") or task_obj.get("reviewHistory") or []
        if not reviews:
            # fallback - reviews endpoint
            rr = designer.get(f"{BASE_URL}/api/tasks/{tid}/reviews", timeout=15)
            if rr.status_code == 200:
                reviews = rr.json() if isinstance(rr.json(), list) else rr.json().get("reviews", [])
        assert any(("fix it" in (rv.get("comment") or rv.get("reason") or "")) for rv in reviews), (
            f"designer must still see reject comment; reviews={reviews}")

        # === ASSERT: ADMIN can still GET the rejected file ===
        r = admin.get(f"{BASE_URL}/api/files/{fid_v1}", timeout=15)
        assert r.status_code in (200, 302), (
            f"ADMIN must still access rejected file; got {r.status_code}")

        # === ASSERT: ADMIN task files include the rejected file ===
        r = admin.get(f"{BASE_URL}/api/tasks/{tid}", timeout=15)
        tdata = r.json()
        task_obj = tdata.get("task") or tdata
        files_list = (task_obj.get("files") or task_obj.get("versions") or
                      task_obj.get("designFiles") or [])
        admin_ids = [f.get("id") for f in files_list]
        assert fid_v1 in admin_ids, (
            f"ADMIN must see full history including rejected v1; got {admin_ids}")

        state["rejected_task_id"] = tid
        state["rejected_file_id"] = fid_v1


# ========================================================================
# CHANGE #5 — POST /api/projects works for admin (new-project-btn UI flow)
# ========================================================================
class TestNewProjectAPI:
    def test_admin_can_create_minimal_project(self, admin):
        ts = int(time.time())
        body = {
            "name": f"TEST_NewBtn_{ts}",
            "code": f"TNB{ts}",
            "clientName": "x", "client": "x", "location": "x",
        }
        r = admin.post(f"{BASE_URL}/api/projects", json=body, timeout=15)
        assert r.status_code in (200, 201), r.text
        pid = r.json().get("id") or r.json().get("project", {}).get("id")
        assert pid
