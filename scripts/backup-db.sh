#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${PROJECT_DIR}/backups"
UPLOADS_DIR="${PROJECT_DIR}/api/uploads"
DB_CONTAINER="pinn-db"
DB_USER="${POSTGRES_USER:-demo}"
DB_NAME="${POSTGRES_DB:-pinpost}"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
DB_KEEP_DAYS="${DB_KEEP_DAYS:-30}"
UPLOADS_KEEP_DAYS="${UPLOADS_KEEP_DAYS:-3}"

mkdir -p "$BACKUP_DIR"

# --- Database backup ---
DB_FILE="${BACKUP_DIR}/pinpost_${DATE}.sql.gz"
echo "[$(date)] Starting backup of database '$DB_NAME'..."
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges | gzip > "$DB_FILE"
echo "[$(date)] Database backup saved: $(du -h "$DB_FILE" | cut -f1)"

# --- Uploads backup ---
UPLOADS_FILE="${BACKUP_DIR}/uploads_${DATE}.tar.gz"
if [ -d "$UPLOADS_DIR" ]; then
  echo "[$(date)] Backing up uploads..."
  tar -czf "$UPLOADS_FILE" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")"
  echo "[$(date)] Uploads backup saved: $(du -h "$UPLOADS_FILE" | cut -f1)"
else
  echo "[$(date)] Warning: uploads directory not found at $UPLOADS_DIR, skipping."
fi

# --- Prune old backups ---
DB_PRUNED=$(find "$BACKUP_DIR" -name "pinpost_*.sql.gz" -mtime +$DB_KEEP_DAYS -print -delete | wc -l)
UPLOADS_PRUNED=$(find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +$UPLOADS_KEEP_DAYS -print -delete | wc -l)
if [ "$DB_PRUNED" -gt 0 ]; then
  echo "[$(date)] Pruned $DB_PRUNED DB backup(s) older than $DB_KEEP_DAYS days."
fi
if [ "$UPLOADS_PRUNED" -gt 0 ]; then
  echo "[$(date)] Pruned $UPLOADS_PRUNED uploads backup(s) older than $UPLOADS_KEEP_DAYS days."
fi

echo "[$(date)] Backup complete."
