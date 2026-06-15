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
To keep the upstream repo unchanged at `/app`, we added thin shims:

- **`/app/frontend/package.json`** — `yarn start` execs `next start` from `/app` on port 3000.
- **`/app/backend/server.py`** — FastAPI proxy on port 8001 that forwards `/api/*` to
  `http://127.0.0.1:3000/api/*` via httpx. Hop-by-hop headers stripped, cookies +
  multipart/binary bodies preserved.
- **`/app/.env`** — `DATABASE_URL`, `JWT_SECRET`, `STORAGE_DIR=/app/storage`,
  `NODE_ENV=production`.

### Persistent Postgres on an ephemeral container
Only `/app` survives container restarts in this environment; everything in `/var`,
`/usr`, and the `postgres` OS user gets wiped. We solved this with a self-healing
bootstrap:

- **`/app/.platform/start-postgres.sh`** (run as the supervisor command) —
  reinstalls the postgres apt package if the binaries are missing, recreates the
  `postgres` OS user if missing, then runs `postgres` against a data directory at
  **`/app/.platform/pgdata`** (so the DB itself persists with the repo).
- **`/app/.platform/bootstrap-db.sh`** — idempotent supervisor program that waits
  for postgres, ensures the `bf` role and `blueprint_flow` database exist, and
  on a fresh data dir runs `yarn db:push`, `yarn db:seed`, then
  `npx tsx prisma/import-team.ts`.
- **`/etc/supervisor/conf.d/postgresql.conf`** — registers both programs with
  supervisor (postgres priority 10, db-bootstrap priority 15, `autorestart=false`).

DB: user `bf` / db `blueprint_flow` on `127.0.0.1:5432`.

## Personas (from imported app)
- **Admin** — projects, floors, categories, users, specializations, dashboards.
- **Designer** — uploads versioned drawings against assigned tasks.
- **On-Site** — reviews drawings routed by specialization; approve / reject + 24h SLA.

## What's been done (2026-06-15)
- Cloned repo already at `/app`; installed deps (`yarn install`), generated Prisma client.
- Provisioned local Postgres, ran `prisma db push` and `prisma db seed`
  (1 project "ABC Corporate Tower" + 7 floors + 5 demo tasks + drawing register).
- Imported the firm's real staff (`prisma/import-team.ts`) — 25 users; demo
  project + dummy demo users removed.
- Built production bundle (`yarn build`) and wired Next.js into the Emergent
  frontend supervisor slot via a shim.
- Wrote FastAPI `/api/*` proxy → Next.js, registered under the existing backend
  supervisor slot.
- Added self-healing Postgres supervisor program (re-installs the apt package,
  recreates the `postgres` OS user, persists data at `/app/.platform/pgdata`)
  + an idempotent `bootstrap-db.sh` that re-seeds an empty DB on cold start.
- End-to-end verified through the public preview URL: login + project list +
  Profile all render; the three Quick-login buttons all authenticate.

### Audit pass + RBAC fixes (2026-06-15)
Ran a backend audit (`/app/test_reports/iteration_1.json`) and patched all 5
high-priority defects it found:
- `GET /api/users` now requires ADMIN unless `assignable=1` or `role=` is set
  (designers were previously able to list the full team).
- `GET /api/files/[id]` for ONSITE — the dedicated reviewer no longer bypasses
  the "rejected version is hidden" rule (was a quiet RBAC bypass in the prior
  branch that exempted `task.reviewerId === user.id`).
- `GET /api/tasks` for ONSITE — spec-routed branch now restricted to
  `PENDING_REVIEW` / `REVISION_SUBMITTED`; `ASSIGNED` tasks no longer leak into
  the on-site review queue.
- `GET /api/auth/me` now re-reads the user from the DB (with
  `specialization`), so `specializationId` is always fresh and present.
- Added `app/api/specializations/[id]/route.ts` with `PATCH` (rename) and
  `DELETE` (with FK-in-use guard).
All 5 verified live via curl. Frontend Playwright pass was skipped to stay in
budget — backend coverage was 84% with the above as the only criticals.

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
