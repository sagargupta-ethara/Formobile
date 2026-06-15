#!/bin/bash
# Self-healing PostgreSQL bootstrap for the Emergent container.
#
# Why: only /app persists across container restarts. The postgres apt package,
# /var/lib/postgresql, and even the OS-level `postgres` user are wiped on every
# restart. This script restores everything and points the data directory at
# /app/.platform/pgdata so the database itself persists.
#
# Used as the supervisor command for the `postgresql` program, running as root.

set -e

PG_VERSION=15
PG_BIN="/usr/lib/postgresql/${PG_VERSION}/bin"
PG_DATA="/app/.platform/pgdata"
PG_RUN="/var/run/postgresql"
LOG_DIR="/var/log/postgresql"

# 1. Reinstall postgres if the binaries are missing.
if [ ! -x "${PG_BIN}/postgres" ]; then
  echo "[pg-bootstrap] postgres binaries missing, installing..."
  DEBIAN_FRONTEND=noninteractive apt-get update -y >/dev/null
  DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib >/dev/null
fi

# 2. Make sure the `postgres` OS user exists.
if ! id -u postgres >/dev/null 2>&1; then
  echo "[pg-bootstrap] creating postgres OS user..."
  groupadd -r postgres 2>/dev/null || true
  useradd -r -g postgres -d /var/lib/postgresql -s /bin/bash postgres
fi

# 3. Prepare runtime + log dirs (these live outside /app and may be missing).
mkdir -p "${PG_RUN}" "${LOG_DIR}"
chown postgres:postgres "${PG_RUN}" "${LOG_DIR}"

# 4. First-run: initialise the persistent data dir under /app.
mkdir -p "$(dirname "${PG_DATA}")"
if [ ! -s "${PG_DATA}/PG_VERSION" ]; then
  echo "[pg-bootstrap] initialising new cluster at ${PG_DATA}..."
  rm -rf "${PG_DATA}"
  mkdir -p "${PG_DATA}"
  chown postgres:postgres "${PG_DATA}"
  chmod 700 "${PG_DATA}"
  su - postgres -c "${PG_BIN}/initdb -D ${PG_DATA} --auth-local=trust --auth-host=md5 --encoding=UTF8" >/dev/null
  # listen on localhost only
  echo "listen_addresses = '127.0.0.1'" >> "${PG_DATA}/postgresql.conf"
  echo "unix_socket_directories = '${PG_RUN}'" >> "${PG_DATA}/postgresql.conf"
  touch "${PG_DATA}/.first_run"
fi

# Make sure ownership is correct even if /app was rsynced/cloned with different uids.
chown -R postgres:postgres "${PG_DATA}"

echo "[pg-bootstrap] starting postgres on ${PG_DATA}..."
exec su - postgres -c "${PG_BIN}/postgres -D ${PG_DATA}"
