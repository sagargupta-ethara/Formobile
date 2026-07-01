"""Auth regression tests — verify login returns JSON (not HTML) for all 3 roles,
session persists via cookie, /api/auth/me works, logout+re-login works, and
core landing endpoints return real JSON data (regression after backend
requirements.txt trim + WHISPER_LLM_KEY rename).

Bug context: In production the FastAPI proxy was down because the newly-added
requirements.txt pulled in `emergentintegrations` (heavy tree, needs extra
index). When backend is down, /api/* returns an HTML error page from ingress
instead of proxied JSON — hence the 'Unexpected token <' error client-side.
This suite verifies the PREVIEW environment is healthy.
"""
from __future__ import annotations

import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
PROJECT_ID = "cmqgcmd1s0000ig2lwj4tj5cs"

USERS = {
    "ADMIN":    ("manish.uppal@blueprintflow.in",   "password123"),
    "DESIGNER": ("amarpreet.padam@blueprintflow.in", "password123"),
    "ONSITE":   ("sudama@blueprintflow.in",         "password123"),
}


# ---------- shared helpers ----------
@pytest.fixture(scope="module")
def base_url() -> str:
    # Read from frontend/.env if the process env isn't set
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL missing")
    return BASE_URL


def _login(email: str, password: str) -> requests.Response:
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        headers={"Content-Type": "application/json"},
        timeout=30,
    )
    r.session = s  # attach for callers
    return r


# ---------- backend health ----------
class TestBackendHealth:
    def test_api_auth_me_unauth_returns_json(self):
        """A real /api route with no auth must return JSON (401), not an HTML
        ingress error page. This is the exact regression from prod: when the
        FastAPI proxy was down, /api/* returned HTML which broke JSON.parse."""
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=15)
        ct = r.headers.get("content-type", "").lower()
        assert "application/json" in ct, (
            f"/api/auth/me returned non-JSON ({r.status_code} {ct}): {r.text[:200]!r}"
        )
        # Should be unauthorized-ish, never a 5xx
        assert r.status_code < 500


# ---------- login for each role ----------
@pytest.mark.parametrize("role,creds", list(USERS.items()))
class TestLoginAllRoles:
    def test_login_returns_json(self, role, creds):
        email, pw = creds
        r = _login(email, pw)
        assert r.status_code == 200, f"{role} login {r.status_code}: {r.text[:300]}"

        ct = r.headers.get("content-type", "")
        assert "application/json" in ct.lower(), (
            f"{role} login returned non-JSON content-type: {ct} — body starts: {r.text[:120]!r}"
        )
        # Body must parse as JSON (this is exactly the client-side check that failed in prod)
        data = r.json()
        assert "user" in data, f"{role} response missing 'user': {data}"
        assert "token" in data, f"{role} response missing 'token' (mobile auth): {data}"
        assert data["user"]["email"].lower() == email.lower()
        assert isinstance(data["token"], str) and len(data["token"]) > 20

    def test_session_cookie_set_and_me_works(self, role, creds):
        email, pw = creds
        r = _login(email, pw)
        assert r.status_code == 200
        # httpOnly session cookie must be present (bpf_session per test_credentials.md)
        cookies = r.session.cookies.get_dict()
        assert "bpf_session" in cookies, f"{role} missing bpf_session cookie; got {cookies}"

        # /api/auth/me should identify the user via the cookie
        me = r.session.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert me.status_code == 200, f"{role} /me {me.status_code}: {me.text[:200]}"
        assert "application/json" in me.headers.get("content-type", "").lower()
        me_data = me.json()
        # accept both {user:{...}} and flat shapes
        me_user = me_data.get("user", me_data)
        assert me_user.get("email", "").lower() == email.lower()

    def test_bearer_token_also_works(self, role, creds):
        """Confirms mobile-style Bearer token auth on /api/auth/me (dual-auth)."""
        email, pw = creds
        r = _login(email, pw)
        token = r.json()["token"]
        # New session (no cookie) with only Bearer header
        s = requests.Session()
        me = s.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert me.status_code == 200, f"{role} bearer /me {me.status_code}: {me.text[:200]}"
        me_user = me.json().get("user", me.json())
        assert me_user.get("email", "").lower() == email.lower()


# ---------- logout then re-login ----------
class TestLogoutReLogin:
    def test_logout_then_relogin(self):
        email, pw = USERS["ADMIN"]
        r = _login(email, pw)
        assert r.status_code == 200
        s = r.session

        # Logout — most Next apps expose /api/auth/logout via POST
        logout = s.post(f"{BASE_URL}/api/auth/logout", timeout=15)
        assert logout.status_code in (200, 204), f"logout {logout.status_code}: {logout.text[:200]}"

        # /me must now be unauthorized (401/302/redirect JSON)
        me = s.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert me.status_code in (401, 403) or (
            me.status_code == 200 and (me.json().get("user") in (None, {}) or me.json() in ({}, None))
        ), f"expected unauth after logout, got {me.status_code} {me.text[:200]}"

        # Re-login (fresh session)
        r2 = _login(email, pw)
        assert r2.status_code == 200
        assert "application/json" in r2.headers.get("content-type", "").lower()
        assert r2.json()["user"]["email"].lower() == email.lower()


# ---------- regression: role landing endpoints all return JSON ----------
@pytest.mark.parametrize("role,creds", list(USERS.items()))
class TestRegressionLandingEndpoints:
    def _endpoints(self):
        return [
            "/api/projects",
            f"/api/projects/{PROJECT_ID}",
            "/api/notifications",
        ]

    def test_landing_endpoints_return_json(self, role, creds):
        email, pw = creds
        r = _login(email, pw)
        assert r.status_code == 200
        s = r.session

        for ep in self._endpoints():
            resp = s.get(f"{BASE_URL}{ep}", timeout=30)
            ct = resp.headers.get("content-type", "")
            # HTML would indicate the backend proxy died — the exact prod bug
            assert "text/html" not in ct.lower(), (
                f"{role} {ep} returned HTML ({resp.status_code}): {resp.text[:200]!r}"
            )
            assert resp.status_code < 500, (
                f"{role} {ep} 5xx: {resp.status_code} {resp.text[:200]}"
            )
            # Must be parseable JSON
            try:
                resp.json()
            except ValueError:
                pytest.fail(f"{role} {ep} not JSON: ct={ct} body={resp.text[:200]!r}")

    def test_tasks_endpoint_returns_json(self, role, creds):
        email, pw = creds
        r = _login(email, pw)
        s = r.session
        # Try both common shapes
        for ep in ("/api/tasks", "/api/reviews"):
            resp = s.get(f"{BASE_URL}{ep}", timeout=30)
            ct = resp.headers.get("content-type", "")
            if resp.status_code == 404:
                continue
            assert "text/html" not in ct.lower(), (
                f"{role} {ep} returned HTML ({resp.status_code})"
            )
            assert resp.status_code < 500
