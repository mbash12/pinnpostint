#!/bin/bash

# PinNPost Clean Migration Deployment Script
# This script deploys the new clean migration system to your server

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/pinpost_backup_before_migration_$TIMESTAMP.sql"

echo "========================================"
echo "🚀 PinNPost Clean Migration Deployment"
echo "========================================"
echo ""

# Check if we're in the api directory
if [ ! -f "prisma/schema.prisma" ]; then
    echo -e "${RED}❌ Error: Please run this script from the api directory${NC}"
    echo "Usage: cd api && ./scripts/deploy-clean-migrations.sh"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}📋 Step 1: Backup current database${NC}"
echo "Creating backup: $BACKUP_FILE"
docker exec -i pinn-db pg_dump -U demo pinpost > "$BACKUP_FILE"
echo -e "${GREEN}✅ Backup created successfully ($(du -h "$BACKUP_FILE" | cut -f1))${NC}"
echo ""

echo -e "${YELLOW}📋 Step 2: Reset database${NC}"
echo "Dropping and recreating database..."
docker exec -i pinn-db psql -U postgres << 'EOF'
DROP DATABASE IF EXISTS pinpost;
CREATE DATABASE pinpost;
GRANT ALL PRIVILEGES ON DATABASE pinpost TO demo;
EOF
echo -e "${GREEN}✅ Database reset successfully${NC}"
echo ""

echo -e "${YELLOW}📋 Step 3: Apply clean migration${NC}"
echo "Applying migration..."
npx prisma migrate deploy
echo -e "${GREEN}✅ Migration applied successfully${NC}"
echo ""

echo -e "${YELLOW}📋 Step 4: Import data${NC}"
echo "Importing data from backup..."
if [ -f "../../pinpost_backup.sql" ]; then
    ./scripts/import-data-final.sh ../../pinpost_backup.sql
elif [ -f "../pinpost_backup.sql" ]; then
    ./scripts/import-data-final.sh ../pinpost_backup.sql
elif [ -f "pinpost_backup.sql" ]; then
    ./scripts/import-data-final.sh pinpost_backup.sql
else
    echo -e "${RED}❌ Error: Could not find pinpost_backup.sql file${NC}"
    echo "Please ensure the backup file is in the project root or api directory"
    exit 1
fi
echo -e "${GREEN}✅ Data imported successfully${NC}"
echo ""

echo -e "${YELLOW}📋 Step 5: Generate Prisma client${NC}"
echo "Generating Prisma client..."
npx prisma generate
echo -e "${GREEN}✅ Prisma client generated${NC}"
echo ""

echo -e "${YELLOW}📋 Step 6: Verify migration status${NC}"
npx prisma migrate status
echo ""

echo "========================================"
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo "========================================"
echo ""
echo "📊 Next steps:"
echo "  1. Test the application: npm run start:dev"
echo "  2. Verify data integrity: Check a few records"
echo "  3. Monitor performance: Check query speeds"
echo ""
echo "📁 Backup saved at: $BACKUP_FILE"
echo ""
echo "⚠️  Important notes:"
echo "  - Keep the backup file safe until you verify everything works"
echo "  - If you encounter issues, you can restore from the backup"
echo "  - The backup file contains ALL your data"
echo ""
