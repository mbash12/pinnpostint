#!/usr/bin/env bash
# ============================================================================
# Pinnpost container watchdog
# ----------------------------------------------------------------------------
# Detects containers that are stuck in bad states that a simple `docker restart`
# cannot fix (e.g. corrupted overlay layer -> "permission denied" on entrypoint,
# "exec format error", ContainerCannotRun, or endless Restarting loop) and
# recreates them with `docker compose rm -sf && up -d`, which discards the
# broken writable layer.
#
# Designed to be invoked every 1-2 minutes by systemd timer or cron.
#
# Safe to run on healthy systems: it is a no-op when everything is fine.
# ============================================================================

set -uo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# Resolve repo root (this file lives in <repo>/docker/)
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." &>/dev/null && pwd)"
# Allow lab/tests to point at an alternate compose file without editing the script.
COMPOSE_FILE="${COMPOSE_FILE:-${SCRIPT_DIR}/docker-compose.yml}"

# Services the watchdog manages. Names must match both the compose service name
# and the container_name (see docker-compose.yml).
declare -A SERVICES=(
  [api]=pinn-api
  [admin]=pinn-admin
  [mobile]=pinn-mobile
  [nginx]=pinn-nginx
  [db]=pinn-db
  [redis]=pinn-redis
)

# State / log dir (persisted between runs so we can rate-limit)
STATE_DIR="${WATCHDOG_STATE_DIR:-/var/lib/pinn-watchdog}"
LOG_FILE="${WATCHDOG_LOG_FILE:-/var/log/pinn-watchdog.log}"

# How many restarts within the inspect window before we consider a container
# "stuck" and recreate it.
RESTART_THRESHOLD="${WATCHDOG_RESTART_THRESHOLD:-3}"

# Do not recreate the same container more than once every N seconds (rate-limit
# so we don't hammer Docker during a real outage / bad deploy).
RECREATE_COOLDOWN_SEC="${WATCHDOG_COOLDOWN_SEC:-900}"   # 15 min

# Disk/inode warning thresholds for /var/lib/docker (the usual root cause).
DISK_WARN_PCT="${WATCHDOG_DISK_WARN_PCT:-85}"
INODE_WARN_PCT="${WATCHDOG_INODE_WARN_PCT:-85}"

# Log patterns that strongly indicate a corrupted container layer. Any match
# triggers an immediate recreate (bypassing restart-count threshold).
FATAL_LOG_PATTERNS=(
  "exec .*: permission denied"
  "exec format error"
  "no such file or directory.*docker-entrypoint"
  "OCI runtime create failed"
  "failed to create shim task"
  "container_linux.go.*starting container process caused"
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

mkdir -p "${STATE_DIR}" 2>/dev/null || true
touch "${LOG_FILE}" 2>/dev/null || LOG_FILE=/dev/null

log() {
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  printf '[%s] %s\n' "${ts}" "$*" | tee -a "${LOG_FILE}"
}

have() { command -v "$1" &>/dev/null; }

dc() {
  # Prefer `docker compose` (v2); fall back to `docker-compose` (v1).
  if docker compose version &>/dev/null; then
    docker compose -f "${COMPOSE_FILE}" "$@"
  else
    docker-compose -f "${COMPOSE_FILE}" "$@"
  fi
}

container_state()       { docker inspect -f '{{.State.Status}}'        "$1" 2>/dev/null || echo missing; }
container_restartcount() { docker inspect -f '{{.RestartCount}}'        "$1" 2>/dev/null || echo 0; }
container_exitcode()    { docker inspect -f '{{.State.ExitCode}}'      "$1" 2>/dev/null || echo 0; }
container_started_at()  { docker inspect -f '{{.State.StartedAt}}'     "$1" 2>/dev/null || echo ""; }
container_health()      { docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$1" 2>/dev/null || echo none; }

log_matches_fatal() {
  local name="$1" logs
  logs="$(docker logs --tail 50 "${name}" 2>&1 || true)"
  for pat in "${FATAL_LOG_PATTERNS[@]}"; do
    if grep -qE "${pat}" <<<"${logs}"; then
      log "  ↳ fatal log pattern matched: /${pat}/"
      return 0
    fi
  done
  return 1
}

cooldown_ok() {
  local key="$1"
  local stamp_file="${STATE_DIR}/${key}.last_recreate"
  [[ -f "${stamp_file}" ]] || return 0
  local last now
  last="$(cat "${stamp_file}" 2>/dev/null || echo 0)"
  now="$(date +%s)"
  (( now - last >= RECREATE_COOLDOWN_SEC ))
}

mark_recreated() {
  local key="$1"
  date +%s >"${STATE_DIR}/${key}.last_recreate"
}

recreate_service() {
  local svc="$1" name="$2" reason="$3"
  # Optional 4th arg: "force" bypasses cooldown (used for DB→API cascade).
  local force="${4:-}"

  if [[ "${force}" != "force" ]] && ! cooldown_ok "${svc}"; then
    log "SKIP recreate ${svc} (${name}): cooldown active (${RECREATE_COOLDOWN_SEC}s). Reason was: ${reason}"
    return 2
  fi

  log "RECREATE ${svc} (${name}) — reason: ${reason}"

  # rm -sf stops + removes the container, which throws away the corrupted
  # overlay upper layer. `up -d --no-deps` recreates it from the image without
  # requiring sibling deps to already be healthy (avoids: rm api → up fails
  # because db is unhealthy → API stuck missing).
  # Volumes are NEVER removed — data stays intact.
  if dc rm -sf "${svc}" >>"${LOG_FILE}" 2>&1 \
     && dc up -d --no-deps "${svc}" >>"${LOG_FILE}" 2>&1; then
    mark_recreated "${svc}"
    log "  ↳ ${svc} recreated OK"
    return 0
  else
    log "  ↳ ${svc} recreate FAILED (see ${LOG_FILE})"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# Disk / inode guard on /var/lib/docker
# ---------------------------------------------------------------------------

check_docker_storage() {
  local target=/var/lib/docker
  [[ -d "${target}" ]] || return 0

  local disk_pct inode_pct
  disk_pct="$(df -P "${target}" | awk 'NR==2{gsub("%","",$5); print $5}')"
  inode_pct="$(df -Pi "${target}" | awk 'NR==2{gsub("%","",$5); print $5}')"

  if [[ "${disk_pct}" =~ ^[0-9]+$ ]] && (( disk_pct >= DISK_WARN_PCT )); then
    log "WARN /var/lib/docker is ${disk_pct}% full (threshold ${DISK_WARN_PCT}%)."
    log "     This is the #1 cause of corrupted container layers."
    log "     Consider: docker system prune -af  (do NOT use --volumes — that deletes DB data)"
  fi

  if [[ "${inode_pct}" =~ ^[0-9]+$ ]] && (( inode_pct >= INODE_WARN_PCT )); then
    log "WARN /var/lib/docker inode usage is ${inode_pct}% (threshold ${INODE_WARN_PCT}%)."
  fi
}

# ---------------------------------------------------------------------------
# Per-service check
# ---------------------------------------------------------------------------

check_service() {
  local svc="$1" name="$2"
  local state rc exit_code health
  state="$(container_state "${name}")"
  rc="$(container_restartcount "${name}")"
  exit_code="$(container_exitcode "${name}")"
  health="$(container_health "${name}")"

  case "${state}" in
    running)
      # Docker does not auto-recreate on unhealthy — only on process exit.
      # Unhealthy + cooldown → recreate (fixes zombie API / stuck DB without touching volumes).
      if [[ "${health}" == "unhealthy" ]]; then
        log "DETECT ${name}: state=running health=unhealthy"
        recreate_service "${svc}" "${name}" "health=unhealthy"
        local rc_recreate=$?
        # Fresh DB process → cascade API so Prisma gets a clean process too.
        if [[ "${svc}" == "db" && "${rc_recreate}" -eq 0 ]]; then
          log "CASCADE recreate api after db heal (force, bypass cooldown)"
          recreate_service "api" "pinn-api" "cascade after db recreate" "force" || true
        fi
        return 0
      fi
      # Even while "running", a container stuck in a fast restart loop can
      # spit fatal exec errors. Check the tail of its logs.
      if log_matches_fatal "${name}"; then
        recreate_service "${svc}" "${name}" "fatal pattern in logs while state=running"
      fi
      ;;
    restarting)
      log "DETECT ${name}: state=restarting restarts=${rc} last_exit=${exit_code}"
      if log_matches_fatal "${name}" || (( rc >= RESTART_THRESHOLD )); then
        recreate_service "${svc}" "${name}" \
          "state=restarting restarts=${rc} exit=${exit_code}"
      fi
      ;;
    exited|dead|created)
      log "DETECT ${name}: state=${state} restarts=${rc} exit=${exit_code}"
      # Exit code 0 = clean stop, leave it alone.
      if [[ "${exit_code}" != "0" ]]; then
        recreate_service "${svc}" "${name}" \
          "state=${state} exit=${exit_code}"
      fi
      ;;
    missing)
      log "DETECT ${name}: container missing — bringing it up"
      if cooldown_ok "${svc}"; then
        if dc up -d --no-deps "${svc}" >>"${LOG_FILE}" 2>&1; then
          mark_recreated "${svc}"
          log "  ↳ ${svc} brought up OK"
        else
          log "  ↳ ${svc} up FAILED (see ${LOG_FILE})"
        fi
      fi
      ;;
    *)
      # paused / other — leave alone
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

main() {
  if ! have docker; then
    log "ERROR docker CLI not found, aborting"
    exit 1
  fi
  if [[ ! -f "${COMPOSE_FILE}" ]]; then
    log "ERROR compose file not found: ${COMPOSE_FILE}"
    exit 1
  fi

  # Lock so two runs can't collide (e.g. slow recreate overlapping next tick).
  exec 9>"${STATE_DIR}/watchdog.lock"
  if ! flock -n 9; then
    log "SKIP: another watchdog run is in progress"
    exit 0
  fi

  check_docker_storage

  # Order matters: heal foundations before dependents so cascade works and
  # we never leave API missing because db was still unhealthy.
  local SERVICE_ORDER=(db redis api admin mobile nginx)
  local svc
  for svc in "${SERVICE_ORDER[@]}"; do
    [[ -n "${SERVICES[$svc]+x}" ]] || continue
    check_service "${svc}" "${SERVICES[$svc]}"
  done
}

main "$@"
