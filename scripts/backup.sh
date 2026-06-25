#!/bin/sh
set -euo pipefail

OUTPUT_DIR="${BACKUP_DIR:-${1:-./backups}}"
DB_URL="${DATABASE_URL:-}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

if [ -z "$DB_URL" ]; then
  echo "[BACKUP] ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$OUTPUT_DIR/medibill-backup-$TIMESTAMP.sql"

echo "[BACKUP] Starting backup -> $BACKUP_FILE"

pg_dump --no-owner --verbose --file="$BACKUP_FILE" "$DB_URL"

echo "[BACKUP] Compressing..."
gzip -f "$BACKUP_FILE"

echo "[BACKUP] Removing backups older than $RETENTION_DAYS days..."
find "$OUTPUT_DIR" -name "medibill-backup-*.sql.gz" -mtime "+$RETENTION_DAYS" -delete

ls -lh "$OUTPUT_DIR"/*.sql.gz 2>/dev/null || echo "[BACKUP] No backup files found."

echo "[BACKUP] Completed: $BACKUP_FILE.gz"
