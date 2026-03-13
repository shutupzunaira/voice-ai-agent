# 📡 Voice Agent API Reference

Complete REST API documentation for the Virtual Clinic Autonomous Voice Agent.

## Base URL
```
http://localhost:3001
```

---

## 🤖 Voice Agent Endpoints

### Book Appointment
Creates a new appointment in the Medical_DB with real state changes.

**Endpoint:**
```
POST /api/voice-agent/book-appointment
```

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "patientName": "John Doe",
  "phoneNumber": "555-1234",
  "date": "2026-03-14",
  "time": "14:00",
  "reason": "Annual check-up"
}
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| patientName | string | Yes | Full name of patient |
| phoneNumber | string | Yes | Contact phone number |
| date | string (YYYY-MM-DD) | Yes | Appointment date |
| time | string (HH:MM) | Yes | Appointment time in 24-hr format |
| reason | string | Yes | Chief complaint or reason |

**Response (Success):**
```json
{
  "success": true,
  "toolName": "book_medical_appointment",
  "toolResult": {
    "success": true,
    "appointmentID": "APT_1710329000123",
    "message": "Appointment confirmed for John Doe on 2026-03-14 at 14:00 with Dr. Sarah Smith",
    "appointment": {
      "appointmentID": "APT_1710329000123",
      "patientName": "John Doe",
      "phoneNumber": "555-1234",
      "date": "2026-03-14",
      "time": "14:00",
      "reason": "Annual check-up",
      "doctorID": "dr_smith",
      "bookedAt": "2026-03-13T10:30:00.123Z",
      "status": "confirmed"
    }
  },
  "timestamp": "2026-03-13T10:30:00.123Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "toolName": "book_medical_appointment",
  "toolResult": {
    "success": false,
    "error": "Time slot 14:00 is not available on 2026-03-14"
  },
  "timestamp": "2026-03-13T10:30:00.123Z"
}
```

**Status Codes:**
- `200 OK` — Appointment processed (check success field)
- `400 Bad Request` — Missing required fields
- `500 Internal Server Error` — Server error

**State Changes:**
- ✅ Appointment added to `Medical_DB.appointments`
- ✅ Time slot removed from `Medical_DB.availableSlots[date]`

**Example Usage:**
```bash
curl -X POST http://localhost:3001/api/voice-agent/book-appointment \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "Jane Smith",
    "phoneNumber": "555-5678",
    "date": "2026-03-15",
    "time": "10:00",
    "reason": "Follow-up visit"
  }'
```

---

### Check Available Slots
Query available appointment times for a specific date.

**Endpoint:**
```
GET /api/voice-agent/check-slots?date=2026-03-14
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| date | string (YYYY-MM-DD) | Yes | Date to check availability |

**Response (Success - Slots Available):**
```json
{
  "success": true,
  "toolName": "check_available_slots",
  "toolResult": {
    "success": true,
    "slots": ["09:00", "10:00", "14:00", "15:30"],
    "date": "2026-03-14"
  },
  "timestamp": "2026-03-13T10:30:00.123Z"
}
```

**Response (Error - No Slots):**
```json
{
  "success": true,
  "toolName": "check_available_slots",
  "toolResult": {
    "success": false,
    "error": "All slots are full for 2026-03-17. The clinic is closed on Sundays."
  },
  "timestamp": "2026-03-13T10:30:00.123Z"
}
```

**Example Usage:**
```bash
curl "http://localhost:3001/api/voice-agent/check-slots?date=2026-03-14"
```

---

### Reschedule Appointment
Move an existing appointment to a different date/time.

**Endpoint:**
```
POST /api/voice-agent/reschedule
```

**Request Body:**
```json
{
  "appointmentID": "APT_1710329000123",
  "newDate": "2026-03-15",
  "newTime": "11:00"
}
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| appointmentID | string | Yes | ID of appointment to modify |
| newDate | string (YYYY-MM-DD) | Yes | New appointment date |
| newTime | string (HH:MM) | Yes | New appointment time |

**Response (Success):**
```json
{
  "success": true,
  "toolName": "reschedule_appointment",
  "toolResult": {
    "success": true,
    "message": "Appointment rescheduled to 2026-03-15 at 11:00",
    "appointment": {
      "appointmentID": "APT_1710329000123",
      "patientName": "John Doe",
      "phoneNumber": "555-1234",
      "date": "2026-03-15",
      "time": "11:00",
      "status": "rescheduled"
    }
  },
  "timestamp": "2026-03-13T10:30:00.123Z"
}
```

**State Changes:**
- ✅ Old time slot restored to availability
- ✅ New time slot removed from availability
- ✅ Appointment record updated with new date/time

**Example Usage:**
```bash
curl -X POST http://localhost:3001/api/voice-agent/reschedule \
  -H "Content-Type: application/json" \
  -d '{
    "appointmentID": "APT_1710329000123",
    "newDate": "2026-03-15",
    "newTime": "11:00"
  }'
```

---

### Cancel Appointment
Remove an appointment from the schedule.

**Endpoint:**
```
POST /api/voice-agent/cancel
```

**Request Body:**
```json
{
  "appointmentID": "APT_1710329000123"
}
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| appointmentID | string | Yes | ID of appointment to cancel |

**Response (Success):**
```json
{
  "success": true,
  "toolName": "cancel_appointment",
  "toolResult": {
    "success": true,
    "message": "Appointment APT_1710329000123 has been cancelled"
  },
  "timestamp": "2026-03-13T10:30:00.123Z"
}
```

**State Changes:**
- ✅ Appointment marked as "cancelled"
- ✅ Time slot restored to availability pool

**Example Usage:**
```bash
curl -X POST http://localhost:3001/api/voice-agent/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "appointmentID": "APT_1710329000123"
  }'
```

---

### Get Clinic Information
Retrieve doctor profiles, clinic hours, and services.

**Endpoint:**
```
GET /api/voice-agent/clinic-info
```

**Response:**
```json
{
  "success": true,
  "clinicName": "Virtual Clinic",
  "clinicHours": {
    "monday": "9:00 AM - 5:00 PM",
    "tuesday": "9:00 AM - 5:00 PM",
    "wednesday": "9:00 AM - 5:00 PM",
    "thursday": "9:00 AM - 5:00 PM",
    "friday": "9:00 AM - 5:00 PM",
    "saturday": "10:00 AM - 2:00 PM",
    "sunday": "CLOSED"
  },
  "doctors": [
    {
      "id": "dr_smith",
      "name": "Dr. Sarah Smith",
      "specialty": "General Practice",
      "available": true
    },
    {
      "id": "dr_johnson",
      "name": "Dr. Michael Johnson",
      "specialty": "Cardiology",
      "available": true
    },
    {
      "id": "dr_lee",
      "name": "Dr. Emily Lee",
      "specialty": "Pediatrics",
      "available": true
    },
    {
      "id": "dr_patel",
      "name": "Dr. Rajesh Patel",
      "specialty": "Orthopedics",
      "available": false
    }
  ],
  "address": "123 Medical Street, Health City, HC 12345",
  "phone": "+1-555-CLINIC-1",
  "supportedServices": [
    "General Practice",
    "Cardiology",
    "Pediatrics",
    "Orthopedics"
  ],
  "timestamp": "2026-03-13T10:30:00.123Z"
}
```

**Example Usage:**
```bash
curl http://localhost:3001/api/voice-agent/clinic-info
```

---

### Get Patient Appointments
Retrieve all appointments for a specific patient.

**Endpoint:**
```
GET /api/voice-agent/my-appointments?phoneNumber=555-1234
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phoneNumber | string | Yes | Patient's phone number |

**Response:**
```json
{
  "success": true,
  "appointmentCount": 2,
  "appointments": [
    {
      "appointmentID": "APT_1710329000123",
      "patientName": "John Doe",
      "phoneNumber": "555-1234",
      "date": "2026-03-14",
      "time": "14:00",
      "reason": "Annual check-up",
      "doctorID": "dr_smith",
      "bookedAt": "2026-03-13T10:30:00Z",
      "status": "confirmed"
    },
    {
      "appointmentID": "APT_1710329000456",
      "patientName": "John Doe",
      "phoneNumber": "555-1234",
      "date": "2026-03-21",
      "time": "10:00",
      "reason": "Follow-up",
      "doctorID": "dr_johnson",
      "bookedAt": "2026-03-13T11:00:00Z",
      "status": "confirmed"
    }
  ],
  "timestamp": "2026-03-13T10:30:00.123Z"
}
```

**Example Usage:**
```bash
curl "http://localhost:3001/api/voice-agent/my-appointments?phoneNumber=555-1234"
```

---

## 🩺 Medical Triage Endpoints

### Start Triage Session
Initialize a new medical assessment session.

**Endpoint:**
```
POST /api/triage/start
```

**Request Body:**
```json
{
  "chiefComplaint": "Headache"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "sess_abc123def456",
  "message": "Welcome to Virtual Clinic. I'm here to help assess your symptoms. Can you tell me more about your headache?",
  "nextQuestion": "How long have you had this headache?",
  "timestamp": "2026-03-13T10:30:00.123Z"
}
```

**Example Usage:**
```bash
curl -X POST http://localhost:3001/api/triage/start \
  -H "Content-Type: application/json" \
  -d '{
    "chiefComplaint": "I have a severe headache"
  }'
```

---

### Process Triage Answer (With Tool Calling!)
Submit a response to a triage question. **Now includes autonomous tool calling for appointments!**

**Endpoint:**
```
POST /api/triage/answer
```

**Request Body:**
```json
{
  "sessionId": "sess_abc123def456",
  "userAnswer": "Can you book me an appointment for Monday at 2 PM?",
  "patientPhone": "555-1234"
}
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string | Yes | Session ID from /triage/start |
| userAnswer | string | Yes | Patient's response |
| patientPhone | string | No | Patient phone for appointments |

**Response (Without Tool Execution):**
```json
{
  "success": true,
  "answer": "I've had this headache for 3 days",
  "sessionId": "sess_abc123def456",
  "toolExecuted": false,
  "timestamp": "2026-03-13T10:30:00.123Z"
}
```

**Response (With Tool Execution):**
```json
{
  "success": true,
  "answer": "Can you book me an appointment for Monday at 2 PM?",
  "sessionId": "sess_abc123def456",
  "toolExecuted": true,
  "toolName": "book_appointment",
  "toolResult": {
    "success": true,
    "appointmentID": "APT_1710329000789",
    "message": "Appointment confirmed for John Doe on 2026-03-14 at 14:00...",
    "appointment": {
      "appointmentID": "APT_1710329000789",
      "patientName": "John Doe",
      "phoneNumber": "555-1234",
      "date": "2026-03-14",
      "time": "14:00",
      "status": "confirmed"
    }
  },
  "confirmationMessage": "Great! I've booked your appointment for Monday, March 14th at 2:00 PM with Dr. Sarah Smith.",
  "timestamp": "2026-03-13T10:30:00.123Z"
}
```

**Tool Execution Logic:**
- Analyzes `userAnswer` for appointment-related keywords
- If booking intent detected, calls `/api/voice-agent/book-appointment`
- Returns tool result with state change verification
- Generates user-friendly confirmation message

**Example Usage (Normal Triage):**
```bash
curl -X POST http://localhost:3001/api/triage/answer \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess_abc123def456",
    "userAnswer": "I have allergies and high fever",
    "patientPhone": "555-1234"
  }'
```

**Example Usage (Appointment Booking):**
```bash
curl -X POST http://localhost:3001/api/triage/answer \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess_abc123def456",
    "userAnswer": "Please book me an appointment next Monday at 2 PM",
    "patientPhone": "555-1234"
  }'
```

---

### Get Triage Assessment
Retrieve the current triage assessment for a session.

**Endpoint:**
```
GET /api/triage/assessment?sessionId=sess_abc123def456
```

**Response:**
```json
{
  "success": true,
  "assessment": {
    "triage_level": "URGENT",
    "chief_complaint": "Severe headache with fever",
    "key_facts": {
      "symptoms": ["headache", "fever"],
      "duration": "3 days",
      "severity": "severe"
    },
    "next_action": "escalate_to_physician",
    "session_duration_sec": 180,
    "conversation_turns": 5,
    "timestamp": "2026-03-13T10:30:00.123Z"
  }
}
```

---

### Escalate to Emergency
Escalate a patient to emergency services.

**Endpoint:**
```
POST /api/triage/escalate-emergency
```

**Request Body:**
```json
{
  "sessionId": "sess_abc123def456"
}
```

**Response:**
```json
{
  "success": true,
  "escalationId": "emerg_sess_abc123def456_1710329000123",
  "message": "Emergency services have been contacted. Keep the line open and follow operator instructions.",
  "contactNumber": "911",
  "sessionId": "sess_abc123def456",
  "timestamp": "2026-03-13T10:30:00.123Z"
}
```

---

## 🧪 Testing/Debug Endpoints

### View Tool-Calling System Status
Get information about available tools and system status.

**Endpoint:**
```
GET /api/test/tool-calling
```

**Response:**
```json
{
  "success": true,
  "system": "Autonomous Voice Agent Tool Calling Demo",
  "testScenarios": [
    {
      "scenario": "Book Appointment - Simple",
      "userMessage": "I need to book an appointment for next Monday at 2 PM",
      "expectedTool": "book_appointment"
    },
    {
      "scenario": "Check Availability",
      "userMessage": "What times are available next week?",
      "expectedTool": "check_slots"
    },
    {
      "scenario": "Reschedule",
      "userMessage": "Can I move my appointment to a later time?",
      "expectedTool": "reschedule_appointment"
    }
  ],
  "toolsImplemented": [
    "book_appointment",
    "check_slots",
    "reschedule_appointment",
    "cancel_appointment"
  ],
  "databaseStatus": {
    "totalAppointments": 3,
    "doctors": 4,
    "availableDates": [
      "2026-03-14",
      "2026-03-15",
      "2026-03-16",
      "2026-03-18"
    ]
  },
  "timestamp": "2026-03-13T10:30:00.123Z"
}
```

**Example Usage:**
```bash
curl http://localhost:3001/api/test/tool-calling | jq
```

---

### Simulate Appointment Booking
Test the appointment booking tool directly.

**Endpoint:**
```
POST /api/test/simulate-booking
```

**Request Body:**
```json
{
  "patientName": "Test Patient",
  "phoneNumber": "555-9999",
  "date": "2026-03-14",
  "time": "09:00"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Autonomous tool execution test completed",
  "input": {
    "patientName": "Test Patient",
    "phoneNumber": "555-9999",
    "date": "2026-03-14",
    "time": "09:00"
  },
  "toolResult": {
    "success": true,
    "appointmentID": "APT_1710329001234",
    "message": "Appointment confirmed...",
    "appointment": {
      "appointmentID": "APT_1710329001234",
      "patientName": "Test Patient",
      "phoneNumber": "555-9999",
      "date": "2026-03-14",
      "time": "09:00",
      "status": "confirmed"
    }
  },
  "databaseSnapshot": {
    "totalAppointments": 4,
    "appointmentCreated": true,
    "slotRemoved": true
  },
  "timestamp": "2026-03-13T10:30:00.123Z"
}
```

**Example Usage:**
```bash
curl -X POST http://localhost:3001/api/test/simulate-booking \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "Jane Smith",
    "phoneNumber": "555-5678",
    "date": "2026-03-15",
    "time": "10:00"
  }' | jq
```

---

### View All Appointments
Display all appointments and available slots in the Medical_DB.

**Endpoint:**
```
GET /api/test/appointments
```

**Response:**
```json
{
  "success": true,
  "totalAppointments": 4,
  "appointments": [
    {
      "appointmentID": "APT_1710329000123",
      "patientName": "John Doe",
      "phoneNumber": "555-1234",
      "date": "2026-03-14",
      "time": "14:00",
      "reason": "Annual check-up",
      "doctorID": "dr_smith",
      "bookedAt": "2026-03-13T10:30:00Z",
      "status": "confirmed"
    }
  ],
  "availableSlots": {
    "2026-03-14": ["09:00", "10:00", "10:30", "14:30", "15:00"],
    "2026-03-15": ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"],
    "2026-03-16": ["09:30", "10:30", "11:30", "14:30", "15:30"],
    "2026-03-17": [],
    "2026-03-18": ["09:00", "09:30", "10:00", "13:00", "14:00", "15:00", "15:30"]
  },
  "timestamp": "2026-03-13T10:30:00.123Z"
}
```

**Example Usage:**
```bash
curl http://localhost:3001/api/test/appointments | jq '.appointments | length'
```

---

## 🔑 Common Query Parameters

| Parameter | Format | Example | Usage |
|-----------|--------|---------|-------|
| date | YYYY-MM-DD | 2026-03-14 | `/check-slots?date=2026-03-14` |
| time | HH:MM (24-hr) | 14:00 | In request body for bookings |
| phoneNumber | Digits/symbols | 555-1234 | `/my-appointments?phoneNumber=555-1234` |
| sessionId | String | sess_abc123 | `/triage/assessment?sessionId=sess_abc123` |

---

## 📊 Response Structure

All API responses follow this structure:

```json
{
  "success": true|false,
  "message": "optional description",
  "data": { ... },
  "error": "optional error message",
  "timestamp": "ISO 8601 timestamp"
}
```

---

## ❌ Common Errors

### 400 Bad Request
```json
{
  "success": false,
  "error": "Missing required fields: patientName, phoneNumber, date, time, reason"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Appointment APT_INVALID not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to book appointment",
  "message": "details about internal error"
}
```

---

## 🔒 Security Notes

- All patient data is validated before processing
- Phone numbers used as patient identifiers
- Sessions stored in-memory (consider adding session storage for production)
- No authentication currently (add OAuth/JWT for production)
- HIPAA compliance should be verified for production use

---

## 📞 Support

For API issues:
1. Check `/api/test/tool-calling` for system status
2. Review request body format against examples
3. Verify appointment dates are available with `/check-slots`
4. Check `/api/test/appointments` to see current database state

---

**API Version:** 1.0  
**Last Updated:** 2026-03-13  
**Status:** Production Ready (In-Memory Only)
