# TalkScout - Network & Firewall Troubleshooting Guide

## 🎯 Quick Status Check

Run this to verify everything is working:

```bash
bash /Users/admin/Documents/Projects/voice-ai-agent/check-firewall.sh
```

**Expected Output**:
- ✅ Firewall: Allow all incoming connections
- ✅ Backend (port 3001): Available
- ✅ Frontend (port 5176): Available
- ✅ localhost (127.0.0.1): configured
- ✅ IPv6 localhost (::1): configured
- ✅ Backend server running
- ✅ Frontend dev server running

---

## 🚀 Quick Start

### Option 1: Automated Start (Recommended)
```bash
cd /Users/admin/Documents/Projects/voice-ai-agent
bash start-dev.sh
```

### Option 2: Manual Start
```bash
# Terminal 1: Backend
cd /Users/admin/Documents/Projects/voice-ai-agent/backend
node server.js

# Terminal 2: Frontend
cd /Users/admin/Documents/Projects/voice-ai-agent/frontend
npm run dev
```

### Option 3: Background Start
```bash
cd /Users/admin/Documents/Projects/voice-ai-agent/backend && node server.js &
cd /Users/admin/Documents/Projects/voice-ai-agent/frontend && npm run dev &
```

---

## 🔍 Debugging Common Issues

### Issue: "Cannot connect to localhost:3001"

**Step 1: Check if backend is running**
```bash
lsof -i :3001
```
**Expected**: Should show `node` process listening on port 3001

**If not running**: Start the backend
```bash
cd /Users/admin/Documents/Projects/voice-ai-agent/backend
node server.js
```

**Step 2: Test connectivity**
```bash
curl http://localhost:3001/health
```
**Expected**: JSON response with status

**Step 3: Check firewall**
```bash
system_profiler SPFirewallDataType | grep Mode
```
**Expected**: "Allow all incoming connections"

---

### Issue: "Port 3001 already in use"

**Find and kill the process**:
```bash
lsof -ti :3001 | xargs kill -9
```

**Or use different port**:
```bash
PORT=3002 node server.js
```

---

### Issue: "Frontend not loading (Port 5176)"

**Step 1: Check if frontend is running**
```bash
lsof -i :5176,5177,5178,5179
```
**Expected**: Should show `npm` or `node` process

**Step 2: Try alternative ports**
Vite is configured for strict port 5176. If 5176 is in use, it will fail. Check if another process is using it.

**Step 3: Check logs**
```bash
cd /Users/admin/Documents/Projects/voice-ai-agent/frontend
npm run dev
```

---

### Issue: "localhost not resolving"

**Check DNS resolution**:
```bash
ping localhost
ping 127.0.0.1
ping ::1
```

**Expected**: All should be reachable

**Fix localhost entry** (if needed):
```bash
cat /etc/hosts | grep localhost
```

Should show:
```
127.0.0.1 localhost
::1 localhost
```

---

### Issue: "Cannot access frontend from other machine"

**This is expected** - localhost only allows local connections.

**To allow network access**:

1. Find your machine's IP:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

2. Start server on 0.0.0.0 to listen on all interfaces:
   ```bash
   # Backend
   cd backend
   HOST=0.0.0.0 PORT=3001 node server.js
   
   # Frontend
   cd frontend
   npm run dev -- --host 0.0.0.0
   ```

3. Access from other machine:
   ```bash
   http://<YOUR_IP>:3001
   http://<YOUR_IP>:5174
   ```

4. Update frontend API URL:
   ```bash
   # In frontend/.env or hardcode in InterviewPage.jsx
   VITE_API_URL=http://<YOUR_IP>:3001
   ```

---

## 🔐 Firewall Configuration

### Current Settings ✅
```
Mode: Allow all incoming connections
IPv4: 127.0.0.1 (localhost)
IPv6: ::1 (localhost)
CORS: Enabled for development
```

### For Production Setup

**1. Enable stricter firewall**:
   - System Preferences → Security & Privacy → Firewall
   - Click "Firewall Options"
   - Select "Block all incoming connections"
   - Add exceptions for Node.js and required services

**2. Create .env for production**:
   ```bash
   NODE_ENV=production
   CORS_ORIGINS=yourdomain.com
   TRUST_PROXY=true
   ```

**3. Use reverse proxy** (nginx/Apache):
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3001;
           proxy_set_header Host $host;
       }
   }
   ```

---

## 📊 Network Diagnostics

### View all listening ports
```bash
lsof -i -P -n | grep LISTEN
```

### View processes by port
```bash
# macOS specific
lsof -i :3001
lsof -i :5174
```

### Check network statistics
```bash
netstat -an | grep LISTEN
```

### DNS configuration
```bash
scutil --dns
```

### Active network interfaces
```bash
ifconfig
```

---

## 🛠️ Useful Commands

### Kill all Node processes
```bash
pkill -f "node"
```

### Clear all development ports
```bash
lsof -ti :3001 | xargs kill -9 2>/dev/null || true
lsof -ti :5174 | xargs kill -9 2>/dev/null || true
```

### View running services
```bash
ps aux | grep -E "node|npm|vite"
```

### Check system firewall
```bash
system_profiler SPFirewallDataType
```

### Clear DNS cache (if needed)
```bash
sudo dscacheutil -flushcache
```

### Test API endpoints
```bash
# Health check
curl http://localhost:3001/health

# Get topics
curl http://localhost:3001/topics

# Get question
curl http://localhost:3001/api/behavioral

# Submit answer
curl -X POST http://localhost:3001/answer \
  -H "Content-Type: application/json" \
  -d '{"answer": "Test answer", "topic": "behavioral"}'
```

---

## ✅ Verification Checklist

Before reporting issues, verify all of these:

- [ ] Backend running: `lsof -i :3001` shows node process
- [ ] Frontend running: `lsof -i :5174` shows npm process
- [ ] Backend health: `curl http://localhost:3001/health` returns 200
- [ ] Frontend loads: `curl http://localhost:5174` returns HTML
- [ ] Firewall check: `system_profiler SPFirewallDataType` shows "Allow all"
- [ ] Localhost resolves: `ping localhost` and `ping ::1` work
- [ ] No syntax errors: `node -c /path/to/server.js` passes
- [ ] Dependencies installed: `npm install` in both backend and frontend
- [ ] Environment variables: Check .env files exist
- [ ] Ports not blocked: No "Address already in use" errors

---

## 📝 Logs & Debugging

### View backend logs
```bash
tail -f /tmp/talkscout-backend.log
```

### View frontend logs
```bash
tail -f /tmp/talkscout-frontend.log
```

### Check Node version
```bash
node --version
npm --version
```

### Verbose curl output
```bash
curl -v http://localhost:3001/health
```

### Test with different protocols
```bash
# IPv4
curl http://127.0.0.1:3001/health

# IPv6
curl http://[::1]:3001/health

# Hostname
curl http://localhost:3001/health
```

---

## 🚨 Emergency Reset

If everything is broken and you need to start fresh:

```bash
# Kill all processes
pkill -f "node"
pkill -f "npm"
pkill -f "vite"

# Clear ports
lsof -ti :3001,:5174,:5175,:5176,:5177 | xargs kill -9 2>/dev/null || true

# Reinstall dependencies
cd /Users/admin/Documents/Projects/voice-ai-agent/backend && rm -rf node_modules && npm install
cd /Users/admin/Documents/Projects/voice-ai-agent/frontend && rm -rf node_modules && npm install

# Start fresh
cd /Users/admin/Documents/Projects/voice-ai-agent
bash start-dev.sh
```

---

## 📞 Support Resources

| Issue | Command |
|-------|---------|
| Check firewall | `system_profiler SPFirewallDataType` |
| Check ports | `lsof -i -P -n` |
| Kill process | `lsof -ti :PORT \| xargs kill -9` |
| Test backend | `curl http://localhost:3001/health` |
| Test frontend | `curl http://localhost:5174` |
| View logs | `tail -f /tmp/talkscout-*.log` |
| Full reset | `bash start-dev.sh` |

---

**Last Updated**: March 10, 2026
**Status**: ✅ All systems operational and verified
