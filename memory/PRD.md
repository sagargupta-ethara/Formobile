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

## Changelog — 2026-06-16
- **🔁 Migrated database PostgreSQL → MongoDB** (deployment requirement: Emergent
  production provides Atlas MongoDB only). Kept Prisma: `provider = "mongodb"`,
  `url = env("MONGO_URL")`; all ids are `String @id @default(cuid()) @map("_id")`
  so foreign keys stay plain strings (minimal query churn). Created `backend/.env`
  (fixes the original `read env file backend/.env` deploy error) and switched
  `/app/.env` from `DATABASE_URL` to `MONGO_URL`. Preview runs a single-node Mongo
  replica set on :27018 (Prisma's Mongo connector needs a replica set; prod Atlas
  already is one). Re-seeded 25 team members, 8 specializations, 70 master drawing
  categories. **All tests pass on Mongo: 44 audit + 15 iteration-2 + 5 reject-flow.**
  Deployment agent: PASS. Post-deploy notes: run `prisma db push` against Atlas to
  create unique indexes; disk uploads (`/app/storage`) are ephemeral → move to
  object storage for durable prod files.
- Drawing preview toolbar (zoom/pan/rotate/fit/open/download) in `DrawingReviewModal`.
- Test suite refactor (typed `api_helpers.py`, complexity reduced, `is None` fixed).

## Client change set — 2026-06-15 (all implemented + verified)
1. **ProjectStatus 6 → 5**: removed `DESIGN`; enum is now `PLANNING, ACTIVE,
   ON_HOLD, UPCOMING, COMPLETED`. Migrated DB (`prisma db push --accept-data-loss`,
   no existing DESIGN rows). API (`/api/projects` POST+PATCH) rejects `DESIGN`
   with 400; create/edit dropdowns + status tints updated. Verified via curl on
   both localhost:8001 and the external preview URL.
2. **Floor builder**: Stilt floor is now permanent (no toggle — shows an
   "always included" badge) and **Upper Ground removed everywhere**. Default
   builder = 4 above-ground + 1 basement + stilt + terrace = 7 floors. Verified
   in the New Project modal + a 7-floor project create.
3. **Rejected drawings hidden from DESIGNER**: `lib/access.ts` (`visibleFiles`
   + new `rejectedVersionSet`) now strips rejected versions for designers;
   `/api/tasks/[id]` filters the designer's `files[]`; `/api/files/[id]` returns
   403 to a designer for a rejected version. ADMIN keeps full history. Designer
   still sees reviewer comments/voice/photos. Verified end-to-end (5/5 asserts,
   `backend/tests/test_rejected_file_flow.py`).
4. **On-site approve/reject moved into a drawing-preview modal**: on
   `/projects/[id]` Building tab, ONSITE task cards now have ONLY an
   "Open Drawing" button (`data-testid=open-drawing-btn`). It opens
   `components/DrawingReviewModal.tsx` (`drawing-review-modal`) which previews
   the drawing in an iframe and holds Approve (`approve-btn`) / Reject
   (`reject-btn` → reason `reject-reason-input` + voice/photos →
   `confirm-reject-btn`). Verified live via screenshot + reject API.
5. **"+ New Project" button**: present for ADMIN on `/projects`
   (`data-testid=new-project-btn`), opens the create modal. Verified.

> Note: testing-agent iteration_2 reported false failures on #1/#3 plus a
> "persistence anomaly"; all three were disproven with live curl + psql + a
> full lifecycle test. The running build is correct.

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
