#!/bin/bash

# Socket.IO Monitoring Script
# Run this on your VPS to monitor socket connections and system resources

echo "🔍 Socket.IO Monitor Started..."
echo "Press Ctrl+C to stop"
echo "================================"
echo ""

INTERVAL=5  # Check every 5 seconds
WARN_CONNECTIONS=500  # Warn if connections exceed this
WARN_MEMORY=80  # Warn if memory usage exceeds this percentage

while true; do
  # Get current timestamp
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

  # Count established connections on port 3000 (adjust port if needed)
  CONNECTIONS=$(netstat -an 2>/dev/null | grep :3000 | grep ESTABLISHED | wc -l)
  CONNECTIONS=$(echo $CONNECTIONS | tr -d ' ')  # Remove whitespace

  # Get memory usage percentage
  MEMORY_PERCENT=$(free | grep Mem | awk '{printf "%.1f", ($3/$2) * 100.0}')

  # Get CPU usage percentage (average across all cores)
  CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)

  # Get Node process count
  NODE_PROCS=$(pgrep -c node)

  # Get total memory used by Node processes in MB
  NODE_MEMORY=$(ps aux | grep node | grep -v grep | awk '{sum+=$6} END {printf "%.1f", sum/1024}')

  # Display stats
  echo "[$TIMESTAMP]"
  echo "  📊 Socket Connections: $CONNECTIONS"
  echo "  💾 System Memory: ${MEMORY_PERCENT}%"
  echo "  🖥️  CPU Usage: ${CPU_USAGE}%"
  echo "  🔵 Node Processes: $NODE_PROCS"
  echo "  📦 Node Memory: ${NODE_MEMORY}MB"

  # Warnings
  if [ "$CONNECTIONS" -gt "$WARN_CONNECTIONS" ]; then
    echo "  ⚠️  WARNING: High socket count ($CONNECTIONS > $WARN_CONNECTIONS)"
  fi

  MEM_COMPARE=$(echo "$MEMORY_PERCENT > $WARN_MEMORY" | bc -l 2>/dev/null || echo "0")
  if [ "$MEM_COMPARE" = "1" ]; then
    echo "  ⚠️  WARNING: High memory usage (${MEMORY_PERCENT}% > ${WARN_MEMORY}%)"
  fi

  echo "--------------------------------"

  sleep $INTERVAL
done
