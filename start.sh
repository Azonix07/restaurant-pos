#!/bin/bash
# ═══════════════════════════════════════════════════════════
#   Restaurant POS System — Start Server
# ═══════════════════════════════════════════════════════════

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}    Restaurant POS System — Starting...${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Ensure MongoDB is running
if [[ "$OSTYPE" == "darwin"* ]]; then
    brew services start mongodb-community 2>/dev/null || true
else
    sudo systemctl start mongod 2>/dev/null || true
fi

# Get LAN IP
if [[ "$OSTYPE" == "darwin"* ]]; then
    LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
else
    LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

# Start backend
echo "[i] Starting POS server..."
cd "$PROJECT_DIR/backend"
node src/server.js &
SERVER_PID=$!

# Wait for server
sleep 3

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "    ${GREEN}${BOLD}POS System is running!${NC}"
echo ""
echo "    Open in browser:"
echo -e "        ${BOLD}http://localhost:5001${NC}"
echo ""
if [ -n "$LAN_IP" ]; then
echo "    Other devices on WiFi:"
echo -e "        ${BOLD}http://$LAN_IP:5001${NC}"
echo ""
fi
echo "    Login:"
echo "        Email:    admin@restaurant.com"
echo "        Password: admin123"
echo ""
echo "    Press Ctrl+C to stop the server."
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""

# Open browser
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:5001" 2>/dev/null || true
else
    xdg-open "http://localhost:5001" 2>/dev/null || true
fi

# Wait for server process (Ctrl+C to stop)
cleanup() {
    echo ""
    echo "[i] Stopping server..."
    kill $SERVER_PID 2>/dev/null
    exit 0
}
trap cleanup INT TERM

wait $SERVER_PID
