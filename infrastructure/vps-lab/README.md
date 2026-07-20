# Small-VPS lab (2GB Vagrant) — **real** stack tests

Uses production `docker/docker-compose.yml` + real API `dist` (not a mock).
Only `db`, `redis`, and `api` are started — admin/nginx/mobile exceed 2GB with
production memory limits.

## Run

```bash
cd infrastructure/vps-lab
vagrant up
vagrant provision   # if provision.sh changed
vagrant ssh -c 'sudo /opt/pinnpostint/infrastructure/vps-lab/test-real.sh'
```

Requires plaintext root `.env` (Docker hostnames `db` / `redis`) and a rebuilt
`api/dist` that includes `/health/ready` DB checks.

If the VM cannot pull images, load from the host:

```bash
docker save postgres:15-alpine redis:7-alpine node:20-alpine \
  -o infrastructure/vps-lab/.cache/images.tar
vagrant ssh -c 'sudo docker load -i /opt/pinnpostint/infrastructure/vps-lab/.cache/images.tar'
```

## What `test-real.sh` verifies

1. Real healthchecks + small-RAM Postgres flags  
2. API goes unhealthy when DB is paused  
3. Watchdog ordered heal + DB→API cascade  
4. Marker row survives recreate (no volume wipe)  
5. `up -d --no-deps` heal path  
6. ApacheBench load against `/health` under memory pressure  

## Pre-expiry SMS — real VM clock jump

This is the test that matches “change the date in Vagrant, let the real app send SMS”
(no direct `sendAdWillExpireNotification` / no fake `now` injection).

Containers share the VM kernel clock, so `date -s` in the guest moves `new Date()`
inside `pinn-api` and Bull’s cron window.

```bash
# On host — dist must include pre-expiry dedup fix
yarn --cwd api build

cd infrastructure/vps-lab
vagrant up
vagrant ssh -c 'sudo /opt/pinnpostint/infrastructure/vps-lab/test-real.sh'

# Faster (recommended first run): enqueue the same Bull job cron would fire
vagrant ssh -c 'sudo WAIT_CRON=0 TEST_SMS_PHONE=7777777777 /opt/pinnpostint/infrastructure/vps-lab/test-pre-expiry-clock.sh'

# Slowest / most realistic: wait for */10 cron in UTC hours 2–3
vagrant ssh -c 'sudo WAIT_CRON=1 /opt/pinnpostint/infrastructure/vps-lab/test-pre-expiry-clock.sh'
```

Flow: seed APPROVED ad → jump VM clock to each lead morning (15/13/10) →
Bull → worker → handler time-gate → notification-delivery → outbox → SMS provider →
renew cycle and assert 10d is not blocked → restore NTP/clock.
