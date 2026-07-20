#!/bin/bash
# Run this when you get 502 errors on admin

echo "========================================"
echo "ADMIN 502 DIAGNOSTIC SCRIPT"
echo "========================================"
echo ""

echo "1. Container Status:"
docker ps -a | grep pinn-admin
echo ""

echo "2. Restart Count:"
docker inspect pinn-admin 2>/dev/null | grep -A 2 "RestartCount" || echo "Container not found"
echo ""

echo "3. Recent Logs (last 50 lines):"
docker logs pinn-admin --tail 50 2>&1
echo ""

echo "4. Memory Usage:"
docker stats pinn-admin --no-stream 2>&1
echo ""

echo "5. Testing connectivity from nginx to admin:"
docker exec pinn-nginx wget -O- http://admin:3000/api/health 2>&1
echo ""

echo "6. Testing admin health directly:"
docker exec pinn-admin wget -O- http://localhost:3000/api/health 2>&1
echo ""

echo "7. API Status (admin depends on this):"
docker ps | grep pinn-api
docker logs pinn-api --tail 20 2>&1
echo ""

echo "========================================"
echo "If admin is 'Restarting', check logs above for crash reason"
echo "If admin is 'Exited', try: docker start pinn-admin"
echo "========================================"
