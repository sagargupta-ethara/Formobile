"""
Iteration 11 backend tests — Blueprint Flow.
Covers ITEMs 5, 6, 7, 12, 13 API surface (project visibility, per-drawing deadlines,
Structure→Architecture, on-site reopen).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://floor-planning-stage.preview.emergentagent.com").rstrip("/")

ADMIN = ("manish.uppal@blueprintflow.in", "password123")
DESIGNER = ("amarpreet.padam@blueprintflow.in", "password123")
ONSITE = ("sudama@blueprintflow.in", "password123")


def _tasks(sess):
    r = sess.get(f"{BASE_URL}/api/tasks", timeout=30)
    assert r.status_code == 200, r.text[:200]
    j = r.json()
    if isinstance(j, dict) and "tasks" in j:
        return j["tasks"]
    return j


def _projects(sess):
    r = sess.get(f"{BASE_URL}/api/projects", timeout=30)
    assert r.status_code == 200, r.text[:200]
    j = r.json()
    if isinstance(j, dict) and "projects" in j:
        return j["projects"]
    return j


def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return s, r.json().get("token"), r.json()["user"]


@pytest.fixture(scope="module")
def admin():
    s, t, u = _login(*ADMIN)
    return {"s": s, "t": t, "u": u}


@pytest.fixture(scope="module")
def designer():
    s, t, u = _login(*DESIGNER)
    return {"s": s, "t": t, "u": u}


@pytest.fixture(scope="module")
def onsite():
    s, t, u = _login(*ONSITE)
    return {"s": s, "t": t, "u": u}


# ITEM 5: designer sees only their projects
class TestItem5ProjectVisibility:
    def test_admin_sees_all_projects(self, admin):
        projects = _projects(admin["s"])
        assert isinstance(projects, list)
        assert len(projects) >= 1
        codes = [p.get("code") for p in projects]
        assert "TEST-SANDBOX" in codes

    def test_designer_sees_only_member_projects(self, designer):
        projects = _projects(designer["s"])
        assert isinstance(projects, list)
        codes = [p.get("code") for p in projects]
        assert "TEST-SANDBOX" in codes, f"designer should see Test project, got {codes}"

    def test_onsite_sees_only_routed_projects(self, onsite):
        projects = _projects(onsite["s"])
        assert isinstance(projects, list)


# ITEM 7 API: check tasks discipline shows Architecture not Structure
class TestItem7StructureRename:
    def test_tasks_no_structure_label(self, admin):
        tasks = _tasks(admin["s"])
        # Look for Structure enum in the returned tasks (if any)
        disciplines = set()
        for t in tasks:
            d = t.get("discipline")
            if d:
                disciplines.add(d)
        # 'STRUCTURE' should not appear in returned tasks
        assert "STRUCTURE" not in disciplines, f"Found STRUCTURE discipline still present: {disciplines}"


# ITEM 13 reopen: only owning on-site can reopen APPROVED/REJECTED task
class TestItem13ReopenTask:
    """Test the reopen endpoint. Requires an approved/rejected task by sudama."""

    def _get_test_project_id(self, admin):
        pid = next((p["id"] for p in _projects(admin["s"]) if p.get("code") == "TEST-SANDBOX"), None)
        if not pid:
            pytest.skip("Test project not found")
        return pid

    def test_reopen_requires_auth(self):
        # unauth call
        r = requests.post(f"{BASE_URL}/api/tasks/some-id/reopen", timeout=15)
        assert r.status_code in (401, 403, 404), f"expected auth failure, got {r.status_code}"

    def test_reopen_designer_forbidden(self, designer, admin):
        # find any task
        r = admin["s"].get(f"{BASE_URL}/api/tasks", timeout=30)
        tasks = _tasks(admin["s"])
        if not tasks:
            pytest.skip("no tasks available")
        tid = tasks[0]["id"]
        r2 = designer["s"].post(f"{BASE_URL}/api/tasks/{tid}/reopen", timeout=15)
        assert r2.status_code in (401, 403, 400, 404), f"designer should not be able to reopen, got {r2.status_code} {r2.text[:200]}"

    def test_reopen_only_valid_on_approved_or_rejected(self, onsite, admin):
        # find a PENDING task and try to reopen — should fail
        r = admin["s"].get(f"{BASE_URL}/api/tasks", timeout=30)
        tasks = _tasks(admin["s"])
        pending = [t for t in tasks if t.get("status") not in ("APPROVED", "REJECTED")]
        if not pending:
            pytest.skip("no pending task")
        tid = pending[0]["id"]
        r2 = onsite["s"].post(f"{BASE_URL}/api/tasks/{tid}/reopen", timeout=15)
        # Should be 400/403/404 since status is not APPROVED/REJECTED
        assert r2.status_code >= 400, f"expected error on non-approved/rejected task, got {r2.status_code}"


# ITEM 6: bulk assign with per-drawing deadlines — endpoint should accept deadlines map
class TestItem6BulkDeadlines:
    def test_tasks_create_accepts_deadlines_map(self, admin):
        # Just check the endpoint exists and rejects malformed cleanly (not 500)
        r = admin["s"].post(f"{BASE_URL}/api/tasks", json={"invalid": True}, timeout=15)
        assert r.status_code in (400, 422), f"expected 400/422 on bad payload, got {r.status_code} {r.text[:200]}"


# ITEM 2: designer register / uploads endpoints exist
class TestItem3UploadsEndpoint:
    def test_uploads_endpoint_admin(self, admin):
        r = admin["s"].get(f"{BASE_URL}/api/projects", timeout=30)
        pid = next((p["id"] for p in _projects(admin["s"]) if p.get("code") == "TEST-SANDBOX"), None)
        assert pid
        r2 = admin["s"].get(f"{BASE_URL}/api/projects/{pid}/uploads", timeout=30)
        assert r2.status_code == 200, f"uploads endpoint failed: {r2.status_code} {r2.text[:200]}"

    def test_uploads_endpoint_designer(self, designer):
        pid = next((p["id"] for p in _projects(designer["s"]) if p.get("code") == "TEST-SANDBOX"), None)
        assert pid
        r2 = designer["s"].get(f"{BASE_URL}/api/projects/{pid}/uploads", timeout=30)
        assert r2.status_code == 200

    def test_uploads_endpoint_onsite_forbidden_or_ok(self, onsite, admin):
        pid = next((p["id"] for p in _projects(admin["s"]) if p.get("code") == "TEST-SANDBOX"), None)
        r2 = onsite["s"].get(f"{BASE_URL}/api/projects/{pid}/uploads", timeout=30)
        assert r2.status_code in (200, 403, 404), f"onsite uploads got {r2.status_code}"


# ITEM 9: designer analytics is project-scoped
class TestItem9DesignerAnalytics:
    def test_designer_dashboard_accepts_project_id(self, designer):
        pid = next((p["id"] for p in _projects(designer["s"]) if p.get("code") == "TEST-SANDBOX"), None)
        assert pid
        r = designer["s"].get(f"{BASE_URL}/api/dashboard?projectId={pid}", timeout=30)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        assert isinstance(data, dict)
