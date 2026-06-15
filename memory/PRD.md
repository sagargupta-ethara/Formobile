# Blueprint Flow — PRD

## Original Problem Statement
Clone https://github.com/sagargupta-ethara/architecture-application into Emergent
and proceed with further development on the platform. The repo (already connected)
is "Blueprint Flow" — a Design Collaboration & Site Execution Management Platform
built as a Next.js 15 + PostgreSQL (Prisma) full-stack app.

## Architecture (as imported)
- **Framework**: Next.js 15 (App Router, React 19) — UI + REST `/api/*` in one app
- **DB**: PostgreSQL 16 via Prisma ORM
- **Auth**: JWT in httpOnly cookie (`bpf_session`) + role-based access (Admin / Designer / On-Site)
- **Storage**: local disk under `/app/storage` (swap for S3 in production)

## Emergent platform adaptation (done in this session)
The platform ingress routes `/api/*` → port 8001 and everything else → port 3000,
while supervisor expects `/app/backend` (uvicorn) + `/app/frontend` (yarn start).
To keep the upstream repo unchanged at `/app`, we added two thin shims:

- **`/app/frontend/package.json`** — `yarn start` execs `next start` from `/app` on port 3000.
- **`/app/backend/server.py`** — FastAPI proxy on port 8001 that forwards `/api/*` to
  `http://127.0.0.1:3000/api/*` via httpx. Hop-by-hop headers stripped, cookies +
  multipart/binary bodies preserved.
- **`/etc/supervisor/conf.d/postgresql.conf`** — autostart Postgres 15 alongside
  backend/frontend.
- **`/app/.env`** — `DATABASE_URL`, `JWT_SECRET`, `STORAGE_DIR=/app/storage`,
  `NODE_ENV=production`.

DB: user `bf` / db `blueprint_flow` on `localhost:5432`.

## Personas (from imported app)
- **Admin** — projects, floors, categories, users, specializations, dashboards.
- **Designer** — uploads versioned drawings against assigned tasks.
- **On-Site** — reviews drawings routed by specialization; approve / reject + 24h SLA.

## What's been done (2026-06-15)
- Cloned repo already at `/app`; installed deps (`yarn install`), generated Prisma client.
- Provisioned local Postgres, ran `prisma db push` and `prisma db seed`
  (1 project "ABC Corporate Tower" + 7 floors + 5 demo tasks + drawing register).
- Built production bundle (`yarn build`) and wired Next.js into the Emergent
  frontend supervisor slot via a shim.
- Wrote FastAPI `/api/*` proxy → Next.js, registered under the existing backend
  supervisor slot.
- End-to-end verified through the public preview URL:
  - `GET /login` → 200, login screen renders correctly.
  - `POST /api/auth/login` → 200 with `bpf_session` cookie.
  - Browser login flow lands on `/projects` and shows seeded data.

## Status
**Imported, running, and reachable via the preview URL.** Awaiting next user
instruction (feature work, bug fix, or deployment hardening).

## Backlog (from repo README — Phase 2)
- P1: Voice-note rejection memos UI polish
- P1: Email / push notifications + escalation engine
- P2: Site photos, drawing markup/annotation
- P2: Client & vendor portals
- P2: Offline mobile mode

## Next tasks (Emergent-specific suggestions, not started)
- Decide on persistent object storage (S3-compatible) for `/app/storage` if you
  plan to deploy — local disk is ephemeral on most container hosts.
- Consider running `next dev` in supervisor instead of `next start` if you want
  hot reload on `/app/**` while iterating in Emergent.
- Add `prisma migrate` workflow if schema changes are coming.
