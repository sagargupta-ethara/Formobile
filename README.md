# Blueprint Flow

A **Design Collaboration & Site Execution Management Platform** — design teams upload
drawings against assigned tasks, on-site teams review/approve/reject with accountability,
deadlines, SLA timers, and an immutable audit trail.

Built as a unified **Next.js 15 (App Router) + PostgreSQL (Prisma)** app. The same
`/api/*` REST endpoints back the web UI and can back future Android/iOS apps.

## Stack
- **Next.js 15** (App Router, React 19) — UI + REST API routes
- **PostgreSQL 16** via **Prisma** ORM
- **Auth**: JWT in an httpOnly cookie + role-based access control (Admin / Designer / On-Site)
- **Storage**: local disk under `./storage` (swap for S3 in production)

## Running locally

Requires Node ≥ 20 and a local PostgreSQL on `localhost:5432`.

```bash
npm install
createdb blueprint_flow            # one-time
npm run db:push                    # create tables
npm run db:seed                    # demo data + accounts
npm run dev                        # http://localhost:3000
```

Config lives in `.env` (`DATABASE_URL`, `JWT_SECRET`, `STORAGE_DIR`).

## Demo accounts (password: `password123`)
| Role        | Email                     |
|-------------|---------------------------|
| Admin       | admin@blueprint.test      |
| Designer    | designer@blueprint.test   |
| On-Site     | onsite@blueprint.test     |

## Roles & what they do
- **Admin** — create projects, floors, categories, users/specializations; assign design
  tasks with deadlines & priority; monitor dashboards.
- **Designer** — see assigned tasks, upload designs (versioned), upload revisions after
  rejection, track deadlines.
- **On-Site** — review designs routed to their specialization, approve, or reject with a
  mandatory reason; 24h review SLA countdown.

## Key workflow rule
When a design is **rejected**, the old (rejected) version is **immediately hidden from the
on-site reviewer** — at both the API and file-download layers. It reappears only when the
designer uploads a **new** version, and the reviewer only ever sees the **current** version.
Admins and designers retain the full version history. (See `lib/access.ts`.)

Task lifecycle: `ASSIGNED → PENDING_REVIEW → APPROVED | REJECTED → REVISION_SUBMITTED → …`

## Project layout
```
app/
  (app)/            authenticated UI (dashboard, projects, tasks, users, settings)
  api/              REST endpoints (auth, users, projects, floors, tasks, files, reviews, dashboard)
  login/            login page
components/          Shell, UI primitives, AssignTaskModal
lib/                auth, db, api helpers, rbac/access rules, storage, audit, formatting
prisma/             schema.prisma + seed.ts
storage/            uploaded design files (git-ignored)
```

## Implemented (Phase 1 — core vertical slice)
Auth + RBAC · Projects/Floors/Categories/Specializations · Task assignment engine ·
Versioned uploads · Specialization-based review routing · Approve/Reject + revision loop ·
24h review SLA countdown · Role-aware dashboards · Audit logging.

## Phase 2 (planned)
Voice-note rejection memos · email/push notifications · escalation engine · site photos ·
drawing markup/annotation · client & vendor portals · offline mobile mode.
