# TalkScout - Network & Firewall Configuration Guide

## 🔐 Firewall Status

### Current macOS Firewall Configuration
- **Mode**: Allow all incoming connections ✅
- **Firewall Logging**: Disabled
- **Stealth Mode**: Disabled

**Status**: Your system is properly configured for development.

---

## 🌐 Network Settings

### Localhost Configuration
```
127.0.0.1  localhost          # IPv4
::1        localhost          # IPv6
```

Both IPv4 and IPv6 localhost are properly configured.

---

## 🚪 Port Configuration

### Application Ports
| Service | Port | Protocol | Status |
|---------|------|----------|--------|
| Backend (Express) | 3001 | HTTP/TCP | ✅ Open |
| Frontend (Vite) | 5175 | HTTP/TCP | ✅ Open |
| Uploads | /backend/uploads | Filesystem | ✅ Ready |

### Port Availability Check
```bash
# Check if port is in use
lsof -i :3001
lsof -i :5175

# Kill process on port (if needed)
lsof -ti :3001 | xargs kill -9
```

---

## 🔗 Connectivity

### Backend API Access
```bash
# Health check
curl http://localhost:3001/health

# Get topics
curl http://localhost:3001/topics

# Get question by topic
curl http://localhost:3001/api/behavioral
```

### Frontend Access
```bash
# Check if frontend is responding
curl http://localhost:5175
```

---

## 🛡️ Security Recommendations

### For Development (Current Setup)
- ✅ Firewall in "Allow all" mode
- ✅ Localhost only access
- ✅ No authentication required
- ✅ CORS enabled for development

### For Production Deployment
```bash
# Enable firewall restrictions
# 1. Change firewall to "Block all incoming connections"
# 2. Add specific app exceptions via System Preferences
# 3. Use environment-based CORS settings
# 4. Implement authentication (JWT, OAuth)
# 5. Use HTTPS/SSL certificates
# 6. Set up reverse proxy (nginx/Apache)
```

---

## 🔧 Environment Variables

Create `.env` file in `/backend` directory:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# OpenAI Configuration (Optional)
OPENAI_API_KEY=your_openai_api_key_here

# Frontend Configuration (in /frontend/.env)
VITE_API_URL=http://localhost:3001
```

---

## 🚀 Startup Scripts

### Manual Startup
```bash
# Terminal 1: Backend
cd /Users/admin/Documents/Projects/voice-ai-agent/backend
node server.js

# Terminal 2: Frontend
cd /Users/admin/Documents/Projects/voice-ai-agent/frontend
npm run dev
```

### Combined Startup (using &)
```bash
# Start both in background
cd /Users/admin/Documents/Projects/voice-ai-agent
./start-dev.sh
```

---

## 🧪 Testing Connectivity

### Quick Test Suite
```bash
#!/bin/bash

echo "Testing TalkScout Connectivity..."

# Backend tests
echo "1. Backend health..."
curl -s http://localhost:3001/health | jq .

# Frontend tests
echo "2. Frontend availability..."
curl -s http://localhost:5174 | grep -o "<title>.*</title>"

# API tests
echo "3. Topics endpoint..."
curl -s http://localhost:3001/topics | jq '.topics | length'

echo "✅ All systems operational!"
```

---

## ⚠️ Firewall Troubleshooting

### Issue: Cannot connect to backend/frontend
1. **Check if services are running**
   ```bash
   lsof -i :3001
   lsof -i :5174
   ```

2. **Check firewall status**
   ```bash
   system_profiler SPFirewallDataType
   ```

3. **Verify localhost resolution**
   ```bash
   ping localhost
   ping 127.0.0.1
   ```

4. **Clear DNS cache (if needed)**
   ```bash
   sudo dscacheutil -flushcache
   ```

### Issue: Port already in use
```bash
# Kill process using port
lsof -ti :3001 | xargs kill -9

# Or specify different port
PORT=3002 node server.js
```

### Issue: IPv6 connectivity problems
```bash
# Test IPv6
curl -6 http://[::1]:3001/health

# Disable IPv6 if needed (advanced)
# System Preferences > Network > Advanced > TCP/IP
```

---

## 📊 System Information

### Check your network setup
```bash
# See all listening ports
lsof -i -P -n

# See specific protocol info
netstat -an | grep LISTEN

# DNS information
scutil --dns

# Network interfaces
ifconfig
```

---

## ✅ Verification Checklist

- [ ] Firewall configured in "Allow all" mode for development
- [ ] Backend running on port 3001
- [ ] Frontend running on port 5174+
- [ ] curl http://localhost:3001/health returns 200 OK
- [ ] curl http://localhost:5174 returns HTML
- [ ] No port conflicts or firewall blocks
- [ ] Environment variables configured
- [ ] OpenAI API key added (if using voice features)

---

## 📞 Support

If you encounter firewall-related issues:

1. Run the diagnostic script
   ```bash
   bash check-firewall.sh
   ```

2. Check system firewall settings
   - System Preferences > Security & Privacy > Firewall

3. Restart services
   ```bash
   lsof -ti :3001 | xargs kill -9
   lsof -ti :5174 | xargs kill -9
   npm run dev  # Restart both services
   ```

---

**Last Updated**: March 10, 2026
**Configuration Status**: ✅ Verified and Operational
