#!/bin/bash

# Import Data Script for PinNPost (Final Working Version)
# This script imports only data from a full PostgreSQL dump

BACKUP_FILE="${1:-../../pinpost_backup.sql}"
DB_NAME="${DB_NAME:-pinpost}"
DB_USER="${DB_USER:-demo}"
DOCKER_CONTAINER="${DOCKER_CONTAINER:-pinn-db}"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "📥 Importing data from $BACKUP_FILE to $DB_NAME..."

# Import the data with foreign key checks disabled
(echo "SET session_replication_role = 'replica';"; awk '/^COPY public\./,/^\\.$/' "$BACKUP_FILE"; echo "SET session_replication_role = 'origin';") | docker exec -i "$DOCKER_CONTAINER" psql \
    -h localhost \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -v ON_ERROR_STOP=off \
    -v client_min_messages=warning \
    -f - 2>&1 | grep -v "^COPY\|^SET" || true

echo "✅ Data import completed!"
echo "🔍 Checking data counts..."

# Show data counts
docker exec -i "$DOCKER_CONTAINER" psql \
    -h localhost \
    -U "$DB_USER" \
    -d "$DB_NAME" << 'EOSQL'
SELECT
  'users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'ads', COUNT(*) FROM ads
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'bookings', COUNT(*) FROM bookings
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
ORDER BY table_name;
EOSQL

echo "✅ Import process completed!"
