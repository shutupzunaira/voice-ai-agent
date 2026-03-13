# 🔐 TalkScout Firewall & Network Setup

This guide ensures your macOS firewall and network are properly configured for TalkScout development.

## ✅ Current Status

Your system is properly configured:

```
✅ Firewall: Allow all incoming connections
✅ Backend (port 3001): Running and accessible
✅ Frontend (port 5175): Running and accessible  
✅ localhost (127.0.0.1): Configured and responding
✅ IPv6 localhost (::1): Configured and responding
```

---

## 🚀 Quick Start

### Start Both Services
```bash
cd /Users/admin/Documents/Projects/voice-ai-agent
bash start-dev.sh
```

### Manual Start (if preferred)
```bash
# Terminal 1: Backend
cd /Users/admin/Documents/Projects/voice-ai-agent/backend
node server.js

# Terminal 2: Frontend  
cd /Users/admin/Documents/Projects/voice-ai-agent/frontend
npm run dev
```

---

## 🔍 Configuration Files

| File | Purpose |
|------|---------|
| `start-dev.sh` | Automated startup script for both services |
| `check-firewall.sh` | Diagnostic script to verify network setup |
| `.network.config` | Network and firewall settings |
| `FIREWALL-CONFIG.md` | Detailed firewall documentation |
| `TROUBLESHOOTING.md` | Common issues and solutions |

---

## 🔧 Firewall Settings

### macOS Firewall Status
```bash
system_profiler SPFirewallDataType
```

**Current Configuration**:
- **Mode**: Allow all incoming connections ✅
- **Firewall Logging**: Off
- **Stealth Mode**: Off

### Localhost Configuration
```bash
# Should show 127.0.0.1 and ::1
cat /etc/hosts | grep localhost
```

**Expected Output**:
```
127.0.0.1 localhost
::1 localhost
```

---

## 🌐 Network Configuration

### Backend Server
- **Host**: localhost (127.0.0.1)
- **Port**: 3001
- **URL**: http://localhost:3001
- **API Health**: http://localhost:3001/health

### Frontend Server
- **Host**: localhost (127.0.0.1)
- **Port**: 5175 (Strict port)
- **URL**: http://localhost:5175
- **Framework**: React + Vite

### CORS Settings
- **Enabled**: Yes
- **Origins**: Localhost variants
- **Purpose**: Allow frontend to communicate with backend

---

## 📋 Verification Checklist

Run these commands to verify everything is working:

```bash
# 1. Check firewall
system_profiler SPFirewallDataType | grep Mode

# 2. Check backend
curl http://localhost:3001/health

# 3. Check frontend
curl http://localhost:5174 | grep -o "<title>.*</title>"

# 4. Check API
curl http://localhost:3001/api/behavioral

# 5. Run full diagnostic
bash /Users/admin/Documents/Projects/voice-ai-agent/check-firewall.sh
```

---

## 🚨 Troubleshooting

### Backend not responding
```bash
# Check if running
lsof -i :3001

# Restart
cd /Users/admin/Documents/Projects/voice-ai-agent/backend
node server.js
```

### Frontend not loading
```bash
# Check if running
lsof -i :5174

# Restart
cd /Users/admin/Documents/Projects/voice-ai-agent/frontend
npm run dev
```

### Port already in use
```bash
# Kill process
lsof -ti :3001 | xargs kill -9

# Try again
node server.js
```

### Firewall blocking access
```bash
# Check firewall status
system_profiler SPFirewallDataType

# If restrictive, open System Preferences:
# Security & Privacy > Firewall Options
```

### Cannot resolve localhost
```bash
# Test resolution
ping localhost
ping 127.0.0.1
ping ::1

# If fails, check /etc/hosts
cat /etc/hosts
```

---

## 📊 Port Status

Check which ports are in use:

```bash
# All listening ports
lsof -i -P -n | grep LISTEN

# Specific port
lsof -i :3001
lsof -i :5174
```

---

## 🔒 Security Notes

### For Development ✅
- Firewall: Allow all (development-friendly)
- Authentication: None required
- HTTPS: Not used (localhost only)
- CORS: Permissive

### For Production ⚠️
- Firewall: Block all, add specific exceptions
- Authentication: Implement JWT/OAuth
- HTTPS: Use SSL certificates
- CORS: Restrict to specific origins
- Environment: Use production .env

---

## 🛠️ Useful Commands

```bash
# Check firewall
sudo systemsetup -getfirewall

# View firewall exceptions
system_profiler SPFirewallDataType

# Test connectivity
curl -v http://localhost:3001/health

# Check all listening ports
lsof -i -P -n

# Kill all Node processes
pkill -f "node"

# View running Node processes
ps aux | grep node
```

---

## 📚 Documentation

For more information, see:

- [Firewall Configuration Details](./FIREWALL-CONFIG.md) - Complete firewall guide
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Solutions for common issues
- [Network Configuration](./FIREWALL-CONFIG.md#-network-settings) - Network settings reference
- [Backend README](./backend/README.md) - Backend setup
- [Frontend README](./frontend/README.md) - Frontend setup

---

## ✨ Features

- ✅ Automatic firewall detection
- ✅ Port availability checking
- ✅ Network connectivity verification
- ✅ Localhost configuration validation
- ✅ Automated startup scripts
- ✅ Comprehensive diagnostic tools
- ✅ Detailed documentation

---

## 🎯 Next Steps

1. **Run diagnostic**: `bash check-firewall.sh`
2. **Start services**: `bash start-dev.sh`
3. **Open browser**: `http://localhost:5174`
4. **Begin interview**: Select a topic from home page
5. **Report issues**: See TROUBLESHOOTING.md

---

**Last Updated**: March 10, 2026  
**Status**: ✅ All systems verified and operational  
**Firewall Mode**: Allow all incoming connections  
**Network**: Fully configured for development
