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
- **🛠 Preview login fix (Mongo persistence):** a container restart wiped the
  ephemeral `/data/db-rs` holding the preview's Mongo replica set, so logins 500'd.
  Moved RS data to the persistent `/app/.platform/mongo-rs-data` volume and added a
  self-initializing startup script (`/app/.platform/start-mongo-rs.sh`, wired via
  `mongodb-rs.conf`) that recreates the dir + re-initiates the replica set on every
  boot. Re-seeded 25 members / 8 specs / 70 categories + Test sandbox. Verified data
  and login survive a restart. (Production unaffected — uses Atlas via MONGO_URL.)
- **Deploy env files:** created `backend/.env` and `frontend/.env` so the pipeline's
  read-env steps pass; `test_credentials.md` added to `.gitignore`.
- **🔁 Migrated database PostgreSQL → MongoDB.** Prisma `provider = "mongodb"`,
  `url = env("MONGO_URL")`; ids `String @id @default(cuid()) @map("_id")` (FKs stay
  plain strings). All tests pass on Mongo (44 audit + 15 iteration-2 + 5 reject-flow).
  Post-deploy notes: run `prisma db push` against Atlas for unique indexes; disk
  uploads (`/app/storage`) are ephemeral → move to object storage for durable prod.

## Hotfix v2 — 2026-06-24 (PROD 502 on /api — FastAPI crashing at startup)
- **Real root cause (found by probing prod directly):** production `/login` returned 200 but `/api/*` returned **HTTP 502** → the **FastAPI backend (:8001) was crashing at startup in production**, so the login POST hit Cloudflare's 502 HTML page = "Unexpected token '<'". (The earlier requirements.txt trim was necessary but not sufficient.)
- **Culprit:** the `/internal/transcribe` route used FastAPI `File()/UploadFile`, which requires **python-multipart at import time**; if that dep isn't present in the prod build, `uvicorn server:app` fails to boot → all `/api` 502.
- **Fix (preview, needs REDEPLOY):**
  - Rewrote `/internal/transcribe` to read `await request.body()` (raw bytes + `x-audio-filename` header) — no `File()`, no python-multipart dependency.
  - `server.py` now imports only `fastapi` + `httpx` (both in base image) + optional `dotenv`; **backend boots even if `requirements.txt` is ignored**.
  - `app/api/transcribe/route.ts` forwards raw audio bytes; `requirements.txt` = fastapi/uvicorn/httpx/python-dotenv only.
- **Verified:** testing_agent iteration_8 — 21/21 backend, 3/3 roles login/session/logout, `/api` always JSON, Whisper still works via raw-body path.

## Hotfix — 2026-06-24 (PROD login broken: "Unexpected token '<'")
- **Symptom:** Production login returned an HTML page instead of JSON → the FastAPI proxy (:8001) was down in prod, so every `/api/*` (incl. login) hit an HTML error page.
- **Root cause:** the `backend/requirements.txt` created in the previous session listed **`emergentintegrations`** (very large tree, needs the Emergent extra index) → clean production build failed/timed out → backend never started. Preview was unaffected (library was already in the pod).
- **Fix (preview, needs REDEPLOY):**
  - Trimmed `backend/requirements.txt` → `fastapi, uvicorn, httpx, python-multipart, python-dotenv` (removed emergentintegrations + pymongo).
  - `server.py`: optional `dotenv` import (try/except); `/internal/transcribe` lazily imports emergentintegrations and returns 503 if unavailable → backend always starts.
  - Renamed Whisper key `EMERGENT_LLM_KEY` → `WHISPER_LLM_KEY` in `backend/.env` so it no longer leaks into the Next env (via start.js merge) and flip file-storage to object store.
- **Impact on #12 (Whisper) in prod:** transcription works only where `emergentintegrations` is present in the runtime; otherwise it degrades gracefully (voice memo still attaches, 503 on transcribe). To enable it reliably in prod, install emergentintegrations in the deploy runtime.
- **Verified:** testing_agent iteration_7 — 17/17 backend, 3/3 roles full login/session/logout flow, all `/api` return JSON.


**Batch 2** (tested, iteration_5 — 4/4 pass):
- **#2** Multi-select drawings → bulk-assign to one person (admin FloorRegister checkboxes + `bulk-assign-bar`; `AssignTaskModal` `fixedCategoryIds`; POST /api/tasks accepts `categoryIds[]`).
- **#3** "Route to Team" moved from Drawing Register → Assign modal (added `DesignTask.specializationId`; onsite scoping now per-task; register no longer shows/sets routing).
- **#10** Designers see ALL projects/drawings + self-assign (always-on): `/api/projects` & `/api/tasks` broadened for DESIGNER; POST /api/tasks lets a designer self-assign (forces assignee=self, auto-joins project); Building tab shows full register with "Assign to me".

**Batch 3** (tested, iteration_6 — #1/#8/#9 live pass, #12 API-verified + UI-present):
- **#1** Project "Breach Timeline" tab — chronological list of review-SLA / deadline misses, oldest first, with how-late + status (`BreachTimeline`). Per-task Overdue badge shipped in Batch 1.
- **#8** Admin "Backup Drawings" → `GET /api/projects/[id]/backup` streams a ZIP (JSZip) of every uploaded drawing file (all versions), organised `Floor/Drawing/vN-file`. Header button `backup-drawings-btn` (admin-only).
- **#9** Notifications upgrade — sonner `<Toaster/>` app-wide + toast on newly-arrived notifications; dedicated `/notifications` page (filter chips, mark-all-read); "Notifications" sidebar item for all roles; bell "View all" footer. `GET /api/notifications?all=1`.
- **#12** Whisper voice-note transcription — `backend/server.py` `/internal/transcribe` (OpenAISpeechToText, whisper-1, EMERGENT_LLM_KEY) called by authenticated Next `POST /api/transcribe`; `VoiceRecorder` "Transcribe to text" button prefills the rejection reason. Verified via curl end-to-end.

### PRODUCTION REDEPLOY NOTES
- `backend/requirements.txt` was created (fastapi/uvicorn/httpx/python-multipart/python-dotenv/pymongo/**emergentintegrations**). Prod build must install these (emergentintegrations needs the Emergent extra index).
- `EMERGENT_LLM_KEY` added to `backend/.env` (Python/Whisper only). Next.js storage backend unchanged (still local-disk in preview) — set EMERGENT_LLM_KEY in the Next env separately to activate object storage.
- Prisma: `DesignTask.specializationId` added (db push applied; MongoDB optional field — no migration blocker).

## Changelog — 2026-06-23 (14-item change request — Batch 1 of 3)
Delivered & tested (testing_agent iteration_4 — frontend pass, no regressions):
- **#4** Assign-task designer/reviewer dropdowns sorted alphabetically (`AssignTaskModal.tsx`).
- **#5 + #13** Advanced filters on `/tasks` (Project · Floor · Discipline · Person · Overdue-only + Clear),
  available to all roles incl. ONSITE Reviews (`app/(app)/tasks/page.tsx`). Status pills retained.
- **#6** "Specialization" field hidden on New User (shown only when editing) (`users/page.tsx`).
- **#7** Department option "Architecture · Structure" → "Architecture".
- **#14 + #1(partial)** Rejected upload made prominent: red pulsing "Upload Revision Now" button +
  "Changes requested" banner (`projects/[id]/page.tsx`, `pulseUpload` keyframes in globals.css);
  per-task red "Overdue" badge on `/tasks`. (#14/#1 code-verified — seed had no rejected/overdue rows.)
- **#11** Drawings replaceable in ANY state incl. APPROVED (removed the APPROVED upload guard in
  `api/tasks/[id]/files`; UI labels: "Replace Drawing"/"Replace Approved Design"; new version → re-review).

### Remaining (Batch 2/3 — NOT yet started):
- **#1** Project-level "Breach Timeline" view (chronological list of SLA/deadline breaches).
- **#2** Multi-select drawings → bulk-assign to one person.
- **#3** Move "Route to Team" out of Drawing Register into the Assign tab (needs `DesignTask.specializationId` + onsite scoping update).
- **#8** Admin project-wise drawing backup → downloadable ZIP (all versions).
- **#9** Notifications upgrade: toast/banner on new notification + dedicated Notifications page.
- **#10** Designers see all drawings in their projects + self-assign (always-on) (scoping in `/api/tasks`, `/api/projects`, allow DESIGNER POST /api/tasks).
- **#12** Whisper transcription for rejection voice notes (needs integration_expert + Emergent Universal Key).

## Changelog — 2026-06-22 (Per-floor Drawing Register)
- **Refactored the Drawing Register from a global floor-TYPE rule to a PER-FLOOR
  mapping.** Each specific floor (Ground Floor, First Floor, …) now has its own
  independently-editable list of drawings.
- **Schema:** added `floorIds String[] @default([])` to `DesignCategory` (kept
  `appliesTo` as the DEFAULT seeding rule). `prisma db push` applied.
- **Backfill (`lib/bootstrap.ts`):** idempotent — raw-finds project drawings with
  `floorIds` field missing (`$exists:false`) and `$set`s computed floorIds from
  appliesTo vs that project's floors. Verified: 70/70 Test-project drawings populated.
- **copyTemplateRegister (`lib/projectRegister.ts`):** seeds floorIds from appliesTo
  against the new project's floors; exports `floorIdsForApplies()`.
- **New floor add (`POST /api/projects/[id]/floors`):** `$addToSet`s the new floor id
  into every drawing whose appliesTo covers its type (empty = all) → auto-populates.
- **Floor delete (`DELETE /api/floors/[id]`):** `$pull`s the id from all drawings.
- **categories POST/PATCH:** accept `floorIds`.
- **Frontend:** RegisterTab filter chips are now the project's actual floors
  (full names: All · Basement · Stilt · Ground Floor · First Floor · …); per-floor
  Add (DrawingModal floors checklist), per-floor Remove (✕, this-floor-only),
  bulk "Manage <floor>" checklist (FloorDrawingsModal), and All-view type delete.
  Building tab `floorCats` and AssignTaskModal `visibleCategories` now filter by
  `floorIds.includes(floor.id)`. On-Site board unchanged (task-based).
- **Tested:** testing_agent iteration_3 — 6/6 backend pytest, 100% frontend functional.
  Regression test at `backend/tests/test_floor_ids.py`. **Requires REDEPLOY for production.**

## Changelog — 2026-06-19 (UI fixes: naming, spelling, mobile register)
- **Tab/heading mismatch:** renamed the project tab "Drawing Master" → **"Drawing Register"**
  so it matches its own heading (`projects/[id]/page.tsx`).
- **Spelling/pluralization bug:** the Revisions filter chips appended "s" to event
  labels producing "Approveds / Rejecteds / Uploadeds". Fixed `RevisionsTab.tsx`
  with an explicit `FILTER_LABEL` map → **All · Revisions · Rejected · Approved · Uploads**.
  Also fixed the Team page department-fallback grouping ("On-Sites" → "On-Site Team").
  Swept the app for `+"s"` label patterns and common misspellings — none others found.
- **Mobile alignment (admin/designer Drawing Register):** register rows were cramped
  on phones (drawing name squeezed to a sliver by the badge/zone/action cluster).
  Added `.register-row` responsive classes in `globals.css` — on ≤640px the row stacks
  (name full-width on its own line, meta/actions wrap below). Applied in `RegisterTab.tsx`.
- Verified on desktop (build OK, tab + filter labels correct). Mobile uses a CSS media
  query (the screenshot tool only captures wide, so verified by CSS not screenshot).
  **Requires REDEPLOY for production.**

## Changelog — 2026-06-17 (Automated daily database backups)
- Implemented automated **full DB backup every day at midnight** + restore.
- `lib/backup.ts`: logical dump via the MongoDB driver (no external `mongodump`
  dependency — works in the managed prod container), gzipped EJSON archive
  (type-preserving). Each backup is stored **both in the DB** (`DbBackup` model,
  `archive Bytes`, durable on Atlas) **and as a file** in `BACKUP_DIR`
  (`/app/backups`, gitignored). **14-day retention** auto-prunes older backups
  (docs + files).
- **Scheduler**: `node-cron` started from `instrumentation.ts` → runs in-process,
  cron `BACKUP_CRON` (default `0 0 * * *`) in `BACKUP_TZ` (default Asia/Kolkata).
  Scheduled runs are claimed once per day via a unique `dateKey` index, so the 2
  production replicas never double-run. Manual runs use a timestamped key.
- **Admin UI**: new `/backups` page (ADMIN-only nav item) — "Protected" status,
  "Back up now", table (when/type/status/size/records/download). APIs:
  `GET/POST /api/admin/backups`, `GET /api/admin/backups/[id]/download` (ADMIN-only).
- **Restore** (manual, per client choice — no risky UI button): self-contained
  `scripts/restore-backup.ts` → `npx tsx scripts/restore-backup.ts [backupId]`
  (defaults to latest). Drops + re-inserts each collection from the archive.
- New deps: `mongodb`, `node-cron`. Schema: `DbBackup` model (+ `getMongoUrl()`
  exported from `lib/db`).
- **Verified in preview**: manual backup → 212 records, 7 KB, stored in DB + disk;
  download works; restore removed an injected marker doc and left users/categories
  intact (login OK). Scheduler logged at boot. **Requires REDEPLOY for production.**
- Note: prod also runs on managed Atlas which may have its own snapshots; this is an
  app-level backup in addition. Disk file is ephemeral in prod, but the DB copy is durable.

## Changelog — 2026-06-17 (On-Site "Drawing List" UI — Option A integrated)
- Integrated the client-selected **Option A · Drawing List** design as the On-Site
  reviewer experience (both mobile and desktop, one responsive component).
- New `components/onsite/OnSiteProjectBoard.tsx`: project header + **floors top-bar**
  (per-floor drawing counts) → **department pills** (Interior/Structure/MEP/Woodwork
  with counts) → **drawings list** (To review / Signed / All filter + search) →
  **Open** launches the existing `DrawingReviewModal` (full preview + zoom/rotate/
  download + Approve/Reject for pending). Status badges: Signed / Needs review /
  Sent back / In progress. All elements have `data-testid`s.
- Wired into `app/(app)/projects/[id]/page.tsx`: when `role === "ONSITE"` it renders
  the board instead of the admin Building UI. Admin/Designer views unchanged (verified).
- **No backend changes** — reuses role-scoped `GET /api/tasks?projectId=` (floor,
  category.discipline, status, reviewer) + `GET /api/projects/[id]` (floors).
- Verified in preview (desktop): floors(7)/pills(4) render with counts, 2 pending
  Interior drawings on Ground show "Needs review", Open → review modal with
  Approve/Reject; Admin regression OK. Responsive by design (overflow-x scroll bars,
  flex-wrap header + modal body, clamp() title). Created demo review tasks
  (reviewer = Sudama) in preview for testing/demo. **Requires REDEPLOY for production.**

## Changelog — 2026-06-16 (v5: drawing register missing on Mongo — root cause)
- **Symptom:** in prod, floors showed "No drawings match" / "0 of 0 drawings" for
  every discipline; the drawing-type master register appeared empty.
- **Root cause (Prisma + MongoDB null semantics):** the master register rows
  (`DesignCategory` with no project) were created by the original seed WITHOUT
  passing `projectId`, so the field is **missing** (`isSet:false`) in Mongo.
  Prisma's `where: { projectId: null }` matches only BSON-null, NOT a missing
  field, so `copyTemplateRegister()` and `GET /api/categories` returned 0 — the
  register was invisible to the app even though 70 docs existed. (A fresh Prisma
  `create({projectId:null})` DOES store BSON-null and is matchable — confirmed by
  a direct test.) This had been broken since the Postgres→Mongo migration.
- **Fix (`lib/bootstrap.ts`):** at startup, run a raw Mongo `update` to set
  `projectId: null` on any `DesignCategory` where the field is missing
  (`$exists:false`) → normalizes legacy rows so all `{projectId:null}` queries
  match them. Then: seed the master register if still empty (idempotent, BSON-null,
  per-item unique-collision guard) and **backfill any project that has 0 drawings**
  via `copyTemplateRegister` (decoupled from the user/seed gate). All idempotent
  and safe across the 2 prod replicas.
- **Verified in preview:** master register = 70 (MEP 26 / Interior 23 / Structure
  19 / Woodwork 2); the Test project backfilled to 70; Ground Floor UI now lists
  all drawing types with Assign buttons. **Requires REDEPLOY for production.**

## Changelog — 2026-06-16 (v4: strip unsupported Atlas query param)
- After the binaryTargets fix, prod surfaced the NEXT error:
  `MongoDB connection string error: timeoutms is an invalid option`. Emergent's
  managed Atlas `MONGO_URL` includes a `timeoutMS=...` query param that Prisma's
  mongodb connector rejects. Fixed in `lib/db.ts` `withDatabase()` —
  `sanitizeQuery()` drops denylisted params (`timeoutms`) while preserving valid
  ones (retryWrites, w, replicaSet, …). Verified preview still 200 / 25 users.
- Chain of prod blockers resolved in order: (1) Next.js had no MONGO_URL → load
  from env/backend.env; (2) Atlas URL had no db name → merge DB_NAME; (3) Prisma
  query engine binary mismatch (musl vs debian) → binaryTargets; (4) timeoutMS
  query param invalid → sanitizeQuery.

## Changelog — 2026-06-16 (v3: THE real prod fix — Prisma engine binary)
- **🎯 Actual production login 500 root cause found** via a temporary diagnostic
  route (`/api/debug/db`, redacts creds): production returned
  `PrismaClientInitializationError: Prisma Client could not locate the Query
  Engine for runtime "debian-openssl-3.0.x" ... was generated for
  "linux-musl-openssl-3.0.x"`. The deploy build is Alpine/musl but the runtime is
  Debian — the bundled query engine didn't match, so EVERY Prisma query threw 500.
  **Fix:** `prisma/schema.prisma` generator now sets
  `binaryTargets = ["native", "debian-openssl-3.0.x", "debian-openssl-1.1.x"]`
  and ran `prisma generate`. Deploy's postinstall regenerates with the debian engine.
- The diagnostic ALSO confirmed the prod env: `MONGO_URL` = `mongodb+srv://customer-apps...mongodb.net` **with no db in path**, `DB_NAME=floor-planning-stage-base`. The v2 `lib/db.ts` merge handles this correctly (folds DB_NAME into the URL; prefers `process.env` over the localhost values still sitting in the committed `.env` files).
- Net effect after redeploy: Prisma connects to Atlas → instrumentation seeds the
  25 accounts on the empty DB → login + quick demo logins work.
- TODO: remove the temporary `/api/debug/db` route once prod login is confirmed green.

## Changelog — 2026-06-16 (v2: launcher-independent prod fix)
- **🔴 Production login still 500'd after v1** (curl on prod returned
  `{"error":"Internal server error"}` while preview was 200). Real root cause:
  Emergent injects the managed Atlas `MONGO_URL` **without a database name in the
  path**, and Prisma's mongodb connector REQUIRES the db name → every query threw.
  The v1 fix only merged the db name inside `start.js`, which only runs if that
  launcher is the prod entrypoint (unverifiable).
  **v2 fix (launcher-independent):**
  - `lib/db.ts` now resolves the connection string itself: reads `MONGO_URL`/`DB_NAME`
    from `process.env` (falls back to `/app/backend/.env` then `/app/.env`), folds
    `DB_NAME` into the URL via `withDatabase()`, and passes it to `PrismaClient`
    via `datasourceUrl`. Works no matter how Next.js is started.
  - **In-process seeding** via Next.js `instrumentation.ts` → `lib/bootstrap.ts`:
    on an empty DB (zero users) it seeds 8 specializations + the master drawing
    register + the 25 team accounts (shared password `password123`). Runs once at
    server boot regardless of launcher (no tsx dependency). Removed the tsx-based
    seed from `start.js`.
  Verified in preview: all 3 roles login 200; me/projects/tasks 200; 25 users present.
  **Requires a REDEPLOY to take effect in production.**

## Changelog — 2026-06-16 (production login 500 + object storage)
- **🔴 (v1) Production login 500 fix attempt.** Root cause initially identified:
  the Next.js process (which runs all Prisma queries) read its `MONGO_URL` from
  `/app/.env`, which is **gitignored** and therefore absent in the deployed
  container. Emergent injects managed values into `/app/backend/.env`, which
  Next.js never read. Fix = new launcher **`/app/frontend/start.js`** (now the
  `frontend` supervisor command via `frontend/package.json` `start`) that:
  1) loads env from `/app/backend/.env` (falls back to `/app/.env`),
  2) folds `DB_NAME` into the Mongo connection string (Prisma's mongodb connector
     requires the db name in the URL; Emergent's Atlas `MONGO_URL` often omits it),
  3) on an **empty** database only, auto-seeds master data + the 25-person team
     (`prisma/seed.ts` then `prisma/import-team.ts`) so a fresh prod deploy has
     working credentials, then 4) execs `next start`.
  Added `JWT_SECRET` + `STORAGE_DIR` to `backend/.env` so prod has a stable secret.
  Verified in preview: login/me/projects all 200; seed correctly skipped (DB not empty).
- **📦 File uploads → hybrid storage (`lib/storage.ts`).** Uses **Emergent Object
  Storage** when `EMERGENT_LLM_KEY` is present (durable in prod), else falls back
  to local disk under `STORAGE_DIR` (preview/dev — unchanged behaviour). Object
  keys are prefixed `blueprint-flow/` so `readFile()` routes each key to the right
  backend (legacy/seed files on disk keep working). Same public signatures
  (`saveFile`/`readFile`/`saveAvatar`) — no call-site changes. **ACTION REQUIRED:**
  object storage stays dormant until the user enables the Universal Key
  (Profile → Universal Key → Add Balance); `emergent_integrations_manager`
  currently returns 404 (key not provisioned for this job).
- Build passes (`yarn build`), no TS errors.

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

## 2026-07-02 — Project Backups (Archive) tab COMPLETE (P0)
- Admin-only "Project Backups" sidebar link (`Shell.tsx` navFor ADMIN) → `/archive`.
- `/app/(app)/archive/page.tsx`: lists projects split Active vs Archived (status COMPLETED → "Archived" badge); drill into a project → floors (ordered) → drawings (alpha) → every revision button (v1,v2…); inline preview Modal (image/PDF/other-fallback) + per-file Download; floor-wise "Download ZIP" (reuses `/api/projects/[id]/backup`).
- `/app/api/projects/[id]/archive/route.ts`: GET, requireRole('ADMIN'), returns {project, floors[], totalFiles}. Uses DesignFile.uploadedAt (not createdAt — fixed a build error this session).
- Auto daily backup: ALREADY existed — `lib/backup.ts` `scheduleBackups()` cron (midnight IST, full DB dump, durable on Atlas + disk, 14-day retention) wired in `instrumentation.ts`. No new work needed; the Archive tab also shows every historical revision live from the DB.
- Verified end-to-end by testing_agent iteration_10: 100% backend (admin 200 correct shape/ordering; designer/on-site 403; unauth 401) + 100% frontend (nav, list, drill-down, preview, ZIP, back, RBAC nav hidden). No bugs.
- NOTE: app runs in PRODUCTION mode (`next start`) — code/route changes require `yarn build` + `supervisorctl restart frontend` to take effect (no hot reload).

## Remaining backlog (priority order)
- P1: PWA manifest (installable on on-site staff phones).
- P1: Object storage activation for uploads (currently hybrid local disk; object store used when EMERGENT_LLM_KEY present).
- P2: Email invites — one-time set-password link (SendGrid/Resend).
- P2: WhatsApp-style push notifications for drawing uploads.

## 2026-07-08 — 13-item feature/flow update (all verified, iteration_11)
1. Date-range filter (Deadline from/to) on /tasks for all roles.
2. Designer "Drawing Register" tab: search + floor chips, shows who each drawing is assigned to, self-assign modal (fixed floor + required off-site reviewer + optional deadline). Designers' Building view now shows only THEIR tasks.
3. "Uploaded Drawings" tab (Admin + Designer): drawings grouped by heading, expand to preview each version inline. New GET /api/projects/[id]/uploads (admin or project member).
4. Bulk-assign selection disables per-row Assign buttons.
5. Project visibility: DESIGNER sees only projects they're a member of (projects + tasks scoped). Admin sees all; on-site scoped to routed work.
6. Bulk assign = 2-step: pick people+reviewer → "Next" → per-drawing deadline pickers. tasks POST accepts deadlines map.
7. "Structure" label renamed to "Architecture" everywhere (enum value unchanged, no migration).
7b. Notification bell: larger, prominent pulsing red count badge; poll 60s→20s.
8. Newest project sorts first + shows a "NEW" tag (created within 7 days).
9. Designer per-project Analytics tab (own tasks only); dashboard DESIGNER branch now projectId-scoped. Admin keeps full project analytics.
10. Building floors show a prominent drawing-count badge + pulse on floors with pending/newly-assigned work (FloorMeta.assigned; blue = newly assigned).
11. Task upload replaced raw file input with a prominent styled drop button + cursor pointer.
12. On-site: no inline approve/reject on task page — must open the drawing (DrawingReviewModal) to decide.
13. Edit outcome: the on-site reviewer who decided can reopen an APPROVED/REJECTED drawing (with confirm) via POST /api/tasks/[id]/reopen → back to PENDING_REVIEW to re-decide.

NOTE: prod mode (next start) — changes need `yarn build` + `supervisorctl restart frontend`. This batch built + restarted in PREVIEW; user must REDEPLOY to push to production.

## 2026-07-08 (b) — 7 follow-up fixes (all verified, iteration_12)
1. Removed duplicate "Drawing Register" tab for admins (tabs now strictly role-filtered).
2. Admin floor register: department capsules show assigned/total (e.g. MEP 2/10); added All/Assigned/Unassigned filter; assigned drawings sort to top.
3. Bulk-assign discoverability: "Bulk assign · select all unassigned" button + clearer bulk bar; single Assign disabled while selecting.
4. Edit-outcome now uses a custom in-app confirm dialog (reopen-confirm-dialog) instead of window.confirm.
5. Designer register gained an "All" view (default) across floors with per-floor assignment chips; assigning from All lets the designer pick which floor (Select) in the self-assign modal.
6. Admin Add-Drawing modal: "All floors" one-click toggle (drawing-floor-all).
7. Richer designer analytics (deadline-first): My Deadlines list (overdue red + countdowns), On-time % + Approval-rate meters, workload-by-department, My Progress by Floor. dashboard DESIGNER branch now returns charts{approvalRate,onTimeRate,floorProgress,workload,deadlines}.

Known cosmetic: designer on-time-rate shows 100% when they have 0 tasks (could be "N/A"). Reminder: PROD mode — rebuild + restart done in PREVIEW; user must REDEPLOY.

## 2026-07-09 — Voice-note auto-transcription (Whisper) + prod fix
- On drawing rejection, the reviewer's voice memo AUTO-transcribes into the (editable) reason box on Stop. Hindi/English/Hinglish via Whisper auto-detect. VoiceRecorder shows inline transcribing/success/error states; DrawingReviewModal replaces the reason box with the transcript.
- Key: WHISPER_LLM_KEY in backend/.env (falls back to EMERGENT_LLM_KEY). Accepts raw OpenAI keys (sk-proj/sk-...) and Emergent keys (sk-emergent-...).
- PROD FIX: production returned {"detail":"Transcription unavailable"} because emergentintegrations is NOT in requirements.txt (kept out to avoid the heavy-dep boot 502). Rewrote backend/server.py /internal/transcribe: for a RAW OpenAI key it now calls https://api.openai.com/v1/audio/transcriptions directly via httpx (already a dep) — lightweight, works in preview + prod. sk-emergent keys still use emergentintegrations (preview only).
- ACTION FOR USER: redeploy, and ensure production env has WHISPER_LLM_KEY set to the same OpenAI key.

## 2026-07-09 (b) — Fix: edit-outcome approve/reject flicker
- Bug: on OnSiteProjectBoard, "Edit outcome" → Yes made Approve/Reject flash then disappear. Cause: reopen() called onDone() mid-flow → parent load() refetch remounted DrawingReviewModal. (Task-detail page unaffected.)
- Fix (DrawingReviewModal): reopen() now sets dirtyRef instead of calling onDone(); parent refresh is deferred to modal close (closeRef: onDone-if-dirty then onClose) or to decide(). Escape/backdrop/X routed through closeRef. Verified on the board: Approve/Reject stable, no flicker.
