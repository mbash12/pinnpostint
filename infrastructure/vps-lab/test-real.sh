#!/usr/bin/env bash
# Real-stack recovery + load test inside the Vagrant 2GB VM.
# Uses production docker/docker-compose.yml + real API dist (db+redis+api only).
# Admin/nginx/mobile omitted — they do not fit with production memory limits on 2GB.
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/pinnpostint}"
COMPOSE_FILE="$REPO_ROOT/docker/docker-compose.yml"
WATCHDOG="$REPO_ROOT/docker/container-watchdog.sh"
PINN="$REPO_ROOT/pinn"
SERVICES=(db redis api)

export COMPOSE_FILE
export WATCHDOG_STATE_DIR="${WATCHDOG_STATE_DIR:-/var/lib/pinn-watchdog-lab}"
export WATCHDOG_LOG_FILE="${WATCHDOG_LOG_FILE:-/var/log/pinn-watchdog-lab.log}"
export WATCHDOG_COOLDOWN_SEC="${WATCHDOG_COOLDOWN_SEC:-5}"

PASS=0
FAIL=0
ok()   { echo "  ✅ $1"; PASS=$((PASS + 1)); }
bad()  { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }
info() { echo ""; echo "→ $1"; }

dc() {
  docker compose -f "$COMPOSE_FILE" --project-directory "$REPO_ROOT/docker" "$@"
}

wait_healthy() {
  local name="$1" tries="${2:-60}"
  local i health
  for ((i = 1; i <= tries; i++)); do
    health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$name" 2>/dev/null || echo missing)"
    if [[ "$health" == "healthy" ]]; then
      return 0
    fi
    sleep 5
  done
  echo "timeout waiting for $name healthy (last=$health)" >&2
  return 1
}

api_ready() {
  docker exec pinn-api wget -qO- "http://127.0.0.1:${API_PORT:-3001}/health/ready" 2>/dev/null \
    | grep -q '"success":true'
}

load_test() {
  local url="http://127.0.0.1:${API_PORT:-3001}/health"
  # Modest concurrency for 2GB — API heap capped ~400MB in compose.
  local conc="${LOAD_CONCURRENCY:-8}"
  local reqs="${LOAD_REQUESTS:-200}"
  info "Load test: $reqs requests, concurrency $conc → $url"
  if command -v ab >/dev/null 2>&1; then
    sleep 3
    # -l: /health body length varies (uptime/memory) — not real errors
    ab -l -n "$reqs" -c "$conc" -s 30 -q "$url" | tee /tmp/pinn-load-ab.txt | tail -25
    local failed complete non2xx
    failed="$(awk '/Failed requests/{print $3}' /tmp/pinn-load-ab.txt)"
    complete="$(awk '/Complete requests/{print $3}' /tmp/pinn-load-ab.txt)"
    non2xx="$(awk '/Non-2xx responses/{print $3}' /tmp/pinn-load-ab.txt)"
    [[ "${complete:-0}" == "$reqs" ]] && ok "ab completed $complete/$reqs" || bad "ab completed ${complete:-0}/$reqs"
    if [[ -n "${non2xx}" && "${non2xx}" != "0" ]]; then
      bad "ab non-2xx = ${non2xx}"
    else
      ok "ab non-2xx = 0"
    fi
    if [[ "${failed:-0}" -gt $((reqs / 10)) ]]; then
      bad "ab failed requests = ${failed} (>10% of $reqs)"
    else
      ok "ab failed requests = ${failed:-0} (within 10% tolerance on 2GB)"
    fi
  else
    local i code fails=0
    for ((i = 1; i <= reqs; i++)); do
      code="$(curl -s -o /dev/null -w '%{http_code}' "$url" || echo 000)"
      [[ "$code" == "200" ]] || fails=$((fails + 1))
    done
    [[ "$fails" -eq 0 ]] && ok "curl load: $reqs/200 OK" || bad "curl load failures=$fails/$reqs"
  fi
  api_ready && ok "API ready after load" || bad "API not ready after load"
}

mkdir -p "$WATCHDOG_STATE_DIR" "$REPO_ROOT/logs/api" "$REPO_ROOT/api/uploads" "$REPO_ROOT/backups"
chmod +x "$WATCHDOG" "$PINN" || true

# Source ports from .env without printing secrets
API_PORT="$(grep -E '^API_PORT=' "$REPO_ROOT/.env" | cut -d= -f2- | tr -d '\r' || true)"
POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "$REPO_ROOT/.env" | cut -d= -f2- | tr -d '\r' || true)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "$REPO_ROOT/.env" | cut -d= -f2- | tr -d '\r' || true)"
API_PORT="${API_PORT:-3001}"
POSTGRES_USER="${POSTGRES_USER:-demo}"
POSTGRES_DB="${POSTGRES_DB:-pinpost}"

info "0) Preconditions"
bash -n "$PINN" && ok "pinn syntax" || bad "pinn syntax"
bash -n "$WATCHDOG" && ok "watchdog syntax" || bad "watchdog syntax"
test -f "$REPO_ROOT/api/dist/src/server.js" && ok "real API dist present" || bad "missing api/dist"
test -d "$REPO_ROOT/api/node_modules" && ok "api node_modules present" || bad "missing node_modules"
grep -q 'checkDatabaseHealth' "$REPO_ROOT/api/dist/src/app.js" && ok "dist includes DB readiness" || bad "rebuild API — dist missing checkDatabaseHealth"
grep -qE '^[A-Z0-9_]+=' "$REPO_ROOT/.env" && ok "root .env is plaintext dotenv" || bad "root .env still encrypted?"

info "1) Start real stack: ${SERVICES[*]}"
# Compose interpolates ${POSTGRES_*}/${REDIS_*} from the shell — NOT from env_file.
# Export only the keys needed for interpolation (never source the whole .env).
export_env_key() {
  local key="$1" line
  line="$(grep -E "^${key}=" "$REPO_ROOT/.env" | tail -1 || true)"
  if [[ -n "$line" ]]; then
    export "$line"
  fi
}
export_env_key POSTGRES_USER
export_env_key POSTGRES_PASSWORD
export_env_key POSTGRES_DB
export_env_key REDIS_PASSWORD
export_env_key API_PORT
export_env_key ADMIN_PORT
export_env_key MOBILE_PORT
export_env_key NEXT_PUBLIC_API_URL
# Fresh lab volumes so DB init user matches DATABASE_URL (lab-only data)
dc down -v >/dev/null 2>&1 || true
dc up -d --pull never "${SERVICES[@]}"
wait_healthy pinn-db
wait_healthy pinn-redis
wait_healthy pinn-api
ok "db/redis/api healthy"

info "2) Migrate schema (prisma deploy)"
NET="$(docker inspect pinn-db -f '{{range $k, $_ := .NetworkSettings.Networks}}{{$k}}{{end}}' | awk '{print $1}')"
DBURL="$(grep -E '^DATABASE_URL=' "$REPO_ROOT/.env" | cut -d= -f2-)"
docker run --rm --network "$NET" \
  -v "$REPO_ROOT/api:/app" -w /app \
  -e DATABASE_URL="$DBURL" \
  node:20-alpine \
  sh -c 'npx --yes prisma@6.16.2 migrate deploy' \
  && ok "prisma migrate deploy" || bad "prisma migrate deploy failed"

info "3) Marker row (data-loss check)"
docker exec -i pinn-db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS lab_marker (id int primary key, note text);
INSERT INTO lab_marker (id, note) VALUES (1, 'keep-me')
  ON CONFLICT (id) DO UPDATE SET note = EXCLUDED.note;
SQL
COUNT="$(docker exec pinn-db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT count(*) FROM lab_marker WHERE note='keep-me'")"
[[ "$COUNT" == "1" ]] && ok "marker written" || bad "marker write failed"

info "4) Compose sanity (real file)"
CFG="$(dc config)"
echo "$CFG" | grep -q 'health/ready' && ok "API healthcheck → /health/ready" || bad "wrong API health path"
echo "$CFG" | grep -q 'shared_buffers=64MB' && ok "small-RAM postgres tuning" || bad "missing postgres tuning"
echo "$CFG" | grep -q 'pg_isready' && ok "parameterized pg_isready" || bad "pg_isready missing"

info "5) Readiness gate: pause DB → API unhealthy"
docker pause pinn-db
UNHEALTHY=0
LAST=unknown
for _ in $(seq 1 36); do
  LAST="$(docker inspect -f '{{.State.Health.Status}}' pinn-api 2>/dev/null || echo missing)"
  if [[ "$LAST" == "unhealthy" ]]; then
    UNHEALTHY=1
    break
  fi
  sleep 5
done
[[ "$UNHEALTHY" -eq 1 ]] && ok "API became unhealthy (DB paused)" || bad "API stayed $LAST"

info "6) Unpause + watchdog heal (ordered db→api cascade)"
docker unpause pinn-db
rm -f "$WATCHDOG_STATE_DIR"/*.last_recreate
# Give DB a moment, then force another unhealthy cycle if API already recovered
sleep 5
if [[ "$(docker inspect -f '{{.State.Health.Status}}' pinn-api 2>/dev/null)" != "unhealthy" ]]; then
  docker pause pinn-db
  sleep 25
  docker unpause pinn-db
fi
bash "$WATCHDOG" || true
sleep 10
wait_healthy pinn-db 48
wait_healthy pinn-api 48
api_ready && ok "API ready after watchdog" || bad "API not ready after watchdog"

info "7) Data preserved"
COUNT="$(docker exec pinn-db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT count(*) FROM lab_marker WHERE note='keep-me'")"
[[ "$COUNT" == "1" ]] && ok "marker intact (no data loss)" || bad "DATA LOSS marker missing"

info "8) pinn heal api (--no-deps path)"
cd "$REPO_ROOT"
# Non-interactive heal single service
docker compose -f "$COMPOSE_FILE" rm -sf api >/dev/null
docker compose -f "$COMPOSE_FILE" up -d --no-deps api >/dev/null
wait_healthy pinn-api 48
api_ready && ok "heal --no-deps restored API" || bad "heal path failed"

info "9) Load test under 2GB pressure"
load_test

info "10) Memory snapshot"
free -h || true
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}' || true
COUNT="$(docker exec pinn-db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT count(*) FROM lab_marker WHERE note='keep-me'")"
[[ "$COUNT" == "1" ]] && ok "marker intact after load" || bad "marker lost after load"

echo ""
echo "=============================="
echo "Results: $PASS passed, $FAIL failed"
echo "=============================="
[[ "$FAIL" -eq 0 ]]
