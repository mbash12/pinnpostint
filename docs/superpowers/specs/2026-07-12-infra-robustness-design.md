# Infra Robustness Design

**Date:** 2026-07-12  
**Branch:** `fix/infra-robustness`  
**Constraint:** ≤2GB VPS, no memory limit increases, **no data loss** (never remove Docker volumes)

## Problem

API intermittently stops working after running fine for hours/days. `./pinn down` then `./pinn up` fixes it (container recreate). Plain `restart` often does not.

Root causes identified:

1. Docker healthcheck for Postgres hardcodes `-U demo`; fragile if env drifts.
2. API `/health` always returns 200 — never checks DB — so a “zombie” API stays healthy while DB is unreachable.
3. `restart: unless-stopped` does **not** recreate on `unhealthy`; only on process exit.
4. `./pinn deploy` uses `restart`, which keeps a corrupted container layer; recreate/`down`+`up` discards it.
5. Env confusion: Docker runtime uses root `.env` only; per-app `.env.*` mislead operators.

## Goals

- Auto-recover from stuck/unhealthy containers without manual `down`/`up`.
- Make health signals truthful (DB readiness).
- Clarify which env file is authoritative.
- Keep Postgres volume and uploads intact at all times.

## Non-goals

- Raising container memory limits.
- Building proper multi-stage Docker images.
- Deleting/replacing the Makefile.

## Design

### 1. Compose hardening

- Parameterize DB healthcheck with `POSTGRES_USER` / `POSTGRES_DB`.
- Point API healthcheck at readiness that includes DB (+ Redis if cheap).
- Add small-RAM Postgres settings via `command` (`shared_buffers`, `max_connections`, etc.) without raising the 384M limit.
- Never add `down -v` or volume wipes to recovery paths.

### 2. API readiness

- Extend `/health/ready` to include `checkDatabaseHealth()` (and Redis ping if already available).
- Keep `/health` as liveness (process up) for lightweight probes.
- Compose uses `/health/ready` so Docker marks API unhealthy when DB is down.

### 3. Watchdog: recreate unhealthy

- Detect Docker `Health.Status == unhealthy` and recreate (with existing cooldown).
- After recreating `db`, also recreate `api` so Prisma/clients get a fresh process (no volume touch).
- Keep existing fatal-log / restart-loop detection.

### 4. `pinn` CLI recovery UX

- `deploy` / `deploy:*` use **recreate** instead of restart (reloads env + fresh layers).
- Add `./pinn doctor` — status + health + short recovery hints.
- Document: prefer `./pinn heal [service]` over full `down`/`up` (same effect on containers, keeps volumes).

### 5. Env clarity

- Add root `.env.example` documenting: Docker runtime = root `.env`; local/build = app `.env.development` / `.env.production`.
- Update `DEPLOY.md` with “which file to edit” and recovery section.
- Do not decrypt or rewrite encrypted app env blobs; document correct hostnames (`db`, `redis`) in the example.

## Safety

- All recovery commands: `rm -sf` container + `up -d` only — volumes stay.
- No `docker volume rm`, no `down -v`, no `db:reset` in automated paths.
- Watchdog cooldown unchanged (default 15 min) to avoid thrash.
