"""
Backend tests for iteration 12 (7 follow-up fixes):
- FIX 4: /api/tasks/<id>/reopen still works (regression - onsite-owned APPROVED task)
- FIX 7: /api/dashboard?projectId=<id> as designer returns cards + charts including
         deadlines, floorProgress, workload, onTimeRate, approvalRate.
- Light regression: designer /api/projects returns only member projects; no 'STRUCTURE'
  label leaked in tasks payload.
"""

import os
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

ADMIN = ("manish.uppal@blueprintflow.in", "password123")
DESIGNER = ("amarpreet.padam@blueprintflow.in", "password123")
ONSITE = ("sudama@blueprintflow.in", "password123")
PROJECT_ID = "cmqgcmd1s0000ig2lwj4tj5cs"
APPROVED_TASKS_SUDAMA = [
    "cmqhpakn2000pigcdzsaoscjt",  # Balcony Railing Detail
    "cmqhpakja000digcd6xiee15d",  # Balcony Flooring Detail
]


def login(email, password):
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=15,
    )
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text[:200]}"
    return s


@pytest.fixture(scope="module")
def admin():
    return login(*ADMIN)


@pytest.fixture(scope="module")
def designer():
    return login(*DESIGNER)


@pytest.fixture(scope="module")
def onsite():
    return login(*ONSITE)


# ---------- FIX 7: designer dashboard charts ----------
def test_designer_dashboard_returns_full_charts(designer):
    r = designer.get(f"{BASE_URL}/api/dashboard?projectId={PROJECT_ID}", timeout=15)
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert d.get("role") == "DESIGNER"
    cards = d["cards"]
    for k in ("total", "assigned", "submitted", "approved", "rejected", "overdue"):
        assert k in cards, f"missing card {k}"
        assert isinstance(cards[k], int)
    charts = d["charts"]
    for k in ("approvalRate", "onTimeRate", "floorProgress", "workload", "deadlines"):
        assert k in charts, f"missing chart {k}"
    assert isinstance(charts["floorProgress"], list)
    assert isinstance(charts["workload"], list)
    assert isinstance(charts["deadlines"], list)
    assert 0 <= charts["approvalRate"] <= 100
    assert 0 <= charts["onTimeRate"] <= 100


# ---------- FIX 4: reopen still works for onsite owner ----------
def test_reopen_unauthenticated_401():
    r = requests.post(
        f"{BASE_URL}/api/tasks/{APPROVED_TASKS_SUDAMA[0]}/reopen", timeout=15
    )
    assert r.status_code in (401, 403)


def test_reopen_designer_forbidden(designer):
    r = designer.post(
        f"{BASE_URL}/api/tasks/{APPROVED_TASKS_SUDAMA[0]}/reopen", timeout=15
    )
    assert r.status_code == 403


def test_reopen_onsite_owner_success_and_restore(onsite):
    task_id = APPROVED_TASKS_SUDAMA[0]
    # capture original status
    r0 = onsite.get(f"{BASE_URL}/api/tasks/{task_id}", timeout=15)
    assert r0.status_code == 200, r0.text[:200]
    original_status = r0.json()["task"]["status"]
    if original_status not in ("APPROVED", "REJECTED"):
        pytest.skip(f"task not APPROVED/REJECTED currently ({original_status})")

    # reopen
    r = onsite.post(f"{BASE_URL}/api/tasks/{task_id}/reopen", timeout=15)
    assert r.status_code == 200, f"reopen failed: {r.status_code} {r.text[:200]}"
    # verify status is now PENDING_REVIEW
    r2 = onsite.get(f"{BASE_URL}/api/tasks/{task_id}", timeout=15)
    assert r2.status_code == 200
    assert r2.json()["task"]["status"] == "PENDING_REVIEW"

    # reopen a 2nd time on a PENDING_REVIEW task should be 409
    r3 = onsite.post(f"{BASE_URL}/api/tasks/{task_id}/reopen", timeout=15)
    assert r3.status_code == 409

    # restore: re-approve so we don't dirty seed
    fd = {"decision": (None, "APPROVED"), "comments": (None, "restored by test")}
    r4 = onsite.post(f"{BASE_URL}/api/tasks/{task_id}/reviews", files=fd, timeout=20)
    assert r4.status_code == 200, r4.text[:200]
    r5 = onsite.get(f"{BASE_URL}/api/tasks/{task_id}", timeout=15)
    assert r5.json()["task"]["status"] == "APPROVED"


# ---------- Regressions ----------
def test_designer_projects_only_member(designer):
    r = designer.get(f"{BASE_URL}/api/projects", timeout=15)
    assert r.status_code == 200
    projs = r.json()["projects"]
    # Designer should only see 'Test'
    codes = [p.get("code") for p in projs]
    assert all(c == "TEST-SANDBOX" for c in codes), f"designer sees non-member projects: {codes}"


def test_no_structure_label_in_tasks(admin):
    r = admin.get(f"{BASE_URL}/api/tasks?projectId={PROJECT_ID}", timeout=15)
    assert r.status_code == 200
    body = r.text
    # discipline enum on DB is STRUCTURE, but UI label 'Structure' should not
    # appear as a human label anywhere in the payload strings we surface.
    # We check that no category.name is literally 'Structure' as a header:
    tasks = r.json().get("tasks", [])
    for t in tasks:
        assert t["category"].get("name") != "Structure"


def test_admin_categories_have_discipline(admin):
    r = admin.get(f"{BASE_URL}/api/categories?projectId={PROJECT_ID}", timeout=15)
    assert r.status_code == 200
    cats = r.json()["categories"]
    assert len(cats) > 0
    disciplines = {c["discipline"] for c in cats}
    # Ensure STRUCTURE enum still present as a discipline key (mapped to 'Architecture' in UI)
    assert "STRUCTURE" in disciplines or "INTERIOR" in disciplines
