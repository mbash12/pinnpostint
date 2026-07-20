# PinNPost Makefile - Alternative to ./pinn CLI
# Usage: make [target]

.PHONY: help setup build up down restart logs status deploy clean backup backup-setup restore-db restore-uploads backups-list

# Default target
help:
	@echo "╔════════════════════════════════════════════════════════════╗"
	@echo "║               PinNPost Makefile Commands                   ║"
	@echo "╠════════════════════════════════════════════════════════════╣"
	@echo "║  make setup      - Initial setup                           ║"
	@echo "║  make build      - Build all apps                          ║"
	@echo "║  make up         - Start all services                      ║"
	@echo "║  make down       - Stop all services                       ║"
	@echo "║  make restart    - Restart all services                    ║"
	@echo "║  make deploy     - Build and restart all                   ║"
	@echo "║  make logs       - View logs                               ║"
	@echo "║  make status     - Check service status                    ║"
	@echo "║  make migrate    - Run database migrations                 ║"
	@echo "║  make clean      - Clean everything                        ║"
	@echo "║  make backup     - Run database backup now                  ║"
	@echo "║  make backup-setup - Install daily cron job (2:00 AM)       ║"
	@echo "║  make backups-list - List available backups                  ║"
	@echo "║  make restore-db FILE=<file>   - Restore database           ║"
	@echo "║  make restore-uploads FILE=<file> - Restore uploads         ║"
	@echo "╚════════════════════════════════════════════════════════════╝"

# Setup
setup:
	@echo "🛠️  Setting up PinNPost..."
	@mkdir -p api/dist admin/.next mobile/dist uploads backups logs
	@(cd api && npm install)
	@(cd admin && npm install)
	@(cd mobile && npm install)
	@(cd api && npx prisma generate)
	@echo "✅ Setup complete! Edit .env and run: make up"

# Build commands
build:
	@echo "🏗️  Building all apps..."
	@(cd api && npm run build)
	@(cd admin && npm run build)
	@(cd mobile && npm run build)
	@echo "✅ Build complete!"

build-api:
	@(cd api && npm run build)
	@docker compose -f docker/docker-compose.yml restart api

build-admin:
	@(cd admin && npm run build)
	@docker compose -f docker/docker-compose.yml restart admin

build-mobile:
	@(cd mobile && npm run build)
	@docker compose -f docker/docker-compose.yml restart mobile

# Docker commands
up:
	@echo "🚀 Starting services..."
	@docker compose -f docker/docker-compose.yml up -d
	@docker compose -f docker/docker-compose.yml ps

down:
	@echo "🛑 Stopping services..."
	@docker compose -f docker/docker-compose.yml down

restart:
	@echo "🔄 Restarting services..."
	@docker compose -f docker/docker-compose.yml restart

restart-api:
	@docker compose -f docker/docker-compose.yml restart api

restart-admin:
	@docker compose -f docker/docker-compose.yml restart admin

restart-mobile:
	@docker compose -f docker/docker-compose.yml restart mobile

logs:
	@docker compose -f docker/docker-compose.yml logs -f

logs-api:
	@docker compose -f docker/docker-compose.yml logs -f api

logs-admin:
	@docker compose -f docker/docker-compose.yml logs -f admin

status:
	@docker compose -f docker/docker-compose.yml ps

# Database
migrate:
	@(cd api && npx prisma migrate dev)

migrate-deploy:
	@(cd api && npx prisma migrate deploy)

generate:
	@(cd api && npx prisma generate)

seed:
	@(cd api && npx ts-node prisma/seed.ts)

studio:
	@(cd api && npx prisma studio &)

# Deploy — recreate (not restart) so .env reloads and container layers refresh
deploy: build
	@echo "🔄 Recreating services (volumes preserved)..."
	@docker compose -f docker/docker-compose.yml up -d --force-recreate
	@echo "🎉 Deployment complete!"

deploy-api: build-api
	@docker compose -f docker/docker-compose.yml up -d --force-recreate api
	@echo "🎉 API deployed!"

deploy-admin: build-admin
	@docker compose -f docker/docker-compose.yml up -d --force-recreate admin
	@echo "🎉 Admin deployed!"

deploy-mobile: build-mobile
	@docker compose -f docker/docker-compose.yml up -d --force-recreate mobile
	@echo "🎉 Mobile deployed!"

# Clean — DESTROYS Docker volumes (database data). Prefer ./pinn heal instead.
clean:
	@echo "⚠️  This deletes Docker volumes (DATABASE DATA LOSS)."
	@echo "    Prefer: ./pinn heal   or   ./pinn recreate"
	@read -p "Type 'delete-volumes' to confirm: " confirm; \
	  if [ "$$confirm" != "delete-volumes" ]; then echo "Cancelled."; exit 1; fi
	@echo "🧹 Cleaning up..."
	@docker compose -f docker/docker-compose.yml down -v 2>/dev/null || true
	@rm -rf api/dist admin/.next mobile/dist
	@rm -rf api/node_modules admin/node_modules mobile/node_modules
	@docker system prune -f
	@echo "✅ Clean complete!"

# Backup
backup:
	@bash scripts/backup-db.sh

backup-setup:
	@chmod +x scripts/backup-db.sh
	@echo "Installing daily backup cron job (runs at 2:00 AM)..."
	@(crontab -l 2>/dev/null | grep -v 'backup-db.sh'; echo '0 2 * * * cd $(CURDIR) && bash scripts/backup-db.sh >> backups/backup.log 2>&1') | crontab -
	@echo "✅ Cron job installed. Logs will write to backups/backup.log"
	@echo "   Run 'crontab -l' to verify."

# Restore
backups-list:
	@echo "=== Database backups ==="
	@ls -lh backups/pinpost_*.sql.gz 2>/dev/null || echo "  (none)"
	@echo ""
	@echo "=== Uploads backups ==="
	@ls -lh backups/uploads_*.tar.gz 2>/dev/null || echo "  (none)"

restore-db:
	@test -n "$(FILE)" || (echo "Usage: make restore-db FILE=backups/pinpost_YYYY-MM-DD_HH-MM-SS.sql.gz" && exit 1)
	@test -f "$(FILE)" || (echo "File not found: $(FILE)" && exit 1)
	@echo "Restoring database from $(FILE)..."
	@gunzip -c "$(FILE)" | docker exec -i pinn-db psql -U demo -d pinpost
	@echo "✅ Database restored."

restore-uploads:
	@test -n "$(FILE)" || (echo "Usage: make restore-uploads FILE=backups/uploads_YYYY-MM-DD_HH-MM-SS.tar.gz" && exit 1)
	@test -f "$(FILE)" || (echo "File not found: $(FILE)" && exit 1)
	@echo "Restoring uploads from $(FILE)..."
	@tar -xzf "$(FILE)" -C .
	@echo "✅ Uploads restored."
