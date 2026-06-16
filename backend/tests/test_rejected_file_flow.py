"""Lifecycle check: a rejected drawing must be hidden from the designer.

Admin assigns -> Designer uploads -> On-site rejects -> the designer must not
see/download the rejected version, while the admin keeps the full history.

Run as a script:  python3 backend/tests/test_rejected_file_flow.py
The reusable steps live in ``api_helpers`` so this stays small and linear.
"""
from __future__ import annotations

import sys

from api_helpers import (
    ADMIN,
    DESIGNER,
    ONSITE,
    build_reject_scenario,
    delete_project,
    file_status,
    get_task,
    login,
    review_text,
    task_file_ids,
    task_reviews,
)


def evaluate(designer, admin, tid: str, fid: str) -> dict[str, bool]:
    """Return each visibility rule as a pass/fail boolean."""
    return {
        "designer_files_excludes_rejected": fid not in task_file_ids(get_task(designer, tid)),
        "designer_sees_reject_comment": any(
            "fix it" in review_text(rv) for rv in task_reviews(designer, tid)
        ),
        "designer_download_rejected_403": file_status(designer, fid) == 403,
        "admin_download_rejected_200": file_status(admin, fid) in (200, 302),
        "admin_files_include_rejected": fid in task_file_ids(get_task(admin, tid)),
    }


def run() -> bool:
    admin = login(*ADMIN)
    designer = login(*DESIGNER)
    onsite = login(*ONSITE)

    scenario = build_reject_scenario(admin, designer, onsite)
    results = evaluate(designer, admin, scenario["task_id"], scenario["file_id"])
    delete_project(admin, scenario["project_id"])

    print("RESULTS:")
    for name, passed in results.items():
        print(f"  {'PASS' if passed else 'FAIL'}  {name}")
    ok = all(results.values())
    print("ALL PASS" if ok else "SOME FAILED")
    return ok


if __name__ == "__main__":
    sys.exit(0 if run() else 1)
