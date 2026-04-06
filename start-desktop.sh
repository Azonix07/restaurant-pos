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

echo "[i] Launching Restaurant POS Desktop App..."
echo "    (Uses embedded database — no external MongoDB needed)"
echo ""

cd "$PROJECT_DIR/electron"
npx electron .

echo ""
echo "Application closed."
