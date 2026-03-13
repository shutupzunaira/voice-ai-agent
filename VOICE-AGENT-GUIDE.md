# 🎤 Autonomous Voice Agent - Tool Calling System

## Overview

The **Virtual Clinic Voice Agent** is now equipped with **autonomous tool-calling capabilities** for medical appointment scheduling. This means the AI can:

1. **Understand intent** - Recognize when users want to book, reschedule, or cancel appointments
2. **Execute tools** - Actually call backend functions that create real appointments
3. **Manage state** - Persist changes to the database (appointments are truly created)
4. **Confirm actions** - Provide immediate feedback with confirmation details

## 🔧 Core Features

### Autonomous Tool Execution

The system implements **real state changes** - not just conversational acknowledgment:

```
User Input → Intent Detection → Tool Invocation → State Change → User Confirmation
```

**Example Flow:**
```
User: "Can you book me an appointment on Monday at 2 PM?"
   ↓
AI detects: book_appointment intent
   ↓
Backend executes: bookAppointment("John Doe", "555-1234", "2026-03-14", "14:00", "Check-up")
   ↓
Medical_DB.appointments array is modified ✓
Available slots are reduced ✓
   ↓
Response: "Great! I've booked your appointment for Monday, March 14th at 2:00 PM with Dr. Sarah Smith."
```

## 📋 Available Medical Tools

### 1. Book Appointment
**Endpoint:** `POST /api/voice-agent/book-appointment`

**Trigger Patterns:**
- "book me an appointment"
- "schedule an appointment"
- "get an appointment"
- "appointment for next Monday"

**Request:**
```json
{
  "patientName": "John Doe",
  "phoneNumber": "555-1234",
  "date": "2026-03-14",
  "time": "14:00",
  "reason": "Annual check-up"
}
```

**Response (Success):**
```json
{
  "success": true,
  "toolName": "book_appointment",
  "toolResult": {
    "success": true,
    "appointmentID": "APT_1234567890",
    "message": "Appointment confirmed...",
    "appointment": {
      "appointmentID": "APT_1234567890",
      "patientName": "John Doe",
      "date": "2026-03-14",
      "time": "14:00",
      "status": "confirmed"
    }
  }
}
```

**State Change:** 
- New appointment added to `Medical_DB.appointments` array
- Time slot removed from `Medical_DB.availableSlots["2026-03-14"]`

---

### 2. Check Available Slots
**Endpoint:** `GET /api/voice-agent/check-slots?date=2026-03-14`

**Trigger Patterns:**
- "What times are available?"
- "When can I get an appointment?"
- "Show me available slots"
- "What times do you have?"

**Response (Success):**
```json
{
  "success": true,
  "toolName": "check_available_slots",
  "toolResult": {
    "success": true,
    "slots": ["09:00", "10:00", "14:00", "15:30"],
    "date": "2026-03-14"
  }
}
```

---

### 3. Reschedule Appointment
**Endpoint:** `POST /api/voice-agent/reschedule`

**Trigger Patterns:**
- "reschedule my appointment"
- "move my appointment"
- "change the time"
- "different time please"

**Request:**
```json
{
  "appointmentID": "APT_1234567890",
  "newDate": "2026-03-15",
  "newTime": "10:00"
}
```

**Response (Success):**
```json
{
  "success": true,
  "toolName": "reschedule_appointment",
  "toolResult": {
    "success": true,
    "message": "Appointment rescheduled to 2026-03-15 at 10:00",
    "appointment": {
      "appointmentID": "APT_1234567890",
      "date": "2026-03-15",
      "time": "10:00",
      "status": "rescheduled"
    }
  }
}
```

**State Change:**
- Old time slot restored to availability
- New time slot removed from availability
- Appointment record updated

---

### 4. Cancel Appointment
**Endpoint:** `POST /api/voice-agent/cancel`

**Trigger Patterns:**
- "cancel my appointment"
- "remove my appointment"
- "I don't need the appointment"
- "delete my appointment"

**Request:**
```json
{
  "appointmentID": "APT_1234567890"
}
```

**Response (Success):**
```json
{
  "success": true,
  "toolName": "cancel_appointment",
  "toolResult": {
    "success": true,
    "message": "Appointment APT_1234567890 has been cancelled"
  }
}
```

**State Change:**
- Appointment marked as "cancelled"
- Time slot restored to availability pool

---

### 5. Get Clinic Information
**Endpoint:** `GET /api/voice-agent/clinic-info`

**Response:**
```json
{
  "success": true,
  "clinicName": "Virtual Clinic",
  "clinicHours": {
    "monday": "9:00 AM - 5:00 PM",
    "tuesday": "9:00 AM - 5:00 PM",
    ...
    "sunday": "CLOSED"
  },
  "doctors": [
    {
      "id": "dr_smith",
      "name": "Dr. Sarah Smith",
      "specialty": "General Practice",
      "available": true
    },
    ...
  ]
}
```

---

### 6. Get Patient Appointments
**Endpoint:** `GET /api/voice-agent/my-appointments?phoneNumber=555-1234`

**Response:**
```json
{
  "success": true,
  "appointmentCount": 2,
  "appointments": [
    {
      "appointmentID": "APT_1234567890",
      "patientName": "John Doe",
      "date": "2026-03-14",
      "time": "14:00",
      "status": "confirmed"
    }
  ]
}
```

## 🧠 Intent Detection Logic

The system detects user intent through pattern matching on the user's message:

```javascript
// BOOK pattern
/(\bbook\b|\bschedule\b|\bmake\b|\bget\b)\s*(\ban\s*)?appointment/i

// RESCHEDULE pattern
/reschedule|move|change.*appointment|different.*time/i

// CANCEL pattern
/cancel|remove|delete.*appointment|don't need/i

// AVAILABILITY pattern
/available|when.*can\s*i|what times?|next.*opening/i
```

**Example Matches:**
- ✅ "Book me an appointment Monday" → triggers book_appointment
- ✅ "Can you reschedule to 3 PM?" → triggers reschedule_appointment
- ✅ "Cancel my appointment" → triggers cancel_appointment
- ✅ "What times do you have?" → triggers check_slots

## 🗄️ Medical Database (In-Memory)

### Structure

```javascript
Medical_DB = {
  appointments: [
    {
      appointmentID: "APT_1234567890",
      patientName: "John Doe",
      phoneNumber: "555-1234",
      date: "2026-03-14",
      time: "14:00",
      reason: "Annual check-up",
      doctorID: "dr_smith",
      bookedAt: "2026-03-13T10:30:00Z",
      status: "confirmed"
    }
  ],
  
  doctors: [
    { id: "dr_smith", name: "Dr. Sarah Smith", specialty: "General Practice", available: true },
    { id: "dr_johnson", name: "Dr. Michael Johnson", specialty: "Cardiology", available: true },
    { id: "dr_lee", name: "Dr. Emily Lee", specialty: "Pediatrics", available: true },
    { id: "dr_patel", name: "Dr. Rajesh Patel", specialty: "Orthopedics", available: false }
  ],
  
  availableSlots: {
    "2026-03-14": ["09:00", "09:30", "10:00", "10:30", "14:00", "14:30", "15:00"],
    "2026-03-15": ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"],
    "2026-03-16": ["09:30", "10:30", "11:30", "14:30", "15:30"],
    "2026-03-17": [],  // Sunday - closed
    "2026-03-18": ["09:00", "09:30", "10:00", "13:00", "14:00", "15:00", "15:30"]
  },
  
  clinicHours: {
    monday: "9:00 AM - 5:00 PM",
    tuesday: "9:00 AM - 5:00 PM",
    wednesday: "9:00 AM - 5:00 PM",
    thursday: "9:00 AM - 5:00 PM",
    friday: "9:00 AM - 5:00 PM",
    saturday: "10:00 AM - 2:00 PM",
    sunday: "CLOSED"
  }
}
```

## 🧪 Testing Tools

### 1. View Tool Calling Demo
```bash
curl http://localhost:3001/api/test/tool-calling
```

**Response shows:**
- Available tools
- Example test scenarios
- Database status

### 2. Simulate Appointment Booking
```bash
curl -X POST http://localhost:3001/api/test/simulate-booking \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "John Doe",
    "phoneNumber": "555-1234",
    "date": "2026-03-14",
    "time": "09:00"
  }'
```

**Verifies:**
- Tool execution works
- Appointment is created in database
- Slot is removed from availability

### 3. Check All Appointments
```bash
curl http://localhost:3001/api/test/appointments
```

**Shows:**
- Total appointments created
- Full appointment records
- Available slots remaining

## 🔄 Integration Flow

### With Triage/Answer Endpoint
The `/api/triage/answer` endpoint now includes tool-calling:

```javascript
POST /api/triage/answer
{
  "sessionId": "sess_123",
  "userAnswer": "Can you book me an appointment for Monday at 2 PM?",
  "patientPhone": "555-1234"
}
```

**Response includes:**
```json
{
  "success": true,
  "toolExecuted": true,
  "toolName": "book_appointment",
  "toolResult": { ... },
  "confirmationMessage": "Great! I've booked your appointment for Monday, March 14th at 2:00 PM with Dr. Sarah Smith."
}
```

## 🛡️ Key Implementation Details

### Real State Changes
Unlike systems that merely **describe** actions, this implementation:
- ✅ Actually modifies `Medical_DB.appointments` array
- ✅ Removes booked slots from `Medical_DB.availableSlots`
- ✅ Persists changes during session (in-memory)
- ✅ Returns verification that state changed

### Error Handling
All tool functions validate inputs:
```javascript
if (!slots || !slots.includes(time)) {
  return { success: false, error: `Time slot ${time} is not available on ${date}` }
}
```

### Confirmation Messages
Tools return structured results that frontend can convert to human-readable confirmations:
```javascript
"Great! I've booked your appointment for March 14th at 2:00 PM with Dr. Sarah Smith."
```

## 🚀 Hackathon Requirements Met

✅ **Tool Use** - AI detects intent and calls tool functions
✅ **Real State Change** - Appointments actually created in database
✅ **Verification** - Medical_DB.appointments grows with bookings
✅ **Error Detection** - Invalid slots/dates return error messages
✅ **Autonomous Execution** - No human confirmation needed for valid requests

## 📱 Next Steps

### Frontend Integration
The frontend can call the triage/answer endpoint with tool-aware responses:

```javascript
// In TriagePage.jsx
const response = await fetch('/api/triage/answer', {
  method: 'POST',
  body: JSON.stringify({
    sessionId,
    userAnswer: "Book me Monday at 2 PM",
    patientPhone
  })
});

// If tool was executed:
if (response.toolExecuted && response.toolResult.success) {
  // Show confirmation
  speak(response.confirmationMessage);
}
```

### Voice Integration
With WebRTC/Vapi SDK, this becomes:

```
User: *[speaks]* "Book appointment Monday 2 PM"
  ↓
STR → "Book appointment Monday 2 PM"
  ↓
Tool Detection → book_appointment
  ↓
AI calls: POST /api/voice-agent/book-appointment
  ↓
Appointment created in database
  ↓
AI generates: "Appointment confirmed for Monday at 2 PM"
  ↓
TTS → *[speaker plays response]*
```

## ⚙️ Configuration

### Environment Variables
```bash
VERTEX_AI_API_KEY=your_key
GEMINI_API_KEY=your_key
OPENAI_API_KEY=your_key
```

### Clinic Settings
Edit `Medical_DB` in server.js to:
- Add/remove doctors
- Adjust available dates and times
- Modify clinic hours
- Change appointment reasons

## 📞 Support

For issues with:
- **Tool execution** - Check `/api/test/appointments` to verify state changes
- **Intent detection** - Adjust regex patterns in triage/answer endpoint
- **Database** - Review Medical_DB structure at top of server.js
- **API responses** - Enable request logging in triage/answer endpoint

---

**Status:** ✅ All medical appointment tools operational and autonomous
**Database:** In-memory (persists during session)
**Health-Only Scope:** ✓ No other use cases included
