#!/bin/bash
# Ensures the application DB user and Blueprint Flow schema/data exist.
# Idempotent — safe to run on every container start.
set -e

PSQL="su - postgres -c"
DB=blueprint_flow
DB_USER=bf
DB_PASS=bfpass

# Wait until postgres accepts connections.
for i in $(seq 1 60); do
  if su - postgres -c "psql -tAc 'SELECT 1' >/dev/null 2>&1"; then
    break
  fi
  sleep 1
done

# Create role + database if missing.
su - postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'\" | grep -q 1" \
  || su - postgres -c "psql -c \"CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}' SUPERUSER;\""

su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${DB}'\" | grep -q 1" \
  || su - postgres -c "psql -c \"CREATE DATABASE ${DB} OWNER ${DB_USER};\""

# Apply Prisma schema and seed if the schema is empty.
cd /app
export PATH="$PATH:/app/node_modules/.bin"

# Count user tables in the public schema.
TABLES=$(su - postgres -c "psql -d ${DB} -tAc \"SELECT count(*) FROM information_schema.tables WHERE table_schema='public'\"" | tr -d '[:space:]')

if [ "${TABLES:-0}" -lt 1 ]; then
  echo "[db-bootstrap] empty schema — running prisma db push + import-team"
  yarn db:push >/dev/null
  yarn db:seed >/dev/null
  npx tsx prisma/import-team.ts >/dev/null
  echo "[db-bootstrap] done"
else
  echo "[db-bootstrap] schema already has ${TABLES} tables — skipping"
fi
