"""FastAPI proxy that forwards /api/* requests to the Next.js app on :3000.

The Emergent preview ingress routes /api/* to port 8001 (this service) and
all other paths to port 3000 (the Next.js app). Since the Blueprint Flow app
serves its API routes from Next.js itself, this thin proxy bridges the two.
"""
from __future__ import annotations

import os
import httpx
from fastapi import FastAPI, Request, Response
from fastapi.responses import StreamingResponse

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
