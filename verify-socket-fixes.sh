#!/bin/bash

# Socket.IO Fixes Verification Script
# Run this before deploying to verify all fixes are in place

echo "🔍 Verifying Socket.IO Fixes..."
echo "================================"
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0

# Function to check if a file contains a specific string
check_fix() {
  local file=$1
  local search_string=$2
  local description=$3

  if grep -q "$search_string" "$file" 2>/dev/null; then
    echo "✅ $description"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    return 0
  else
    echo "❌ $description"
    echo "   File: $file"
    echo "   Expected: $search_string"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return 1
  fi
}

echo "Checking Server-Side Fixes..."
echo "------------------------------"

# Check API socket file
API_SOCKET="api/src/socket/socket.ts"

check_fix "$API_SOCKET" \
  "const conversationPermissionCache = new Map" \
  "Permission cache implemented"

check_fix "$API_SOCKET" \
  "pingTimeout: 20000" \
  "Ping timeout reduced to 20s"

check_fix "$API_SOCKET" \
  "pingInterval: 15000" \
  "Ping interval reduced to 15s"

check_fix "$API_SOCKET" \
  "maxHttpBufferSize: 1e6" \
  "Max HTTP buffer size limited"

check_fix "$API_SOCKET" \
  "const typingRateLimiter = new Map" \
  "Typing rate limiter implemented"

check_fix "$API_SOCKET" \
  "TYPING_COOLDOWN = 500" \
  "Typing cooldown set to 500ms"

check_fix "$API_SOCKET" \
  "socket.conversationRooms.clear()" \
  "Proper cleanup on disconnect"

check_fix "$API_SOCKET" \
  "typingRateLimiter.delete(key)" \
  "Rate limiter cleanup on typing stop"

check_fix "$API_SOCKET" \
  "const allowedUsers = await getConversationUsers" \
  "Using cached conversation permissions"

check_fix "$API_SOCKET" \
  "setInterval(() => {" \
  "Monitoring interval implemented"

check_fix "$API_SOCKET" \
  "cleanupExpiredCache()" \
  "Cache cleanup function exists"

echo ""
echo "Checking Client-Side Fixes..."
echo "------------------------------"

# Check mobile socket service
MOBILE_SOCKET="mobile/services/socket.service.ts"

check_fix "$MOBILE_SOCKET" \
  "forceNew: false" \
  "Force new disabled (reusing connections)"

check_fix "$MOBILE_SOCKET" \
  "reconnectionAttempts: 5" \
  "Reconnection attempts reduced to 5"

check_fix "$MOBILE_SOCKET" \
  "transports: \['websocket', 'polling'\]" \
  "WebSocket preferred over polling"

check_fix "$MOBILE_SOCKET" \
  "if (this.socket?.connected) {" \
  "Check for existing connection before connecting"

# Check socket context
SOCKET_CONTEXT="mobile/contexts/socket-context.tsx"

check_fix "$SOCKET_CONTEXT" \
  "if (isAuthenticated && !socketService.connected)" \
  "Prevent duplicate connections in context"

check_fix "$SOCKET_CONTEXT" \
  "} else if (!isAuthenticated && socketService.connected)" \
  "Only disconnect when actually connected"

# Check chat page
CHAT_PAGE="mobile/app/(pages)/chat.tsx"

if ! grep -q "socketService.connect" "$CHAT_PAGE" 2>/dev/null; then
  echo "✅ Removed redundant socket.connect() from chat page"
  SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
else
  echo "❌ Still has socketService.connect() call (should use SocketProvider)"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

if ! grep -q "socketService.disconnect()" "$CHAT_PAGE" 2>/dev/null; then
  echo "✅ Removed socket.disconnect() from chat page unmount"
  SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
else
  echo "⚠️  Still has socketService.disconnect() (may be intentional)"
fi

echo ""
echo "================================"
echo "Verification Complete!"
echo "✅ Passed: $SUCCESS_COUNT"
echo "❌ Failed: $FAIL_COUNT"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo "🎉 All fixes verified! Ready for deployment."
  exit 0
else
  echo "⚠️  Some fixes are missing. Please review and fix before deploying."
  exit 1
fi
