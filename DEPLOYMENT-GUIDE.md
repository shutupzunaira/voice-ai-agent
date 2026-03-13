# 🚀 Deployment & Testing Guide

## Pre-Launch Checklist

### 1. Syntax Validation
```bash
cd backend
node -c server.js  # ✓ Should output nothing (no errors)
```

### 2. Run Server Locally
```bash
npm run dev
# Expected output:
# ✓ Backend listening on 3001
# ✓ Frontend running on 5175
```

### 3. Health Check
```bash
curl http://localhost:3001/health | jq
# Should show server status, AI providers configured, fallback chain
```

## Testing Sequence

### Phase 1: Tool System Verification

#### 1.1 View Available Tools
```bash
curl http://localhost:3001/api/test/tool-calling | jq
```

**Expected Output:**
- ✓ 4 tools listed
- ✓ 3 test scenarios shown
- ✓ Doctor count: 4
- ✓ Available dates displayed

#### 1.2 Direct Tool Test
```bash
curl -X POST http://localhost:3001/api/test/simulate-booking \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "Test User",
    "phoneNumber": "555-0001",
    "date": "2026-03-14",
    "time": "09:00"
  }' | jq '.databaseSnapshot'
```

**Expected Output:**
```json
{
  "totalAppointments": 1,
  "appointmentCreated": true,
  "slotRemoved": true
}
```

#### 1.3 Verify State Persistence
```bash
curl http://localhost:3001/api/test/appointments | jq '.appointments | length'
```

**Expected:** `1` (appointment created in Phase 1.2)

### Phase 2: API Endpoint Testing

#### 2.1 Book Appointment via Endpoint
```bash
curl -X POST http://localhost:3001/api/voice-agent/book-appointment \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "Jane Smith",
    "phoneNumber": "555-0002",
    "date": "2026-03-15",
    "time": "10:00",
    "reason": "Follow-up visit"
  }' | jq '.toolResult.success'
```

**Expected:** `true`

#### 2.2 Check Available Slots
```bash
curl "http://localhost:3001/api/voice-agent/check-slots?date=2026-03-16" | jq '.toolResult.slots | length'
```

**Expected:** A number > 0 (available slots remain)

#### 2.3 Get Clinic Info
```bash
curl http://localhost:3001/api/voice-agent/clinic-info | jq '.doctors | length'
```

**Expected:** `4` doctors

#### 2.4 View Patient Appointments
```bash
curl "http://localhost:3001/api/voice-agent/my-appointments?phoneNumber=555-0002" | jq '.appointments | length'
```

**Expected:** `1` (appointment from 2.1)

### Phase 3: Triage Integration

#### 3.1 Start Triage Session
```bash
SESS=$(curl -s -X POST http://localhost:3001/api/triage/start \
  -H "Content-Type: application/json" \
  -d '{"chiefComplaint":"Need appointment"}' | jq -r '.sessionId')

echo "Session ID: $SESS"
```

**Expected:** Session ID printed (e.g., `sess_abc123def456`)

#### 3.2 Test Tool Calling via Triage
```bash
curl -X POST http://localhost:3001/api/triage/answer \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESS\",
    \"userAnswer\": \"Please book me an appointment next Monday at 2 PM\",
    \"patientPhone\": \"555-0003\"
  }" | jq '.toolExecuted'
```

**Expected:** `true` (tool was executed!)

#### 3.3 Verify Appointment Created
```bash
curl http://localhost:3001/api/test/appointments | jq '.appointments | length'
```

**Expected:** `3` (appointment from 3.2 added to previous 2)

### Phase 4: Error Handling

#### 4.1 Invalid Slot (Sunday Closed)
```bash
curl -X POST http://localhost:3001/api/voice-agent/book-appointment \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "Error Test",
    "phoneNumber": "555-0004",
    "date": "2026-03-17",
    "time": "14:00"
  }' | jq '.toolResult.error'
```

**Expected:** Error message about clinic being closed

#### 4.2 Already Booked Slot
```bash
curl -X POST http://localhost:3001/api/voice-agent/book-appointment \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "Duplicate Test",
    "phoneNumber": "555-0005",
    "date": "2026-03-14",
    "time": "09:00"
  }' | jq '.toolResult.error'
```

**Expected:** Error message about time not available (already booked in Phase 1.2)

#### 4.3 Missing Fields
```bash
curl -X POST http://localhost:3001/api/voice-agent/book-appointment \
  -H "Content-Type: application/json" \
  -d '{"patientName": "Incomplete"}' | jq '.success'
```

**Expected:** `false` with error about missing fields

### Phase 5: Scenario Testing

#### 5.1 Full Booking Flow
```bash
# 1. Get available slots
SLOTS=$(curl -s "http://localhost:3001/api/voice-agent/check-slots?date=2026-03-18" | jq '.toolResult.slots[0]')
echo "Available time: $SLOTS"

# 2. Book appointment
curl -X POST http://localhost:3001/api/voice-agent/book-appointment \
  -H "Content-Type: application/json" \
  -d "{
    \"patientName\": \"Full Flow Test\",
    \"phoneNumber\": \"555-0006\",
    \"date\": \"2026-03-18\",
    \"time\": $SLOTS,
    \"reason\": \"Complete workflow test\"
  }" | jq '.toolResult.appointmentID'

# 3. Verify it exists
curl "http://localhost:3001/api/voice-agent/my-appointments?phoneNumber=555-0006" | jq '.appointments[0]'
```

**Expected:** 
- Time slot returned
- Appointment ID generated
- Appointment appears in patient record

#### 5.2 Reschedule Flow
```bash
# 1. Get last appointment ID
APT=$(curl -s "http://localhost:3001/api/test/appointments" | jq -r '.appointments[-1].appointmentID')
echo "Appointment to reschedule: $APT"

# 2. Reschedule to different time
curl -X POST http://localhost:3001/api/voice-agent/reschedule \
  -H "Content-Type: application/json" \
  -d "{
    \"appointmentID\": \"$APT\",
    \"newDate\": \"2026-03-16\",
    \"newTime\": \"15:00\"
  }" | jq '.toolResult.success'

# 3. Verify status changed
curl -s "http://localhost:3001/api/test/appointments" | jq '.appointments[-1].status'
```

**Expected:** `true`, then status should be `"rescheduled"`

#### 5.3 Cancel Flow
```bash
# 1. Get an appointment to cancel
APT=$(curl -s "http://localhost:3001/api/test/appointments" | jq -r '.appointments[0].appointmentID')

# 2. Cancel it
curl -X POST http://localhost:3001/api/voice-agent/cancel \
  -H "Content-Type: application/json" \
  -d "{\"appointmentID\": \"$APT\"}" | jq '.toolResult.success'

# 3. Verify status change
curl -s "http://localhost:3001/api/test/appointments" | jq ".appointments[] | select(.appointmentID == \"$APT\") | .status"
```

**Expected:** `true`, then status should be `"cancelled"`

## Production Deployment

### Prerequisites
- Node.js 18+
- Gemini/Vertex AI/OpenAI API keys
- SSL certificate (recommended)
- Rate limiting configured

### Environment Variables
```bash
# Required
GEMINI_API_KEY=your_key
VERTEX_AI_API_KEY=your_key
VERTEX_AI_PROJECT=your_project
VERTEX_AI_REGION=us-central1

# Optional
OPENAI_API_KEY=your_key
PORT=3001
NODE_ENV=production
```

### Deployment Steps

```bash
# 1. Clone repository
git clone <repo>
cd voice-ai-agent

# 2. Install dependencies
npm install
npm run install:all

# 3. Set environment variables
cp backend/.env.example backend/.env
# Edit .env with actual keys

# 4. Run tests
npm run test  # If tests exist

# 5. Start in production
NODE_ENV=production npm run dev

# OR with PM2
npm install -g pm2
pm2 start backend/server.js --name "voice-agent"
pm2 startup
pm2 save
```

### Production Considerations

#### Database
- Current: In-memory (don't use for production!)
- Recommended: PostgreSQL or MongoDB
- Add migration: Replace Medical_DB with database calls

#### Security
- Add authentication (JWT/OAuth)
- Rate limiting on endpoints
- Input validation and sanitization
- HTTPS/SSL enforcement
- HIPAA compliance certification

#### Monitoring
- Error logging (Sentry/LogRocket)
- Performance monitoring (New Relic/DataDog)
- Uptime monitoring
- Database backups

#### Scaling
- Load balancing (Nginx)
- Session management (Redis)
- Database connection pooling
- CDN for static assets

## Troubleshooting

### Server Won't Start
```bash
# Check syntax
node -c backend/server.js

# Check port is available
lsof -i :3001

# Check dependencies
npm install
```

### Tools Not Executing
```bash
# Verify endpoints exist
curl http://localhost:3001/api/test/tool-calling

# Check request format matches examples
# Ensure all required fields present
```

### Appointments Not Persisting
- System uses in-memory database
- Appointments lost on server restart
- **Expected behavior** (add database for persistence)

### Triage Not Calling Tools
- Ensure user message matches intent patterns
- Check phone number provided
- Verify date/time extraction works

### API Errors
- Review request body format
- Check JSON syntax
- Verify parameter names match documentation

## Performance Metrics

### Current Performance
- Tool execution: ~100ms (local execution)
- API response: ~200ms (with overhead)
- Triage + tool: ~300ms

### Optimization Opportunities
1. Cache doctor data
2. Batch database queries
3. Implement request caching
4. Use WebRTC for voice (reduce latency)
5. Add background job processing

## Rollback Procedure

If issues arise in production:

```bash
# 1. Stop current server
pm2 stop voice-agent

# 2. Revert to previous version
git checkout <previous_commit>
npm install

# 3. Start previous version
pm2 start voice-agent

# 4. Investigate issue
# Check logs, test locally, create fix

# 5. Deploy fix
git checkout <fixed_commit>
pm2 restart voice-agent
```

## Success Criteria

- [ ] Server starts without errors
- [ ] All 6 tool endpoints respond correctly
- [ ] Tool functions create real appointments
- [ ] Appointments persist during session
- [ ] Triage integrates with tools
- [ ] Error handling returns proper messages
- [ ] Frontend/backend communication works
- [ ] Voice I/O (STT/TTS) functions

---

**Status:** ✅ Ready for testing  
**Database:** In-memory (MVP only)  
**Version:** 1.0  
**Last Updated:** 2026-03-13
