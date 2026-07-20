#!/usr/bin/env bash
# ============================================================================
# Installs the container watchdog as a systemd timer (preferred) or a cron
# entry (fallback on hosts without systemd).
#
# Usage (run as root on the server):
#   sudo bash docker/install-watchdog.sh
#
# To uninstall:
#   sudo bash docker/install-watchdog.sh --uninstall
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
WATCHDOG="${SCRIPT_DIR}/container-watchdog.sh"
SERVICE_NAME="pinn-watchdog"
SYSTEMD_DIR="/etc/systemd/system"
TIMER_INTERVAL="${TIMER_INTERVAL:-1min}"

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

if [[ ! -f "${WATCHDOG}" ]]; then
  echo "Watchdog script not found at ${WATCHDOG}" >&2
  exit 1
fi

chmod +x "${WATCHDOG}"

# ---------------------------------------------------------------------------
# Uninstall
# ---------------------------------------------------------------------------
if [[ "${1:-}" == "--uninstall" ]]; then
  if command -v systemctl &>/dev/null; then
    systemctl disable --now "${SERVICE_NAME}.timer"   2>/dev/null || true
    systemctl disable --now "${SERVICE_NAME}.service" 2>/dev/null || true
    rm -f "${SYSTEMD_DIR}/${SERVICE_NAME}.service" "${SYSTEMD_DIR}/${SERVICE_NAME}.timer"
    systemctl daemon-reload
    echo "Removed systemd units for ${SERVICE_NAME}."
  fi
  # Clean cron fallback too
  if crontab -l 2>/dev/null | grep -q "container-watchdog.sh"; then
    crontab -l 2>/dev/null | grep -v "container-watchdog.sh" | crontab -
    echo "Removed cron entry."
  fi
  exit 0
fi

# ---------------------------------------------------------------------------
# Prefer systemd
# ---------------------------------------------------------------------------
if command -v systemctl &>/dev/null && [[ -d /run/systemd/system ]]; then
  echo "Installing systemd timer (${SERVICE_NAME}.timer, interval=${TIMER_INTERVAL})"

  cat >"${SYSTEMD_DIR}/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Pinnpost container watchdog (auto-recreate on corrupted layers)
Wants=docker.service
After=docker.service network-online.target
ConditionPathExists=${WATCHDOG}

[Service]
Type=oneshot
ExecStart=${WATCHDOG}
Nice=10
IOSchedulingClass=idle
# Give the recreate plenty of time (image pull + container boot) but don't
# let it hang forever.
TimeoutStartSec=5min
EOF

  cat >"${SYSTEMD_DIR}/${SERVICE_NAME}.timer" <<EOF
[Unit]
Description=Run Pinnpost container watchdog every ${TIMER_INTERVAL}
Requires=${SERVICE_NAME}.service

[Timer]
OnBootSec=2min
OnUnitActiveSec=${TIMER_INTERVAL}
AccuracySec=15s
Unit=${SERVICE_NAME}.service
Persistent=true

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now "${SERVICE_NAME}.timer"

  echo
  echo "Installed. Useful commands:"
  echo "  systemctl status ${SERVICE_NAME}.timer"
  echo "  systemctl list-timers | grep ${SERVICE_NAME}"
  echo "  journalctl -u ${SERVICE_NAME} -f"
  echo "  tail -f /var/log/pinn-watchdog.log"
  exit 0
fi

# ---------------------------------------------------------------------------
# Cron fallback
# ---------------------------------------------------------------------------
echo "systemd not detected; installing cron entry instead."
CRON_LINE="* * * * * ${WATCHDOG} >/dev/null 2>&1"
( crontab -l 2>/dev/null | grep -v "container-watchdog.sh"; echo "${CRON_LINE}" ) | crontab -
echo "Cron entry installed:"
echo "  ${CRON_LINE}"
echo "Log: /var/log/pinn-watchdog.log"
