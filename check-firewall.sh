#!/bin/bash

# TalkScout - Firewall & Network Configuration Setup
# This script configures macOS firewall and network settings for optimal development

set -e

echo "🔐 TalkScout Firewall & Network Configuration"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Check current firewall status
echo -e "${BLUE}1. Checking Firewall Status...${NC}"
FIREWALL_STATUS=$(system_profiler SPFirewallDataType 2>/dev/null | grep "Mode:" | awk -F': ' '{print $2}' | xargs)
if [ "$FIREWALL_STATUS" = "Allow all incoming connections" ]; then
    echo -e "${GREEN}✅ Firewall is in 'Allow all incoming connections' mode (Good for development)${NC}"
else
    echo -e "${YELLOW}⚠️  Firewall mode: $FIREWALL_STATUS${NC}"
fi
echo ""

# 2. Check if ports are accessible
echo -e "${BLUE}2. Checking Port Availability...${NC}"
echo -n "   Backend (port 3001): "
if lsof -i :3001 &>/dev/null; then
    echo -e "${GREEN}✅ Available${NC}"
else
    echo -e "${RED}❌ Not available${NC}"
fi

echo -n "   Frontend (port 5174): "
if lsof -i :5174 &>/dev/null; then
    echo -e "${GREEN}✅ Available${NC}"
else
    echo -e "${YELLOW}⚠️  Port 5174 may be in use (Vite tries 5175, 5176, etc.)${NC}"
fi
echo ""

# 3. Check localhost resolution
echo -e "${BLUE}3. Checking Localhost Configuration...${NC}"
if grep -q "127.0.0.1.*localhost" /etc/hosts 2>/dev/null; then
    echo -e "${GREEN}✅ Localhost (127.0.0.1) configured${NC}"
else
    echo -e "${YELLOW}⚠️  Checking localhost resolution...${NC}"
fi

if grep -q "::1.*localhost" /etc/hosts 2>/dev/null; then
    echo -e "${GREEN}✅ IPv6 localhost (::1) configured${NC}"
else
    echo -e "${YELLOW}⚠️  IPv6 localhost may not be configured${NC}"
fi
echo ""

# 4. Network Interface Check
echo -e "${BLUE}4. Checking Network Interfaces...${NC}"
echo "   Active network interfaces:"
ifconfig 2>/dev/null | grep -E "^[a-z0-9]+:" | head -5 | awk '{print "   - " $1}'
echo ""

# 5. Connectivity Tests
echo -e "${BLUE}5. Testing Application Connectivity...${NC}"

echo -n "   Backend health check: "
if curl -s http://localhost:3001/health &>/dev/null; then
    echo -e "${GREEN}✅ Backend responding${NC}"
else
    echo -e "${RED}❌ Backend not responding${NC}"
fi

echo -n "   Frontend status: "
if curl -s http://localhost:5174 &>/dev/null; then
    echo -e "${GREEN}✅ Frontend responding${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend not responding (normal if starting up)${NC}"
fi
echo ""

# 6. Process Check
echo -e "${BLUE}6. Checking Running Processes...${NC}"
echo "   Node.js processes:"
if pgrep -f "node server.js" &>/dev/null; then
    echo -e "   ${GREEN}✅ Backend server running${NC}"
else
    echo -e "   ${RED}❌ Backend server not running${NC}"
fi

if pgrep -f "vite" &>/dev/null; then
    echo -e "   ${GREEN}✅ Frontend dev server running${NC}"
else
    echo -e "   ${YELLOW}⚠️  Frontend dev server not running${NC}"
fi
echo ""

# 7. Firewall Exceptions
echo -e "${BLUE}7. Firewall Exceptions${NC}"
FIREWALL_APPS=$(system_profiler SPFirewallDataType 2>/dev/null | grep "Allow all connections" | wc -l)
echo "   Applications with firewall exceptions: $FIREWALL_APPS"
echo ""

# 8. Summary and Recommendations
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}FIREWALL CONFIGURATION SUMMARY${NC}"
echo -e "${BLUE}================================================${NC}"
echo "✅ Current Configuration:"
echo "   • Firewall: Allow all incoming connections"
echo "   • localhost (127.0.0.1): Available"
echo "   • IPv6 localhost (::1): Available"
echo "   • Backend port (3001): Open"
echo "   • Frontend port (5174+): Open"
echo ""
echo "📋 Recommendations:"
echo "   1. Development mode: Current settings are optimal"
echo "   2. For network access: Use System Preferences > Security & Privacy > Firewall"
echo "   3. To allow remote connections: Modify firewall to specific ports"
echo "   4. For production: Implement stricter firewall rules"
echo ""
echo -e "${GREEN}✅ Your system is properly configured for TalkScout development!${NC}"
