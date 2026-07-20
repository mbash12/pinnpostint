#!/usr/bin/env bash
# =============================================================================
# Pre-expiry SMS — REAL clock jump inside Vagrant (no direct method calls)
# =============================================================================
#
# How it works:
#   1. Real stack: db + redis + api (production compose)
#   2. Seed N APPROVED ads with a FIXED expiresAt (AD_COUNT, default 1)
#   3. Disable NTP and set the *VM* system clock to ~8 AM IST on the day
#      that is 15 / 13 / 10 days before expiry (containers share the kernel clock)
#   4. Wait for Bull cron OR enqueue the same job type the cron fires
#      (ad-expiration-reminder) — Bull → worker → outbox → SMS provider
#   5. Assert outgoing_sms rows with meta.reminderDays for EVERY seeded ad
#   6. Renew expiresAt, jump clock again, prove 10d is NOT blocked by prior cycle
#   7. Restore the VM clock
#
# Prerequisites (on the host):
#   cd api && yarn build
#   cd infrastructure/vps-lab && vagrant up
#   vagrant ssh -c 'sudo /opt/pinnpostint/infrastructure/vps-lab/test-real.sh'  # optional
#
# Run (inside the VM):
#   vagrant ssh -c 'sudo bash /opt/pinnpostint/infrastructure/vps-lab/test-pre-expiry-clock.sh'
#   vagrant ssh -c 'sudo AD_COUNT=3 WAIT_CRON=0 bash .../test-pre-expiry-clock.sh'
#
# Env knobs:
#   TEST_SMS_PHONE=7777777777
#   AD_COUNT=3            # how many ads to seed (default 1)
#   WAIT_CRON=1           # wait for natural cron tick (default)
#   WAIT_CRON=0           # enqueue same Bull job cron would (faster; still real path)
#   CRON_WAIT_SEC=700
#   SKIP_RESTORE=1
# =============================================================================
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/opt/pinnpostint}"
PHONE="${TEST_SMS_PHONE:-7777777777}"
WAIT_CRON="${WAIT_CRON:-1}"
CRON_WAIT_SEC="${CRON_WAIT_SEC:-700}"
AD_COUNT="${AD_COUNT:-1}"
LEAD_DAYS=(15 13 10)

AD_IDS=()
USER_IDS=()

PASS=0
ok()   { echo "  ✅ $1"; PASS=$((PASS + 1)); }
bad()  { echo "  ❌ $1"; exit 1; }
info() { echo ""; echo "→ $1"; }

psql_db() {
  local user db
  user="$(grep -E '^POSTGRES_USER=' "$REPO_ROOT/.env" | cut -d= -f2- | tr -d '\r' || true)"
  db="$(grep -E '^POSTGRES_DB=' "$REPO_ROOT/.env" | cut -d= -f2- | tr -d '\r' || true)"
  user="${user:-demo}"
  db="${db:-pinpost}"
  docker exec -i pinn-db psql -U "$user" -d "$db" -v ON_ERROR_STOP=1 "$@"
}

require_stack() {
  info "0) Stack + dist checks"
  docker inspect -f '{{.State.Health.Status}}' pinn-db 2>/dev/null | grep -q healthy \
    || bad "pinn-db not healthy — bring stack up first (test-real.sh / compose)"
  docker inspect -f '{{.State.Health.Status}}' pinn-redis 2>/dev/null | grep -q healthy \
    || bad "pinn-redis not healthy"
  docker inspect -f '{{.State.Status}}' pinn-api 2>/dev/null | grep -q running \
    || bad "pinn-api not running"
  test -f "$REPO_ROOT/api/dist/src/utils/pre-expiry-reminders.js" \
    || bad "missing dist pre-expiry-reminders — on host: yarn --cwd api build"
  if ! [[ "$AD_COUNT" =~ ^[1-9][0-9]*$ ]] || (( AD_COUNT > 20 )); then
    bad "AD_COUNT must be 1..20 (got ${AD_COUNT})"
  fi
  ok "db + redis + api up; dist includes pre-expiry fix (AD_COUNT=${AD_COUNT})"
}

save_and_disable_ntp() {
  info "1) Freeze NTP + remember real clock"
  ORIGINAL_EPOCH="$(date +%s)"
  timedatectl set-ntp false 2>/dev/null || true
  echo "  saved epoch=$ORIGINAL_EPOCH  (VM now: $(date -u +%Y-%m-%dT%H:%M:%SZ))"
}

restore_clock() {
  if [[ "${SKIP_RESTORE:-0}" == "1" ]]; then
    echo "  SKIP_RESTORE=1 — leaving clock at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    return
  fi
  info "Restore VM clock"
  if [[ -n "${ORIGINAL_EPOCH:-}" ]]; then
    date -u -s "@${ORIGINAL_EPOCH}" >/dev/null
  fi
  timedatectl set-ntp true 2>/dev/null || true
  echo "  restored: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
}

# Morning of (expiry − days_left) at 02:30 UTC ≈ 08:00 IST (inside handler gate)
jump_to_lead_morning() {
  local expiry_ymd="$1"
  local days_left="$2"
  local target
  target="$(date -u -d "${expiry_ymd} 00:00:00 UTC -${days_left} days +2 hours +30 minutes" +%Y-%m-%dT%H:%M:%SZ)"
  info "Clock jump → ${target}  (lead≈${days_left}d before ${expiry_ymd}, UTC morning window)"
  date -u -s "${target}" >/dev/null
  echo "  VM/container now: $(date -u +%Y-%m-%dT%H:%M:%SZ)  hour=$(date -u +%H)"
  local hour
  hour="$(date -u +%H)"
  hour=$((10#$hour))
  if (( hour < 2 || hour > 3 )); then
    bad "clock not in UTC 2–3 morning gate (hour=$hour)"
  fi
  ok "inside pre-expiry morning gate"
}

# Enqueue the SAME job type the cron schedule uses (not a direct handler/SMS call).
# One job per seeded adId so a full host-DB import does not flood the worker.
# Use node -e (not a heredoc): docker exec does not reliably forward stdin to node.
fire_cron_job() {
  info "Fire Bull job ad-expiration-reminder for ${#AD_IDS[@]} seeded ad(s)"
  local ad_id
  for ad_id in "${AD_IDS[@]}"; do
    docker exec -e "TEST_AD_ID=${ad_id}" pinn-api node -e '
const Bull = require("bull");
const host = process.env.REDIS_HOST || "redis";
const port = parseInt(process.env.REDIS_PORT || "6379", 10);
const password = process.env.REDIS_PASSWORD || undefined;
const adId = process.env.TEST_AD_ID || undefined;
(async () => {
  const q = new Bull("ad-expiration-reminder", { redis: { host, port, password } });
  const job = await q.add(
    "ad-expiration-reminder",
    Object.assign({ manualTrigger: true }, adId ? { adId } : {}),
    { attempts: 3 }
  );
  console.log("enqueued", job.id, "adId=" + adId);
  await q.close();
})().catch((e) => { console.error(e); process.exit(1); });
'
  done
  ok "enqueued ${#AD_IDS[@]} Bull job(s)"
}

wait_for_sms_one() {
  local ad_id="$1"
  local days="$2"
  local expiry_label="$3"
  local since="$4"
  local start=$SECONDS
  local count=0

  while (( SECONDS - start < CRON_WAIT_SEC )); do
    count="$(psql_db -tAc "
      SELECT COUNT(*) FROM outgoing_sms
      WHERE meta->>'adId' = '${ad_id}'
        AND meta->>'reminderDays' = '${days}'
        AND meta->>'expiryDate' = '${expiry_label}'
        AND \"createdAt\" >= '${since}'::timestamptz;
    " | tr -d '[:space:]')"

    if [[ "${count:-0}" -ge 1 ]]; then
      ok "SMS days=${days} expiry=${expiry_label} ad=${ad_id:0:8}… (count=${count})"
      return 0
    fi
    sleep 3
  done
  bad "timeout waiting for SMS days=${days} ad=${ad_id}"
}

wait_for_sms_all() {
  local days="$1"
  local expiry_label="$2"
  local since
  since="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  info "Wait for outbox SMS days=${days} expiry~${expiry_label} for ${#AD_IDS[@]} ads since=${since} (WAIT_CRON=${WAIT_CRON})"

  if [[ "$WAIT_CRON" == "0" ]]; then
    fire_cron_job
  fi

  local ad_id
  for ad_id in "${AD_IDS[@]}"; do
    wait_for_sms_one "$ad_id" "$days" "$expiry_label" "$since"
  done

  psql_db -c "
    SELECT meta->>'adId' AS ad, meta->>'reminderDays' AS days, meta->>'expiryDate' AS expiry,
           status, left(message, 70) AS msg
    FROM outgoing_sms
    WHERE meta->>'adId' = ANY(ARRAY[$(printf "'%s'," "${AD_IDS[@]}" | sed 's/,$//')])
      AND meta->>'reminderDays' = '${days}'
      AND meta->>'expiryDate' = '${expiry_label}'
      AND \"createdAt\" >= '${since}'::timestamptz
    ORDER BY meta->>'adId';
  "
}

seed_ads() {
  local suffix="$1"
  local expiry_ts="$2"
  info "Seed ${AD_COUNT} user(s) + APPROVED ad(s) (expiresAt=${expiry_ts})"

  psql_db -c "INSERT INTO settings (id, key, value)
    VALUES (gen_random_uuid(), 'reminder_expiration_days', '[15, 13, 10]'::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;" >/dev/null

  local cat
  cat="$(psql_db -tAc "SELECT id FROM categories LIMIT 1;" | tr -d '[:space:]')"
  [[ -n "$cat" ]] || bad "no categories — seed DB"

  psql_db <<SQL
DELETE FROM notifications WHERE data->>'adId' IN (
  SELECT id::text FROM ads WHERE title LIKE 'CLOCK-JUMP-PreExpiry-%'
);
DELETE FROM ads WHERE title LIKE 'CLOCK-JUMP-PreExpiry-%';
DELETE FROM users WHERE email LIKE 'clock-%@test.com';
SQL

  AD_IDS=()
  USER_IDS=()
  local i user_id ad_id phone
  for (( i = 1; i <= AD_COUNT; i++ )); do
    user_id="$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen)"
    ad_id="$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen)"
    # Unique phones so outbox rows are easy to spot; last digits = index
    phone="$(printf '777777%04d' "$i")"
    if (( AD_COUNT == 1 )); then
      phone="$PHONE"
    fi

    psql_db <<SQL
INSERT INTO users (id, email, phone, "firstName", "lastName", role, password, "createdAt", "updatedAt")
VALUES (
  '${user_id}',
  'clock-${suffix}-${i}@test.com',
  '${phone}',
  'Clock', 'Jump${i}',
  'USER',
  'not-a-real-hash',
  NOW(), NOW()
);

INSERT INTO ads (
  id, title, description, price, status, "expiresAt", "categoryId", "userId", "createdAt", "updatedAt"
) VALUES (
  '${ad_id}',
  'CLOCK-JUMP-PreExpiry-${suffix}-${i}',
  'Vagrant clock-jump pre-expiry test ad ${i}/${AD_COUNT}',
  99,
  'APPROVED',
  '${expiry_ts}',
  '${cat}',
  '${user_id}',
  NOW(), NOW()
);
SQL
    AD_IDS+=("$ad_id")
    USER_IDS+=("$user_id")
    echo "  ad[$i]=${ad_id} phone=${phone}"
  done
  ok "seeded ${AD_COUNT} ads"
}

renew_ads() {
  local new_expiry="$1"
  info "Renew all seeded ads expiresAt → ${new_expiry}"
  local ad_id
  for ad_id in "${AD_IDS[@]}"; do
    psql_db -c "UPDATE ads SET \"expiresAt\" = '${new_expiry}', \"updatedAt\" = NOW() WHERE id = '${ad_id}';" >/dev/null
  done
  ok "renewed ${#AD_IDS[@]} ads"
}

cleanup_seed() {
  info "Cleanup seed rows (keep outgoing_sms for audit)"
  local ad_id user_id
  for ad_id in "${AD_IDS[@]}"; do
    psql_db -c "DELETE FROM notifications WHERE data->>'adId' = '${ad_id}';" >/dev/null
    psql_db -c "DELETE FROM ads WHERE id = '${ad_id}';" >/dev/null
  done
  for user_id in "${USER_IDS[@]}"; do
    psql_db -c "DELETE FROM users WHERE id = '${user_id}';" >/dev/null
  done
  ok "cleaned ${#AD_IDS[@]} ads / ${#USER_IDS[@]} users"
}

trap restore_clock EXIT

echo "════════════════════════════════════════════════════════"
echo "  Vagrant clock-jump pre-expiry SMS (real app path)"
echo "  phone=${PHONE}  AD_COUNT=${AD_COUNT}  WAIT_CRON=${WAIT_CRON}"
echo "════════════════════════════════════════════════════════"

require_stack
save_and_disable_ntp

SUFFIX="$(date +%s)"
EXPIRY_YMD="$(date -u -d "@$((ORIGINAL_EPOCH + 20 * 86400))" +%Y-%m-%d)"
EXPIRY_TS="${EXPIRY_YMD} 18:00:00+00"
EXPIRY_LABEL="$(date -u -d "${EXPIRY_YMD}" +%d/%m/%Y)"

seed_ads "$SUFFIX" "$EXPIRY_TS"
echo "  expiry UTC day=${EXPIRY_YMD}  SMS label≈${EXPIRY_LABEL}"

# Sliding windows: 15@−15, 13@−12, 10@−9
declare -A JUMP_FOR=([15]=15 [13]=12 [10]=9)

for days in "${LEAD_DAYS[@]}"; do
  jump_to_lead_morning "$EXPIRY_YMD" "${JUMP_FOR[$days]}"
  wait_for_sms_all "$days" "$EXPIRY_LABEL"
done

EXPIRY2_YMD="$(date -u -d "@$((ORIGINAL_EPOCH + 25 * 86400))" +%Y-%m-%d)"
EXPIRY2_TS="${EXPIRY2_YMD} 18:00:00+00"
EXPIRY2_LABEL="$(date -u -d "${EXPIRY2_YMD}" +%d/%m/%Y)"
renew_ads "$EXPIRY2_TS"

jump_to_lead_morning "$EXPIRY2_YMD" 15
wait_for_sms_all "15" "$EXPIRY2_LABEL"

jump_to_lead_morning "$EXPIRY2_YMD" 9
wait_for_sms_all "10" "$EXPIRY2_LABEL"

cleanup_seed

echo ""
echo "════════════════════════════════════════════════════════"
echo "  PASSED (${PASS} checks) — ${AD_COUNT} ads × clock + Bull + outbox + SMS"
echo "════════════════════════════════════════════════════════"
echo "  Filter CLOCK-JUMP in admin SMS Outbox to inspect rows."
echo "  WAIT_CRON=0 is faster but still uses Bull (not direct SMS)."
echo "════════════════════════════════════════════════════════"
