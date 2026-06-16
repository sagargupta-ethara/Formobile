#!/usr/bin/env bash
# Persistent single-node MongoDB replica set for the PREVIEW environment.
# Prisma's MongoDB connector requires a replica set; the platform only ships a
# standalone mongod (27017). We run our own replica-set mongod on 27018 with its
# data stored inside the persistent /app volume so it survives container restarts.
# (Production uses Atlas via MONGO_URL and does NOT use this script.)
set -uo pipefail

DBPATH=/app/.platform/mongo-rs-data
PORT=27018

mkdir -p "$DBPATH"

/usr/bin/mongod --replSet rs0 --port "$PORT" --dbpath "$DBPATH" --bind_ip_all &
MONGOD_PID=$!

# Forward stop signals to mongod for a clean shutdown.
trap 'kill -INT "$MONGOD_PID" 2>/dev/null; wait "$MONGOD_PID"; exit 0' INT TERM

# Wait for mongod to accept connections.
for _ in $(seq 1 30); do
  if mongosh --port "$PORT" --quiet --eval "db.runCommand({ping:1}).ok" 2>/dev/null | grep -q 1; then
    break
  fi
  sleep 1
done

# Initiate the replica set once (config persists in the data dir afterwards).
if ! mongosh --port "$PORT" --quiet --eval "rs.status().ok" 2>/dev/null | grep -q 1; then
  mongosh --port "$PORT" --quiet --eval \
    "rs.initiate({_id:'rs0', members:[{_id:0, host:'127.0.0.1:$PORT'}]})" || true
fi

wait "$MONGOD_PID"
