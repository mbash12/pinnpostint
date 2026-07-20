# Infra Robustness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Docker/`pinn` recover automatically from intermittent API/DB container failure on a ≤2GB VPS without data loss, and clarify env ownership.

**Architecture:** Truthful readiness healthchecks → Docker marks unhealthy → watchdog recreates containers (not volumes) → `pinn deploy` uses recreate. Env docs + `.env.example` as source of truth for operators.

**Tech Stack:** Docker Compose, bash (`pinn`, watchdog), Express health routes, Prisma, Postgres Alpine.

---

### Task 1: Compose health + small-RAM Postgres

**Files:**
- Modify: `docker/docker-compose.yml`

- [ ] **Step 1:** Parameterize DB healthcheck; add small-RAM postgres `-c` flags; switch API healthcheck to `/health/ready`.
- [ ] **Step 2:** Verify compose config parses: `docker compose -f docker/docker-compose.yml config >/dev/null`
- [ ] **Step 3:** Commit

### Task 2: API readiness includes DB

**Files:**
- Modify: `api/src/app.ts`
- Modify: `api/src/utils/database.ts` (only if needed for export/reuse)

- [ ] **Step 1:** In `/health/ready`, call `checkDatabaseHealth()`; return 503 if DB down.
- [ ] **Step 2:** Keep `/health` as liveness-only.
- [ ] **Step 3:** Commit

### Task 3: Watchdog recreates unhealthy + cascade API after DB

**Files:**
- Modify: `docker/container-watchdog.sh`

- [ ] **Step 1:** Inspect `{{.State.Health.Status}}`; recreate when `unhealthy`.
- [ ] **Step 2:** After successful `db` recreate, recreate `api` (volume-safe).
- [ ] **Step 3:** Commit

### Task 4: `pinn` deploy recreate + doctor

**Files:**
- Modify: `pinn`
- Modify: `DEPLOY.md`

- [ ] **Step 1:** Change `cmd_deploy` / `cmd_deploy_app` to use recreate instead of restart.
- [ ] **Step 2:** Add `cmd_doctor` (ps + health hints + heal suggestion).
- [ ] **Step 3:** Wire `doctor` in help + main case; update DEPLOY.md recovery/env section.
- [ ] **Step 4:** Commit

### Task 5: `.env.example` + gitignore worktrees

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`
- Modify: `DEPLOY.md` (if not done)

- [ ] **Step 1:** Add documented example with `db`/`redis` hostnames and file-ownership notes.
- [ ] **Step 2:** Ensure `.worktrees/` ignored.
- [ ] **Step 3:** Commit

### Task 6: Verify safety

- [ ] Confirm no `down -v`, no volume rm in changed scripts.
- [ ] `bash -n pinn` and `bash -n docker/container-watchdog.sh`
- [ ] Summarize deploy steps for server (pull branch, recreate, install watchdog).
