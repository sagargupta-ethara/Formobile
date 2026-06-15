# Test Credentials — Blueprint Flow

All seeded users share the password: **`password123`**
(Users can change it from the Profile page.)

## Quick-login accounts (the three buttons on /login)
| Role     | Email                                  |
|----------|----------------------------------------|
| Admin    | manish.uppal@blueprintflow.in          |
| Designer | amarpreet.padam@blueprintflow.in       |
| On-Site  | sudama@blueprintflow.in                |

## All imported team accounts (run via `npx tsx prisma/import-team.ts`)
**Admin:** manish.uppal, reediima.uppal, kanhav.uppal `@blueprintflow.in`
**Designer (Interior):** amarpreet.padam, sanjana.dawar, nidhi.kamboj, astha
**Designer (Civil):** pankaj, kiranpreet, rajesh
**On-Site Head:** sewaram.sharma, pradeep.rawat, virender
**On-Site Supervisor:** praveen, zakir, sudama, vijay, nand.kishore, gaurav, rajesh.site
**On-Site Carpentry:** kailash
**MEP On-Site:** dighamber (Plumbing), mahesh & sandeep (Electrical), salman (HVAC)

## Database
- Host: `localhost:5432`
- User: `bf`  /  Password: `bfpass`  /  DB: `blueprint_flow`
- Connection string: `postgresql://bf:bfpass@localhost:5432/blueprint_flow`

## Storage
- Local disk at `/app/storage` (ephemeral on container restart)

## Re-seed / re-import
```
cd /app
yarn db:push                          # apply schema
yarn db:seed                          # demo data (admin@blueprint.test etc.)
npx tsx prisma/import-team.ts         # import real staff, remove demo data
```
