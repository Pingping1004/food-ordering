#!/usr/bin/env bash
# Fresh database + seed for the browser tests. Local Postgres only.
#   PGHOST/PGPORT/PGUSER default to localhost:55432/postgres (CI sets them to its service container).
set -euo pipefail
cd "$(dirname "$0")/../../../backend"
export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-55432}" PGUSER="${PGUSER:-postgres}"
DB="${E2E_DB:-promptserve_e2e}"
case "$PGHOST" in localhost|127.0.0.1) ;; *) echo "refusing to touch a non-local database ($PGHOST)"; exit 1;; esac
dropdb --if-exists "$DB"; createdb "$DB"
export DATABASE_URL="postgresql://${PGUSER}${PGPASSWORD:+:$PGPASSWORD}@${PGHOST}:${PGPORT}/${DB}" DIRECT_URL="postgresql://${PGUSER}${PGPASSWORD:+:$PGPASSWORD}@${PGHOST}:${PGPORT}/${DB}"
npx prisma db push >/dev/null
E2E=1 STUDENTS=10 SHOPS=2 OUT="$(pwd)/../frontend/tests/e2e/.data.json" npx ts-node -r tsconfig-paths/register --transpile-only test/load/seed.ts
