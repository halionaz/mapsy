#!/usr/bin/env bash
#
# Applies the real migrations to a throwaway Postgres and runs the regression
# suite against them.
#
# Deliberately not `supabase start`: this only needs Docker, so it stays runnable
# on any machine and in CI. The trade-off is that auth and storage are stubs
# (tests/00_bootstrap.sql) rather than the real services — good enough for
# constraints, RLS and the ordering functions, which is what the suite covers.

set -euo pipefail

CONTAINER="${MAPSY_PG_CONTAINER:-mapsy-pg-test}"
IMAGE="${MAPSY_PG_IMAGE:-postgres:16-alpine}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS="$HERE/../migrations"

if ! docker info >/dev/null 2>&1; then
  echo "Docker 데몬이 꺼져 있음. Docker Desktop을 실행한 뒤 다시 시도." >&2
  exit 1
fi

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

cleanup
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null

printf 'postgres 기동 대기'
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then
    printf ' 준비됨\n'
    break
  fi
  printf '.'
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 || {
  echo $'\npostgres가 뜨지 않음' >&2
  exit 1
}

apply() {
  docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q < "$1"
}

apply "$HERE/00_bootstrap.sql"

# Applied in filename order, exactly as `supabase db push` would.
for migration in "$MIGRATIONS"/*.sql; do
  echo "적용: $(basename "$migration")"
  apply "$migration"
done

apply "$HERE/01_grants.sql"
apply "$HERE/02_helpers.sql"

echo
docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 \
  < "$HERE/03_wardrobe.sql"

# Re-applying must be a no-op: a migration that fails halfway has to be
# retryable, and that property is easy to break without noticing.
echo
echo "멱등성 확인 — 마이그레이션 재실행"
for migration in "$MIGRATIONS"/*.sql; do
  apply "$migration"
done
echo "재실행 통과"
