# 🎯 Quick Start: Voice Agent Tool Calling

## 60-Second Overview

Your Virtual Clinic Voice Agent now has **autonomous appointment booking** with real database changes.

## Test It Now

### 1. Check Available Tools
```bash
curl http://localhost:3001/api/test/tool-calling | jq
```

### 2. Book a Test Appointment
```bash
curl -X POST http://localhost:3001/api/test/simulate-booking \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "Test Patient",
    "phoneNumber": "555-9999",
    "date": "2026-03-14",
    "time": "09:00"
  }' | jq
```

### 3. Verify It Was Created
```bash
curl http://localhost:3001/api/test/appointments | jq '.appointments'
```

✅ You'll see your appointment in the database!

## All Available Endpoints

### Medical Appointment Tools

| Tool | Method | Endpoint | Trigger |
|------|--------|----------|---------|
| **Book** | POST | `/api/voice-agent/book-appointment` | "book me an appointment" |
| **Check Slots** | GET | `/api/voice-agent/check-slots?date=YYYY-MM-DD` | "what times available?" |
| **Reschedule** | POST | `/api/voice-agent/reschedule` | "reschedule my appointment" |
| **Cancel** | POST | `/api/voice-agent/cancel` | "cancel my appointment" |
| **Clinic Info** | GET | `/api/voice-agent/clinic-info` | "clinic hours?" |
| **My Appointments** | GET | `/api/voice-agent/my-appointments?phoneNumber=XXX` | "show my appointments" |

### Triage Integration

**Endpoint:** `POST /api/triage/answer`

**Now supports tool calling!**

```bash
curl -X POST http://localhost:3001/api/triage/answer \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess_abc123",
    "userAnswer": "Can you book me an appointment for Monday at 2 PM?",
    "patientPhone": "555-1234"
  }' | jq
```

**Response shows:**
- `toolExecuted: true` if a tool was triggered
- `toolName: "book_appointment"` which tool ran
- `toolResult: {...}` what the tool returned
- `confirmationMessage: "..."` what to say to user

## How It Works

```
User: "book appointment Monday 2 PM"
  ↓
System detects: book_appointment intent
  ↓
Backend executes: bookAppointment(...) 
  ↓
Medical_DB is modified (appointment created, slot removed)
  ↓
Response: "Appointment confirmed!"
```

## Key Features

✅ **Real State Changes** - Appointments actually created  
✅ **Intent Detection** - AI understands user requests  
✅ **Validation** - Checks available slots, clinic hours  
✅ **Error Handling** - Returns error if slot unavailable  
✅ **Confirmation** - Returns what to tell the user  

## Testing Commands

### Test All Scenarios
```bash
# View available doctors and slots
curl http://localhost:3001/api/voice-agent/clinic-info | jq

# Check what slots are free on a date
curl "http://localhost:3001/api/voice-agent/check-slots?date=2026-03-14" | jq

# Book an appointment directly
curl -X POST http://localhost:3001/api/voice-agent/book-appointment \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "Jane Smith",
    "phoneNumber": "555-5678",
    "date": "2026-03-14",
    "time": "10:00",
    "reason": "Follow-up visit"
  }' | jq

# View all booked appointments
curl http://localhost:3001/api/test/appointments | jq
```

## Database Check

See real appointments created:
```bash
curl http://localhost:3001/api/test/appointments | jq '.appointments | length'
```

Shows count of actual appointments in system.

## Doctors Available

- Dr. Sarah Smith (General Practice) ✓ Available
- Dr. Michael Johnson (Cardiology) ✓ Available  
- Dr. Emily Lee (Pediatrics) ✓ Available
- Dr. Rajesh Patel (Orthopedics) ✗ Not accepting new patients

## Clinic Hours

- **Monday-Friday:** 9:00 AM - 5:00 PM
- **Saturday:** 10:00 AM - 2:00 PM
- **Sunday:** CLOSED

## Available Dates

- **Monday (3/14):** ✅ Slots open
- **Tuesday (3/15):** ✅ Slots open
- **Wednesday (3/16):** ✅ Slots open
- **Thursday (3/17):** ❌ CLOSED (Sunday)
- **Friday (3/18):** ✅ Slots open

## Error Examples

### Invalid Slot
```bash
curl -X POST http://localhost:3001/api/voice-agent/book-appointment \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "John",
    "phoneNumber": "555-1234",
    "date": "2026-03-17",
    "time": "14:00"
  }' | jq '.toolResult.error'
```

Response: `"Time slot 14:00 is not available on 2026-03-17"`

(Because Sunday is closed!)

## Health-Only Scope

✓ **ONLY medical appointment booking** (no other use cases)  
✓ **Focused on clinic intake** (appointment scheduling)  
✓ **Emergency-aware** (detects emergencies in triage)  
✓ **Patient-centric** (personal appointment management)  

## Next Phase

### Frontend Call
```javascript
// In React component
const response = await fetch('/api/triage/answer', {
  method: 'POST',
  body: JSON.stringify({
    sessionId: id,
    userAnswer: speechRecognitionText,
    patientPhone: phoneNumber
  })
});

if (response.toolExecuted) {
  const message = response.confirmationMessage;
  // Speak message aloud via TTS
  speechSynthesis.speak(new SpeechSynthesisUtterance(message));
}
```

### Voice Integration
Connect STR → Tool Detection → TTS for full voice flow

## Troubleshooting

**Q: Appointment not created?**  
A: Check that date/time slot is available with `/api/voice-agent/check-slots`

**Q: Getting error about missing fields?**  
A: All of these required: patientName, phoneNumber, date, time, reason

**Q: Want to change available times?**  
A: Edit `Medical_DB.availableSlots` in `backend/server.js`

**Q: Appointments disappear after restart?**  
A: Database is in-memory (as designed). For persistence, add database layer (MongoDB, PostgreSQL, etc.)

---

**Status:** ✅ Ready for testing and integration with frontend
