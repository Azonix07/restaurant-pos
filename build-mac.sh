#!/bin/bash
# ═══════════════════════════════════════════════════════════
#   Restaurant POS System — Build macOS Installer (.dmg)
# ═══════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}    Restaurant POS — Build macOS Installer${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
    echo -e "${RED}[ERROR]${NC} Node.js is not installed."
    echo "  Install via: brew install node"
    exit 1
fi
echo -e "[OK] Node.js $(node --version)"

# Step 1: Backend deps
echo ""
echo -e "${BLUE}[1/5]${NC} Installing backend dependencies..."
cd "$PROJECT_DIR/backend"
npm install --omit=dev --loglevel=error 2>&1 | tail -1
echo -e "  ${GREEN}[OK]${NC} Backend dependencies installed"

# Step 2: Frontend deps
echo ""
echo -e "${BLUE}[2/5]${NC} Installing frontend dependencies..."
cd "$PROJECT_DIR/frontend"
npm install --loglevel=error 2>&1 | tail -1
echo -e "  ${GREEN}[OK]${NC} Frontend dependencies installed"

# Step 3: Build frontend
echo ""
echo -e "${BLUE}[3/5]${NC} Building frontend..."
npm run build 2>&1 | tail -3
echo -e "  ${GREEN}[OK]${NC} Frontend built"

# Step 4: Electron deps
echo ""
echo -e "${BLUE}[4/5]${NC} Installing Electron dependencies..."
cd "$PROJECT_DIR/electron"
npm install --loglevel=error 2>&1 | tail -1
echo -e "  ${GREEN}[OK]${NC} Electron dependencies installed"

# Step 5: Build DMG
echo ""
echo -e "${BLUE}[5/5]${NC} Building macOS installer (.dmg)..."

# Determine architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    echo "  Building for Apple Silicon (arm64)..."
    npx electron-builder --mac --arm64
elif [ "$ARCH" = "x86_64" ]; then
    echo "  Building for Intel (x64)..."
    npx electron-builder --mac --x64
else
    echo "  Building for current architecture..."
    npx electron-builder --mac
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}${BOLD}BUILD COMPLETE!${NC}"
echo ""
echo "  Your macOS installer is at:"
echo -e "    ${BOLD}electron/dist/Restaurant-POS-Setup-1.0.0.dmg${NC}"
echo ""
echo "  Share this .dmg file — users drag to Applications to install."
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""

# Open the dist folder
open "$PROJECT_DIR/electron/dist" 2>/dev/null || true
