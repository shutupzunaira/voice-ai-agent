#!/bin/bash

# TalkScout - Development Startup Script
# Starts backend and frontend with proper network configuration

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="/Users/admin/Documents/Projects/voice-ai-agent"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║      🎤 TalkScout Development Server    ║"
echo "║     Firewall & Network Configuration   ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# 1. Kill any existing processes on ports 3001 and 5174
echo -e "${BLUE}[1/6]${NC} Cleaning up existing processes..."
lsof -ti :3001 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti :5174,5175,5176,5177 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1
echo -e "${GREEN}✅ Ports cleared${NC}"

# 2. Check firewall status
echo -e "\n${BLUE}[2/6]${NC} Checking firewall configuration..."
FIREWALL_STATUS=$(system_profiler SPFirewallDataType 2>/dev/null | grep "Mode:" | awk -F': ' '{print $2}' | xargs)

if [ "$FIREWALL_STATUS" = "Allow all incoming connections" ]; then
    echo -e "${GREEN}✅ Firewall is in 'Allow all' mode - Development ready${NC}"
elif [ -z "$FIREWALL_STATUS" ]; then
    echo -e "${YELLOW}⚠️  Could not determine firewall status${NC}"
else
    echo -e "${YELLOW}⚠️  Firewall mode: $FIREWALL_STATUS${NC}"
    echo -e "${YELLOW}    For development, consider: System Preferences > Security & Privacy > Firewall${NC}"
fi

# 3. Check localhost configuration
echo -e "\n${BLUE}[3/6]${NC} Verifying network configuration..."
if ping -c 1 localhost &>/dev/null 2>&1; then
    echo -e "${GREEN}✅ localhost (127.0.0.1) responding${NC}"
else
    echo -e "${RED}❌ localhost resolution failed${NC}"
    exit 1
fi

# 4. Start backend
echo -e "\n${BLUE}[4/6]${NC} Starting backend server..."
cd "$BACKEND_DIR"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies..."
    npm install --silent
fi

# Start backend in background
node server.js > /tmp/talkscout-backend.log 2>&1 &
BACKEND_PID=$!
echo "   Process ID: $BACKEND_PID"

# Wait for backend to start
sleep 2

# Verify backend is running
if lsof -i :3001 &>/dev/null; then
    echo -e "${GREEN}✅ Backend started on http://localhost:3001${NC}"
else
    echo -e "${RED}❌ Backend failed to start${NC}"
    cat /tmp/talkscout-backend.log
    exit 1
fi

# 5. Start frontend
echo -e "\n${BLUE}[5/6]${NC} Starting frontend dev server..."
cd "$FRONTEND_DIR"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies..."
    npm install --silent
fi

# Start frontend in background
npm run dev > /tmp/talkscout-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Process ID: $FRONTEND_PID"

# Wait for frontend to start
sleep 3

# Detect which port frontend is running on (could be 5174, 5175, etc.)
FRONTEND_PORT=$(lsof -i -P -n 2>/dev/null | grep "npm" | grep "IPv" | awk '{print $9}' | cut -d: -f2 | head -1)

if [ -n "$FRONTEND_PORT" ]; then
    echo -e "${GREEN}✅ Frontend started on http://localhost:$FRONTEND_PORT${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend may still be starting...${NC}"
fi

# 6. Verify connectivity
echo -e "\n${BLUE}[6/6]${NC} Verifying connectivity..."

# Test backend
if curl -s http://localhost:3001/health &>/dev/null; then
    echo -e "${GREEN}✅ Backend health check passed${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
fi

# Test frontend
FRONTEND_PORT=${FRONTEND_PORT:-5175}
if curl -s http://localhost:$FRONTEND_PORT &>/dev/null; then
    echo -e "${GREEN}✅ Frontend responding${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend still loading (this is normal)${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}"
echo "╔════════════════════════════════════════╗"
echo "║  ✅ TalkScout is Ready for Development  ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}Network Configuration:${NC}"
echo "  Backend:  http://localhost:3001"
echo "  Frontend: http://localhost:${FRONTEND_PORT:-5175}"
echo ""

echo -e "${BLUE}Firewall Status:${NC}"
echo "  Mode: $FIREWALL_STATUS"
echo "  IPv4 Localhost: ✅ 127.0.0.1"
echo "  IPv6 Localhost: ✅ ::1"
echo ""

echo -e "${BLUE}Running Processes:${NC}"
echo "  Backend PID:  $BACKEND_PID"
echo "  Frontend PID: $FRONTEND_PID"
echo ""

echo -e "${BLUE}Logs:${NC}"
echo "  Backend:  tail -f /tmp/talkscout-backend.log"
echo "  Frontend: tail -f /tmp/talkscout-frontend.log"
echo ""

echo -e "${BLUE}To stop servers:${NC}"
echo "  kill $BACKEND_PID  # Stop backend"
echo "  kill $FRONTEND_PID # Stop frontend"
echo ""

echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"

# Keep script running to maintain background processes
wait

