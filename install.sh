#!/bin/bash
# ═══════════════════════════════════════════════════════════
#   Restaurant POS System — One-Click Installer (macOS/Linux)
# ═══════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

clear
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}    Restaurant POS System — Installer${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""
echo "  This will install everything needed:"
echo "    • Node.js (if not installed)"
echo "    • MongoDB (if not installed)"
echo "    • All application dependencies"
echo "    • Demo data (sample menu, tables, users)"
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""
read -p "Press Enter to continue (or Ctrl+C to cancel)..."
echo ""

# ─── Helper functions ─────────────────────────────────────

check_command() {
    command -v "$1" >/dev/null 2>&1
}

print_step() {
    echo -e "${BLUE}[$1/6]${NC} $2"
}

print_ok() {
    echo -e "    ${GREEN}[OK]${NC} $1"
}

print_warn() {
    echo -e "    ${YELLOW}[!]${NC} $1"
}

print_fail() {
    echo -e "    ${RED}[FAIL]${NC} $1"
}

# ─── STEP 1: Node.js ─────────────────────────────────────

print_step 1 "Checking Node.js..."

if check_command node; then
    NODE_VER=$(node --version)
    print_ok "Node.js $NODE_VER found"
else
    print_warn "Node.js not found. Installing..."

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if check_command brew; then
            echo "    Installing Node.js via Homebrew..."
            brew install node
        else
            echo "    Installing Homebrew first..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            # Add brew to path for Apple Silicon
            if [[ -f /opt/homebrew/bin/brew ]]; then
                eval "$(/opt/homebrew/bin/brew shellenv)"
            fi
            brew install node
        fi
    else
        # Linux
        if check_command apt; then
            echo "    Installing Node.js via apt..."
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
            sudo apt install -y nodejs
        elif check_command dnf; then
            curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
            sudo dnf install -y nodejs
        elif check_command yum; then
            curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
            sudo yum install -y nodejs
        else
            print_fail "Could not install Node.js automatically."
            echo "    Please install Node.js manually from: https://nodejs.org"
            exit 1
        fi
    fi

    if check_command node; then
        print_ok "Node.js $(node --version) installed"
    else
        print_fail "Node.js installation failed. Please install manually from https://nodejs.org"
        exit 1
    fi
fi

# ─── STEP 2: MongoDB ─────────────────────────────────────

echo ""
print_step 2 "Checking MongoDB..."

if check_command mongod || check_command mongosh; then
    print_ok "MongoDB found"
else
    print_warn "MongoDB not found. Installing..."

    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew tap mongodb/brew 2>/dev/null || true
        brew install mongodb-community
        brew services start mongodb-community
    else
        # Linux (Ubuntu/Debian)
        if check_command apt; then
            curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg 2>/dev/null || true
            echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
            sudo apt update
            sudo apt install -y mongodb-org
            sudo systemctl start mongod
            sudo systemctl enable mongod
        else
            print_fail "Could not install MongoDB automatically."
            echo "    Please install MongoDB manually from: https://www.mongodb.com/try/download/community"
            exit 1
        fi
    fi

    print_ok "MongoDB installed and started"
fi

# Make sure MongoDB is running
if [[ "$OSTYPE" == "darwin"* ]]; then
    brew services start mongodb-community 2>/dev/null || true
else
    sudo systemctl start mongod 2>/dev/null || true
fi

# ─── STEP 3: Configuration ───────────────────────────────

echo ""
print_step 3 "Setting up configuration..."

if [ ! -f "$PROJECT_DIR/.env" ]; then
    SECRET=$(openssl rand -hex 16 2>/dev/null || echo "pos_secret_$(date +%s)")
    cat > "$PROJECT_DIR/.env" << EOF
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/restaurant_pos
JWT_SECRET=$SECRET
JWT_EXPIRES_IN=24h
EOF
    print_ok "Configuration file created"
else
    print_ok "Configuration file already exists"
fi

# ─── STEP 4: Install dependencies ────────────────────────

echo ""
print_step 4 "Installing dependencies (this may take a few minutes)..."
echo ""

cd "$PROJECT_DIR"

echo "    Installing backend dependencies..."
cd "$PROJECT_DIR/backend" && npm install --loglevel=error 2>&1 | tail -1
print_ok "Backend dependencies installed"

echo "    Installing frontend dependencies..."
cd "$PROJECT_DIR/frontend" && npm install --loglevel=error 2>&1 | tail -1
print_ok "Frontend dependencies installed"

echo "    Installing desktop app dependencies..."
cd "$PROJECT_DIR/electron" && npm install --loglevel=error 2>&1 | tail -1
print_ok "Desktop app dependencies installed"

# ─── STEP 5: Seed database ───────────────────────────────

echo ""
print_step 5 "Setting up database with demo data..."
cd "$PROJECT_DIR/backend"
node src/seed.js 2>&1 | tail -3
print_ok "Database seeded"

# ─── STEP 6: Build frontend ──────────────────────────────

echo ""
print_step 6 "Building the application (this may take 1-2 minutes)..."
cd "$PROJECT_DIR/frontend"
npx react-scripts build 2>&1 | tail -3
print_ok "Application built"

# ─── DONE ─────────────────────────────────────────────────

cd "$PROJECT_DIR"

# Make launcher scripts executable
chmod +x "$PROJECT_DIR/start.sh" 2>/dev/null || true
chmod +x "$PROJECT_DIR/start-desktop.sh" 2>/dev/null || true

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "    ${GREEN}${BOLD}Installation Complete!${NC}"
echo ""
echo "    To start the POS system:"
echo -e "        ${BOLD}./start.sh${NC}              (opens in browser)"
echo -e "        ${BOLD}./start-desktop.sh${NC}      (desktop app)"
echo ""
echo "    Demo Login:"
echo "        Email:    admin@restaurant.com"
echo "        Password: admin123"
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
read -p "Start the application now? (Y/n): " START_NOW
START_NOW=${START_NOW:-Y}

if [[ "$START_NOW" =~ ^[Yy]$ ]]; then
    exec "$PROJECT_DIR/start.sh"
fi
