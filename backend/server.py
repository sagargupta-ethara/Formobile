"""FastAPI proxy that forwards /api/* requests to the Next.js app on :3000.

The Emergent preview ingress routes /api/* to port 8001 (this service) and
all other paths to port 3000 (the Next.js app). Since the Blueprint Flow app
serves its API routes from Next.js itself, this thin proxy bridges the two.
"""
from __future__ import annotations

import os
import tempfile
import httpx
from fastapi import FastAPI, Request, Response, UploadFile, File, HTTPException

try:  # optional in some runtimes; env vars may be injected directly
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # noqa: BLE001
    pass

NEXT_ORIGIN = os.environ.get("NEXT_ORIGIN", "http://127.0.0.1:3000")

app = FastAPI(title="Blueprint Flow API Proxy")

# A single shared client keeps connections warm.
client = httpx.AsyncClient(
    base_url=NEXT_ORIGIN,
    timeout=httpx.Timeout(120.0, connect=10.0),
    follow_redirects=False,
)

HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
    "content-encoding",
}


@app.on_event("shutdown")
async def _shutdown() -> None:
    await client.aclose()


@app.get("/healthz")
async def healthz() -> dict:
    return {"ok": True}


# Internal-only (localhost) Whisper transcription. The Next.js /api/transcribe
# route authenticates the user and forwards the audio here. Not exposed through
# the ingress (which only routes /api/* to this service), so it's server-to-server.
@app.post("/internal/transcribe")
async def transcribe(file: UploadFile = File(...)) -> dict:
    key = os.environ.get("WHISPER_LLM_KEY") or os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="Transcription not configured")
    try:
        from emergentintegrations.llm.openai import OpenAISpeechToText
    except Exception:  # library not available in this environment
        raise HTTPException(status_code=503, detail="Transcription unavailable")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio too large (max 25MB)")

    suffix = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        stt = OpenAISpeechToText(api_key=key)
        with open(tmp_path, "rb") as audio_file:
            resp = await stt.transcribe(
                file=audio_file, model="whisper-1", response_format="json"
            )
        return {"text": getattr(resp, "text", "") or ""}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Transcription failed: {e}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy(path: str, request: Request) -> Response:
    upstream_url = f"/api/{path}"
    if request.url.query:
        upstream_url = f"{upstream_url}?{request.url.query}"

    # Forward headers verbatim (minus hop-by-hop and Host).
    fwd_headers = {
        k: v for k, v in request.headers.items() if k.lower() not in HOP_BY_HOP
    }
    # Forward the original client IP for logs / rate limiting.
    client_ip = request.client.host if request.client else ""
    if client_ip:
        existing = fwd_headers.get("x-forwarded-for")
        fwd_headers["x-forwarded-for"] = (
            f"{existing}, {client_ip}" if existing else client_ip
        )

    body = await request.body()

    upstream = await client.request(
        request.method,
        upstream_url,
        content=body if body else None,
        headers=fwd_headers,
    )

    resp_headers = {
        k: v for k, v in upstream.headers.items() if k.lower() not in HOP_BY_HOP
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=resp_headers,
        media_type=upstream.headers.get("content-type"),
    )
