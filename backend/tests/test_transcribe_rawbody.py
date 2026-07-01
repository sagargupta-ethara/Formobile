"""Verify the new raw-body /api/transcribe path (no python-multipart).

The fix rewrote /internal/transcribe to read `await request.body()` instead of
FastAPI's File()/UploadFile so the backend has zero python-multipart
dependency at import time — which was the true reason the prod container
crashed at startup.

We validate two things here:
  1. The backend FastAPI proxy is up (never returns HTML/502).
  2. POST /api/transcribe (authenticated) accepts raw audio bytes and forwards
     them through the Next.js route to /internal/transcribe. We don't need a
     real audio file — a tiny valid WEBM/OGG-ish blob is enough to prove the
     request-body path is wired (Whisper may reject the content, which is a
     502 with a specific JSON detail; either 200 with {text} or 502 with a
     JSON error body is acceptable proof the raw-body path works. HTML would
     be a failure.).
"""
from __future__ import annotations

import os
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

ADMIN = {"email": "manish.uppal@blueprintflow.in", "password": "password123"}


def _login() -> requests.Session:
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("application/json")
    tok = r.json().get("token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    return s


class TestTranscribeRawBody:
    """Validate the multipart-free /api/transcribe path."""

    def test_transcribe_empty_body_returns_json_400(self):
        s = _login()
        r = s.post(
            f"{BASE_URL}/api/transcribe",
            data=b"",
            headers={
                "Content-Type": "application/octet-stream",
                "x-audio-filename": "empty.webm",
            },
            timeout=30,
        )
        # Must be JSON — the whole point of the fix
        assert r.headers.get("content-type", "").startswith("application/json"), (
            f"Expected JSON, got {r.headers.get('content-type')} body={r.text[:200]}"
        )
        # Any non-2xx is fine as long as body is JSON, never HTML, never 502.
        assert r.status_code != 200, r.text
        assert r.status_code != 502, r.text
        assert not r.text.lstrip().startswith("<"), r.text[:200]

    def test_transcribe_small_blob_returns_json(self):
        s = _login()
        # Tiny bytes — Whisper will likely 502 with a JSON error, or 200 with
        # empty text; either way the response MUST be JSON, proving the
        # raw-body proxy path works end-to-end.
        blob = b"\x1a\x45\xdf\xa3" + b"\x00" * 128  # EBML header prefix
        r = s.post(
            f"{BASE_URL}/api/transcribe",
            data=blob,
            headers={
                "Content-Type": "application/octet-stream",
                "x-audio-filename": "tiny.webm",
            },
            timeout=60,
        )
        ct = r.headers.get("content-type", "")
        assert ct.startswith("application/json"), (
            f"Expected JSON, got {ct} body={r.text[:200]}"
        )
        # Not the pre-fix 502-with-HTML crash and not a Next 500 HTML page.
        assert r.status_code != 502 or "text/html" not in ct, r.text[:200]

    def test_transcribe_requires_auth(self):
        # No session — must be 401 JSON, not HTML
        r = requests.post(
            f"{BASE_URL}/api/transcribe",
            data=b"x",
            headers={"Content-Type": "application/octet-stream"},
            timeout=30,
        )
        assert r.headers.get("content-type", "").startswith("application/json"), r.text[:200]
        assert r.status_code in (401, 403), r.status_code


class TestBackendNever502Html:
    """The bug the user reported: /api/* returned HTML instead of JSON. Guard."""

    def test_all_probed_endpoints_return_json(self):
        endpoints = [
            "/api/auth/me",
            "/api/projects",
            "/api/notifications",
            "/api/tasks",
        ]
        for ep in endpoints:
            r = requests.get(f"{BASE_URL}{ep}", timeout=30)
            ct = r.headers.get("content-type", "")
            assert ct.startswith("application/json"), (
                f"{ep} returned {ct} (status={r.status_code}) body={r.text[:120]}"
            )
            # Explicitly NOT the failure signature
            assert not r.text.lstrip().startswith("<"), (
                f"{ep} returned HTML instead of JSON — bug regression!"
            )
