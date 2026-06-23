"""
Iteration-3: Per-floor Drawing Register (floorIds[] on DesignCategory).

Covers backend changes:
 1) GET /api/categories?projectId=... returns floorIds[] populated for every drawing
 2) PATCH /api/categories/<id> updates per-floor membership
 3) POST /api/categories creates with floorIds (specific floor only)
 4) POST /api/projects/<id>/floors auto-adds new floor to matching drawings
 5) DELETE /api/floors/<id> pulls floor id from all drawings
"""
from __future__ import annotations

import time
from typing import Any

import pytest
import requests

from api_helpers import ADMIN, BASE_URL, login

TEST_PROJECT_ID = "cmqgcmd1s0000ig2lwj4tj5cs"

FLOOR_IDS = {
    "BASEMENT":     "cmqgcmd1s0001ig2lwejok2w3",
    "STILT":        "cmqgcmd1s0002ig2lp7tzuhwu",
    "GROUND_FLOOR": "cmqgcmd1s0003ig2l2tkl7eaz",
    "FIRST_FLOOR":  "cmqgcmd1s0004ig2l8pizaf5w",
    "SECOND_FLOOR": "cmqgcmd1s0005ig2lzoy04l7j",
    "THIRD_FLOOR":  "cmqgcmd1s0006ig2l3sxzoth6",
    "TERRACE":      "cmqgcmd1s0007ig2lhgv06rgv",
}


@pytest.fixture(scope="module")
def admin() -> requests.Session:
    return login(*ADMIN)


@pytest.fixture(scope="module")
def cats(admin: requests.Session) -> list[dict[str, Any]]:
    r = admin.get(f"{BASE_URL}/api/categories?projectId={TEST_PROJECT_ID}", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    items = data if isinstance(data, list) else data.get("categories") or data.get("items") or []
    return items


# ---------- 1) GET returns floorIds populated for all drawings ----------
class TestFloorIdsBackfill:
    def test_70_drawings_present(self, cats: list[dict[str, Any]]) -> None:
        assert len(cats) == 70, f"expected 70 drawings on Test project, got {len(cats)}"

    def test_every_drawing_has_floor_ids(self, cats: list[dict[str, Any]]) -> None:
        missing = [c for c in cats if not c.get("floorIds")]
        assert not missing, f"{len(missing)} drawings have empty floorIds: {[c.get('name') for c in missing[:5]]}"

    def test_floor_ids_are_valid(self, cats: list[dict[str, Any]]) -> None:
        valid = set(FLOOR_IDS.values())
        bad = []
        for c in cats:
            for fid in c.get("floorIds") or []:
                if fid not in valid:
                    bad.append((c.get("name"), fid))
        assert not bad, f"unknown floor ids referenced: {bad[:5]}"


# ---------- 2) PATCH per-floor membership ----------
class TestPatchFloorIds:
    def test_remove_one_floor_keeps_others(self, admin: requests.Session, cats: list[dict[str, Any]]) -> None:
        # Pick a drawing that has the Ground Floor + at least one other floor
        gf = FLOOR_IDS["GROUND_FLOOR"]
        target = next(
            (c for c in cats if gf in (c.get("floorIds") or []) and len(c["floorIds"]) >= 2),
            None,
        )
        assert target, "no drawing has Ground Floor + another floor"
        cid = target["id"]
        original = list(target["floorIds"])
        new_floors = [f for f in original if f != gf]

        # remove Ground Floor
        r = admin.patch(f"{BASE_URL}/api/categories/{cid}", json={"floorIds": new_floors}, timeout=20)
        assert r.status_code in (200, 204), r.text

        # verify
        r2 = admin.get(f"{BASE_URL}/api/categories?projectId={TEST_PROJECT_ID}", timeout=20)
        items = r2.json() if isinstance(r2.json(), list) else r2.json().get("categories", [])
        updated = next(c for c in items if c["id"] == cid)
        assert gf not in updated["floorIds"], "Ground Floor should have been removed"
        for f in new_floors:
            assert f in updated["floorIds"], f"floor {f} should still be present"

        # restore
        admin.patch(f"{BASE_URL}/api/categories/{cid}", json={"floorIds": original}, timeout=20)


# ---------- 3) POST creates with floorIds ----------
class TestPostWithFloorIds:
    def test_create_on_single_floor(self, admin: requests.Session) -> None:
        gf = FLOOR_IDS["GROUND_FLOOR"]
        ts = int(time.time())
        body = {
            "name": f"TEST_PerFloorCat_{ts}",
            "projectId": TEST_PROJECT_ID,
            "floorIds": [gf],
            "discipline": "INTERIOR",
        }
        r = admin.post(f"{BASE_URL}/api/categories", json=body, timeout=20)
        assert r.status_code in (200, 201), r.text
        cid = r.json().get("id") or r.json().get("category", {}).get("id")
        assert cid

        # verify via GET
        try:
            r2 = admin.get(f"{BASE_URL}/api/categories?projectId={TEST_PROJECT_ID}", timeout=20)
            items = r2.json() if isinstance(r2.json(), list) else r2.json().get("categories", [])
            created = next((c for c in items if c["id"] == cid), None)
            assert created, "newly created drawing not returned by GET"
            assert created["floorIds"] == [gf], f"floorIds should be [{gf}], got {created['floorIds']}"
        finally:
            admin.delete(f"{BASE_URL}/api/categories/{cid}", timeout=20)


# ---------- 4) New floor auto-populates with default drawings ----------
class TestFloorAutoPopulate:
    def test_new_floor_gets_default_drawings(self, admin: requests.Session) -> None:
        ts = int(time.time())
        # capture default-drawing count (drawings with empty appliesTo apply to ALL floors)
        r = admin.post(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/floors",
            json={"floorName": f"TEST_Floor_{ts}", "floorType": "FLOOR"},
            timeout=20,
        )
        assert r.status_code in (200, 201), r.text
        new_floor = r.json()
        new_floor_id = new_floor.get("id") or new_floor.get("floor", {}).get("id")
        assert new_floor_id

        try:
            # After creation, drawings whose appliesTo covers FLOOR should now include this id
            r2 = admin.get(f"{BASE_URL}/api/categories?projectId={TEST_PROJECT_ID}", timeout=20)
            items = r2.json() if isinstance(r2.json(), list) else r2.json().get("categories", [])
            covering = [c for c in items if new_floor_id in (c.get("floorIds") or [])]
            assert len(covering) > 0, (
                f"new floor {new_floor_id} not added to any drawing; expected ~master FLOOR drawings"
            )
            # Reasonably large — first-floor template usually has tens of drawings
            assert len(covering) >= 5, f"only {len(covering)} drawings auto-populated, expected several"
            print(f"new floor auto-populated with {len(covering)} drawings")
        finally:
            # Cleanup: DELETE the floor; this also exercises change #5
            rd = admin.delete(f"{BASE_URL}/api/floors/{new_floor_id}", timeout=20)
            assert rd.status_code in (200, 204), f"floor cleanup failed: {rd.status_code} {rd.text}"

            # Verify orphan-id cleanup: no drawing should still reference the deleted floor
            r3 = admin.get(f"{BASE_URL}/api/categories?projectId={TEST_PROJECT_ID}", timeout=20)
            items2 = r3.json() if isinstance(r3.json(), list) else r3.json().get("categories", [])
            orphans = [c for c in items2 if new_floor_id in (c.get("floorIds") or [])]
            assert not orphans, f"{len(orphans)} drawings still reference deleted floor {new_floor_id}"
