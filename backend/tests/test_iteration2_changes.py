"""Iteration 2 backend tests — validates the 5 specific changes:
 1. ProjectStatus enum reduced (no DESIGN)
 2. Floor builder: STILT permanent, UPPER_GROUND removed
 3. Rejected drawings hidden from DESIGNER (file row + GET /api/files/[id] -> 403)
    ADMIN still sees rejected versions
 4. (covered by UI test in playwright) - reject/approve API still works
 5. POST /api/projects works for admin (new-project-btn UI flow)

The heavy reject scenario is built once in a module fixture so each assertion
stays a tiny, low-complexity test.
"""
from __future__ import annotations

import pytest
import requests

from api_helpers import (
    ADMIN,
    BASE_URL,
    DESIGNER,
    ONSITE,
    TIMEOUT,
    add_floor,
    build_reject_scenario,
    create_project,
    file_status,
    floor_type,
    get_task,
    list_floors,
    login,
    review_text,
    task_file_ids,
    task_reviews,
    unique_suffix,
)


@pytest.fixture(scope="module")
def admin() -> requests.Session:
    return login(*ADMIN)


@pytest.fixture(scope="module")
def designer() -> requests.Session:
    return login(*DESIGNER)


@pytest.fixture(scope="module")
def onsite() -> requests.Session:
    return login(*ONSITE)


# ========================================================================
# CHANGE #1 — ProjectStatus enum: no DESIGN
# ========================================================================
class TestProjectStatusEnum:
    def test_post_rejects_status_design(self, admin: requests.Session) -> None:
        sfx = unique_suffix()
        body = {
            "name": f"TEST_DESIGN_status_{sfx}",
            "code": f"TDS{sfx}",
            "clientName": "x",
            "client": "x",
            "location": "x",
            "status": "DESIGN",
        }
        resp = admin.post(f"{BASE_URL}/api/projects", json=body, timeout=TIMEOUT)
        assert resp.status_code == 400, (
            f"POST status=DESIGN must be 400; got {resp.status_code} {resp.text}"
        )

    @pytest.mark.parametrize("status", ["PLANNING", "ACTIVE", "ON_HOLD", "UPCOMING", "COMPLETED"])
    def test_post_accepts_valid_status(self, admin: requests.Session, status: str) -> None:
        sfx = unique_suffix()
        pid = create_project(admin, f"TEST_st_{status}_{sfx}", f"T{status[:3]}{sfx}", status=status)
        assert pid

    def test_patch_rejects_status_design(self, admin: requests.Session) -> None:
        sfx = unique_suffix()
        pid = create_project(admin, f"TEST_patch_{sfx}", f"TPA{sfx}", status="PLANNING")
        resp = admin.patch(f"{BASE_URL}/api/projects/{pid}", json={"status": "DESIGN"}, timeout=TIMEOUT)
        assert resp.status_code == 400, (
            f"PATCH status=DESIGN must be 400; got {resp.status_code} {resp.text}"
        )


# ========================================================================
# CHANGE #2 — Floor builder: STILT always included, no UPPER_GROUND
# ========================================================================
class TestFloorEnum:
    def test_floor_enum_rejects_upper_ground(self, admin: requests.Session) -> None:
        sfx = unique_suffix()
        pid = create_project(admin, f"TEST_floors_{sfx}", f"TFL{sfx}")
        resp = add_floor(admin, pid, "UG", "UPPER_GROUND")
        assert resp.status_code in (400, 422), (
            f"UPPER_GROUND floor must be rejected; got {resp.status_code} {resp.text}"
        )

    def test_default_builder_creates_stilt(self, admin: requests.Session) -> None:
        """Default New-Project modal: 1 basement + stilt + 4 floors + terrace = 7."""
        sfx = unique_suffix()
        pid = create_project(admin, f"TEST_default_{sfx}", f"TDF{sfx}")
        default_floors: list[tuple[str, str]] = [
            ("Basement 1", "BASEMENT"),
            ("Stilt", "STILT"),
            ("Floor 1", "FLOOR"),
            ("Floor 2", "FLOOR"),
            ("Floor 3", "FLOOR"),
            ("Floor 4", "FLOOR"),
            ("Terrace", "TERRACE"),
        ]
        for name, ftype in default_floors:
            assert add_floor(admin, pid, name, ftype).status_code in (200, 201)

        types = [floor_type(f) for f in list_floors(admin, pid)]
        assert types.count("STILT") == 1, f"exactly one STILT expected; got {types}"
        assert "UPPER_GROUND" not in types, f"UPPER_GROUND must not be present; got {types}"
        assert len(types) == 7, f"expected 7 floors; got {len(types)}: {types}"


# ========================================================================
# CHANGE #3 — Rejected drawings hidden from DESIGNER (server-side)
# ========================================================================
@pytest.fixture(scope="module")
def reject_scenario(
    admin: requests.Session, designer: requests.Session, onsite: requests.Session
) -> dict[str, str]:
    return build_reject_scenario(admin, designer, onsite)


class TestRejectedHiddenFromDesigner:
    def test_designer_blocked_from_rejected_file(
        self, designer: requests.Session, reject_scenario: dict[str, str]
    ) -> None:
        status = file_status(designer, reject_scenario["file_id"])
        assert status == 403, f"DESIGNER must be blocked (403) from rejected file; got {status}"

    def test_designer_task_excludes_rejected_file(
        self, designer: requests.Session, reject_scenario: dict[str, str]
    ) -> None:
        ids = task_file_ids(get_task(designer, reject_scenario["task_id"]))
        assert reject_scenario["file_id"] not in ids, (
            f"rejected file must NOT appear in designer's files; got {ids}"
        )

    def test_designer_sees_reject_comment(
        self, designer: requests.Session, reject_scenario: dict[str, str]
    ) -> None:
        reviews = task_reviews(designer, reject_scenario["task_id"])
        assert any("fix it" in review_text(rv) for rv in reviews), (
            f"designer must still see the reject comment; reviews={reviews}"
        )

    def test_admin_can_access_rejected_file(
        self, admin: requests.Session, reject_scenario: dict[str, str]
    ) -> None:
        status = file_status(admin, reject_scenario["file_id"])
        assert status in (200, 302), f"ADMIN must still access rejected file; got {status}"

    def test_admin_task_includes_rejected_file(
        self, admin: requests.Session, reject_scenario: dict[str, str]
    ) -> None:
        ids = task_file_ids(get_task(admin, reject_scenario["task_id"]))
        assert reject_scenario["file_id"] in ids, (
            f"ADMIN must see full history including rejected v1; got {ids}"
        )


# ========================================================================
# CHANGE #5 — POST /api/projects works for admin (new-project-btn UI flow)
# ========================================================================
class TestNewProjectAPI:
    def test_admin_can_create_minimal_project(self, admin: requests.Session) -> None:
        sfx = unique_suffix()
        pid = create_project(admin, f"TEST_NewBtn_{sfx}", f"TNB{sfx}")
        assert pid
