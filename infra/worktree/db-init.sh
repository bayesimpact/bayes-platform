#!/bin/bash
# Creates the databases of a worktree environment (the db service of
# infra/worktree/docker-compose.yaml), as the admin superuser of the shared Postgres:
# - WT_DB, a copy of WT_DB_SOURCE. pg_dump works while the source is in use, unlike
#   CREATE DATABASE ... TEMPLATE. The copy is restored under a temporary name and renamed at
#   the end, so a half-restored database never takes the final name.
# - WT_DB_TEST, empty with the vector extension; the migrate service brings it up to date.
# Existing databases are left alone, except a test database that lacks a migration of the branch.
# Owner connect_admin, like the source: the branch's migrations run as connect_admin and need to
# create objects in public.
set -euo pipefail

exists() {
  [ "$(psql -X -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$1'")" = 1 ]
}

# True when a migration file of the branch has no row in the test database's history. The API's
# tests build their tables with TypeORM's synchronize, which records no migration: replaying a
# newer migration there fails on a table that synchronize already made. The test database holds
# nothing worth keeping, so it is dropped and built again from the first migration. File names
# start with the timestamp of their class, which TypeORM records.
test_db_lags() {
  local applied file timestamp
  applied=$(psql -X -d "$WT_DB_TEST" -tAc 'SELECT "timestamp" FROM migrations' 2>/dev/null) || return 0
  for file in "$WT_PATH"/apps/api/src/migrations/*.ts; do
    timestamp=$(basename "$file")
    timestamp=${timestamp%%-*}
    grep -qxF "$timestamp" <<<"$applied" || return 0
  done
  return 1
}

if ! exists "$WT_DB"; then
  restoring="${WT_DB}__restoring"
  echo "Copying ${WT_DB_SOURCE} into ${WT_DB}"
  psql -X -v ON_ERROR_STOP=1 -d postgres \
    -c "DROP DATABASE IF EXISTS \"${restoring}\" WITH (FORCE)" \
    -c "CREATE DATABASE \"${restoring}\" OWNER connect_admin"
  pg_dump -Fc -d "$WT_DB_SOURCE" | pg_restore --exit-on-error -d "$restoring"
  path_literal=$(printf '%s' "$WT_PATH" | sed "s/'/''/g")
  psql -X -v ON_ERROR_STOP=1 -d postgres \
    -c "ALTER DATABASE \"${restoring}\" RENAME TO \"${WT_DB}\"" \
    -c "COMMENT ON DATABASE \"${WT_DB}\" IS 'Worktree environment ${path_literal}, copy of ${WT_DB_SOURCE}'"
fi

if exists "$WT_DB_TEST" && test_db_lags; then
  echo "Dropping ${WT_DB_TEST}: it lacks migrations of the branch"
  psql -X -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE \"${WT_DB_TEST}\" WITH (FORCE)"
fi

if ! exists "$WT_DB_TEST"; then
  echo "Creating ${WT_DB_TEST}"
  psql -X -v ON_ERROR_STOP=1 -d postgres -c "CREATE DATABASE \"${WT_DB_TEST}\" OWNER connect_admin"
  psql -X -v ON_ERROR_STOP=1 -d "$WT_DB_TEST" -c "CREATE EXTENSION IF NOT EXISTS vector"
fi
