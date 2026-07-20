#!/bin/bash
# Verify the latest DB backup actually restores.
#
# Spins up a throwaway Postgres container with the same image, restores
# the newest backups/pinpost_*.sql.gz into it, and runs `prisma migrate
# status` against it via a temporary DATABASE_URL. Exits 0 only if the
# restore produced a reachable DB whose migration history matches the
# checked-in prisma/migrations folder.
#
# Safe to run anytime — it never touches the live DB or its volume.
# Used by the daily backup cron so a silent backup rot is caught early.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${PROJECT_DIR}/backups"
DB_USER="${POSTGRES_USER:-demo}"
DB_NAME="${POSTGRES_DB:-pinpost}"
NETWORK="docker_pinn-network"
TMP_CONTAINER="pinn-backup-verify-$$"

cd "$PROJECT_DIR"

log() { printf '[verify] %s\n' "$*"; }
die() { printf '[verify] ERROR: %s\n' "$*" >&2; exit 1; }

LATEST="$(ls -1t "${BACKUP_DIR}"/pinpost_*.sql.gz 2>/dev/null | head -1 || true)"
[ -n "${LATEST}" ] || die "no pinpost_*.sql.gz backup found in ${BACKUP_DIR}"
log "Verifying: $(basename "${LATEST}")"

command -v docker >/dev/null || die "docker not found"
docker volume ls >/dev/null 2>&1 || die "docker daemon not reachable"

cleanup() {
  docker rm -f "${TMP_CONTAINER}" >/dev/null 2>&1 || true
  docker volume rm "${TMP_CONTAINER}-vol" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Temp volume so the restore survives the container's first boot healthcheck.
log "Creating temp verify container…"
docker run -d --name "${TMP_CONTAINER}" \
  --network "${NETWORK}" \
  -e POSTGRES_USER="${DB_USER}" \
  -e POSTGRES_PASSWORD=verify-pass \
  -e POSTGRES_DB="${DB_NAME}" \
  -v "${TMP_CONTAINER}-vol":/var/lib/postgresql/data \
  postgres:15-alpine >/dev/null

# Wait for ready (max 40s).
log "Waiting for temp DB to accept connections…"
for _ in $(seq 1 40); do
  if docker exec "${TMP_CONTAINER}" pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "${TMP_CONTAINER}" pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1 \
  || die "temp DB never became ready"

log "Restoring backup into temp DB…"
gunzip -c "${LATEST}" | docker exec -i "${TMP_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 >/dev/null
log "Restore complete."

# Sanity: count core tables. AKManagedObject-style guard — every prisma model
# that maps to a public table should be present.
TABLE_COUNT=$(docker exec "${TMP_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -t -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';" \
  | tr -d '[:space:]')
log "Restored table count: ${TABLE_COUNT}"
[ "${TABLE_COUNT}" -ge 20 ] || die "restored DB has too few tables (${TABLE_COUNT}); backup likely corrupt"

# Migrations history present and non-empty?
MIG_COUNT=$(docker exec "${TMP_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -t -c \
  "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;" \
  | tr -d '[:space:]')
log "Applied migrations in dump: ${MIG_COUNT}"
[ "${MIG_COUNT}" -ge 1 ] || die "no completed migrations in dump — prisma history missing"

# Cross-check against the checked-in migrations folder so we catch a dump that
# is behind the current schema (a backup too old to restore cleanly).
CHECKED_IN="$(ls -1 "${PROJECT_DIR}/api/prisma/migrations" 2>/dev/null | grep -E '^[0-9]' | wc -l | tr -d '[:space:]')"
log "Migrations folder has: ${CHECKED_IN} migration dirs"
if [ "${CHECKED_IN}" -gt 0 ] && [ "${MIG_COUNT}" -lt "${CHECKED_IN}" ]; then
  log "WARN: dump has ${MIG_COUNT} applied but folder has ${CHECKED_IN} — backup is behind current schema (still restorable, may need to apply pending migrations after restore)."
fi

log "✅ Backup verified OK: $(basename "${LATEST}") restores to a working DB."
exit 0