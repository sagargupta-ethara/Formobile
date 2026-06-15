"""Lifecycle test: rejected drawing must be hidden from the designer (change #3).
Admin assigns -> Designer uploads -> On-site (reviewer) rejects ->
Designer must NOT see/download the rejected version; Admin must still see it.
Run: python3 backend/tests/test_rejected_file_flow.py
"""
import io
import sys
import requests

BASE = "http://localhost:8001"
PW = "password123"
ADMIN = "manish.uppal@blueprintflow.in"
DESIGNER = "amarpreet.padam@blueprintflow.in"
ONSITE = "sudama@blueprintflow.in"


def login(email):
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    tok = r.cookies.get("bpf_session")
    assert tok, f"no session cookie for {email}"
    s = requests.Session()
    s.headers.update({"Cookie": f"bpf_session={tok}"})
    return s


def main():
    admin = login(ADMIN)
    designer = login(DESIGNER)
    onsite = login(ONSITE)

    designer_id = designer.get(f"{BASE}/api/auth/me").json()["user"]["id"]
    onsite_id = onsite.get(f"{BASE}/api/auth/me").json()["user"]["id"]

    # 1. create project with a floor
    code = "RJT-" + str(abs(hash("rjt")) % 99999)
    p = admin.post(f"{BASE}/api/projects", json={
        "name": "RejectFlow QA", "code": code, "status": "PLANNING",
        "floors": [{"name": "Ground Floor", "type": "FLOOR"}],
    })
    assert p.status_code == 201, p.text
    proj = p.json()["project"]
    pid = proj["id"]

    floors = admin.get(f"{BASE}/api/projects/{pid}/floors").json()["floors"]
    floor_id = floors[0]["id"]
    cats = admin.get(f"{BASE}/api/categories?projectId={pid}").json()["categories"]
    # pick a category that applies to FLOOR
    cat = next((c for c in cats if not c["appliesTo"] or "FLOOR" in c["appliesTo"]), cats[0])

    # 2. assign task: designer=amarpreet, reviewer=sudama
    t = admin.post(f"{BASE}/api/tasks", json={
        "projectId": pid, "floorId": floor_id, "categoryId": cat["id"],
        "designerIds": [designer_id], "reviewerId": onsite_id,
    })
    assert t.status_code == 201, t.text
    task_id = t.json()["task"]["id"]

    # 3. designer uploads a file (v1)
    files = {"file": ("plan_v1.pdf", io.BytesIO(b"%PDF-1.4 fake pdf v1"), "application/pdf")}
    u = designer.post(f"{BASE}/api/tasks/{task_id}/files", files=files)
    assert u.status_code in (200, 201), u.text

    # find the file id (as admin, who sees everything)
    tdetail = admin.get(f"{BASE}/api/tasks/{task_id}").json()["task"]
    v1 = next(f for f in tdetail["files"] if f["version"] == tdetail["currentVersion"])
    v1_id = v1["id"]

    # 4. on-site rejects v1 with a reason
    rej = onsite.post(f"{BASE}/api/tasks/{task_id}/reviews",
                      data={"decision": "REJECTED", "comments": "Wall thickness wrong, redo."})
    assert rej.status_code == 200, f"reject failed: {rej.status_code} {rej.text}"

    results = {}

    # 5. designer: GET task — rejected file must be absent from files[]
    dtask = designer.get(f"{BASE}/api/tasks/{task_id}").json()["task"]
    d_file_ids = [f["id"] for f in dtask["files"]]
    results["designer_files_excludes_rejected"] = v1_id not in d_file_ids
    # but review comments visible
    results["designer_sees_reject_comment"] = any(
        r["decision"] == "REJECTED" and r.get("comments") for r in dtask.get("reviews", [])
    )

    # 6. designer direct download of rejected version -> 403
    dd = designer.get(f"{BASE}/api/files/{v1_id}")
    results["designer_download_rejected_403"] = dd.status_code == 403

    # 7. admin still sees the rejected version (full history) -> 200
    ad = admin.get(f"{BASE}/api/files/{v1_id}")
    results["admin_download_rejected_200"] = ad.status_code == 200
    admin_task = admin.get(f"{BASE}/api/tasks/{task_id}").json()["task"]
    results["admin_files_include_rejected"] = v1_id in [f["id"] for f in admin_task["files"]]

    # cleanup
    admin.delete(f"{BASE}/api/projects/{pid}")

    print("RESULTS:")
    ok = True
    for k, v in results.items():
        print(f"  {'PASS' if v else 'FAIL'}  {k}")
        ok = ok and v
    print("ALL PASS" if ok else "SOME FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
