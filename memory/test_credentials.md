# Test Credentials — Blueprint Flow

All seeded users share the password: **`password123`**
(Users can change it from the Profile page.)

## Quick-login accounts (the three buttons on /login)
| Role     | Email                                  |
|----------|----------------------------------------|
| Admin    | manish.uppal@blueprintflow.in          |
| Designer | amarpreet.padam@blueprintflow.in       |
| On-Site  | sudama@blueprintflow.in                |

## Super Admin (DB backups access) — NOT shown as a quick-login button
| Role        | Email                          | Password         |
|-------------|--------------------------------|------------------|
| Super Admin | superadmin@blueprintflow.in    | `BpF-Sup3r-2026!`|
- Seeded idempotently in `lib/bootstrap.ts` (env-overridable via `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`).
- Role is ADMIN with `isSuperAdmin=true`: same powers as a normal admin PLUS the DB Backups page (`/backups`, `/api/admin/backups*`). Regular admins get 403 there and the nav item is hidden.


## All imported team accounts (run via `npx tsx prisma/import-team.ts`)
**Admin:** manish.uppal, reediima.uppal, kanhav.uppal `@blueprintflow.in`
**Designer (Interior):** amarpreet.padam, sanjana.dawar, nidhi.kamboj, astha
**Designer (Civil):** pankaj, kiranpreet, rajesh
**On-Site Head:** sewaram.sharma, pradeep.rawat, virender
**On-Site Supervisor:** praveen, zakir, sudama, vijay, nand.kishore, gaurav, rajesh.site
**On-Site Carpentry:** kailash
**MEP On-Site:** dighamber (Plumbing), mahesh & sandeep (Electrical), salman (HVAC)

## Database (MongoDB — migrated from PostgreSQL on 2026-06-16)
- Engine: **MongoDB** via Prisma (`provider = "mongodb"`)
- Preview/local: single-node replica set — `mongodb://127.0.0.1:27018/blueprint_flow?replicaSet=rs0`
  (Prisma's Mongo connector requires a replica set; the platform standalone Mongo on 27017 is left untouched.)
- Production: Emergent-managed Atlas MongoDB, injected via the `MONGO_URL` env var.
- DB name: `blueprint_flow`. Configured via `MONGO_URL` in `/app/.env` and `/app/backend/.env`.

## Authentication (web + mobile — dual auth, added 2026-06-22)
- Web: httpOnly cookie `bpf_session` (JWT, HS256, `jose`, 7-day expiry). Unchanged.
- **Mobile / API clients: `POST /api/auth/login` now also returns `{ user, token }`.**
  Send that token on every request as `Authorization: Bearer <token>` — the same
  JWT verifies as either a cookie (web) or a bearer header (mobile). Implemented in
  `lib/auth.ts` (`signToken`, `createSession` returns token, `getSession` reads cookie
  then falls back to the Authorization header). No CORS change needed for native
  (Expo) clients; the FastAPI proxy forwards `Authorization` verbatim.
- For the mobile app: POST /api/auth/login → store `token` in Expo SecureStore →
  attach `Authorization: Bearer <token>` to all `/api/*` calls. Same MONGO_URL/DB.

## Storage
- Local disk at `/app/storage` (ephemeral on container restart; migrate to object storage for durable prod uploads).

## Re-seed / re-import (MongoDB)
```
cd /app
set -a && . ./.env && set +a          # load MONGO_URL
npx prisma db push                    # apply schema + indexes to Mongo
npx tsx prisma/import-team.ts         # import the 25 real staff accounts
```
