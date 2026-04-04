#!/bin/bash
# ═══════════════════════════════════════════════════════════
#   Restaurant POS System — Start Desktop App
# ═══════════════════════════════════════════════════════════

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo ""
echo "════════════════════════════════════════════════════════"
echo "    Restaurant POS — Desktop Application"
echo "════════════════════════════════════════════════════════"
echo ""

# Ensure MongoDB is running
if [[ "$OSTYPE" == "darwin"* ]]; then
    brew services start mongodb-community 2>/dev/null || true
else
    sudo systemctl start mongod 2>/dev/null || true
fi

echo "[i] Launching Restaurant POS Desktop App..."
echo ""

cd "$PROJECT_DIR/electron"
npx electron .

echo ""
echo "Application closed."
