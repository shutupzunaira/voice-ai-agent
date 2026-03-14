# 📊 Local CSV Data Storage System

## Overview

The project now supports **dual data storage**:
- **Firebase Firestore** - Cloud database (primary)
- **Local CSV Files** - File storage for offline access and quick queries

All data is automatically saved to both locations. CSV files are stored in the `backend/data/` directory.

---

## 📁 CSV Files Structure

### 1. **patients.csv**
Stores medical triage data from `/ai` endpoint
```csv
id,timestamp,symptoms,urgencyLevel,recommendedAction,aiResponse
patient_1710345600000,2025-03-13T10:10:00.000Z,chest pain,HIGH,Visit ER immediately,You should seek emergency care
```

**Columns:**
- `id`: Unique patient record ID (patient_[timestamp])
- `timestamp`: When the triage was recorded (ISO format)
- `symptoms`: Patient's reported symptoms
- `urgencyLevel`: LOW, MEDIUM, HIGH, EMERGENCY
- `recommendedAction`: Suggested action for the patient
- `aiResponse`: AI-generated triage response

### 2. **appointments.csv**
Stores appointment booking data from `/book-appointment` endpoint
```csv
id,userId,patientName,phoneNumber,email,doctorSpecialization,preferredDate,preferredTime,reasonForVisit,status,createdAt,updatedAt
apt_1710345600000,user_123,John Doe,555-1234,john@example.com,Cardiology,2025-03-20,14:30,Chest pain checkup,pending,2025-03-13T10:10:00.000Z,2025-03-13T10:10:00.000Z
```

**Columns:**
- `id`: Unique appointment ID
- `userId`: User identifier
- `patientName`: Patient's full name
- `phoneNumber`: Contact number
- `email`: Email address
- `doctorSpecialization`: Doctor specialty
- `preferredDate`: Appointment date (YYYY-MM-DD)
- `preferredTime`: Appointment time (HH:MM)
- `reasonForVisit`: Reason for appointment
- `status`: pending, confirmed, cancelled
- `createdAt`: When appointment was created
- `updatedAt`: Last update time

### 3. **conversations.csv**
Stores conversation history
```csv
id,userId,role,message,timestamp,appointmentContext
conv_1710345600000,user_123,user,I have chest pain,2025-03-13T10:10:00.000Z,""
```

**Columns:**
- `id`: Unique conversation entry ID
- `userId`: User identifier
- `role`: "user" or "assistant"
- `message`: Conversation text
- `timestamp`: When message was sent
- `appointmentContext`: Related appointment data (JSON format)

---

## 🔌 API Endpoints

### **1. Compare Patient Data Against CSV**
**POST** `/compare-patient-data`

Searches CSV for similar symptoms and compares with current request.

**Request:**
```json
{
  "symptoms": "chest pain shortness of breath"
}
```

**Response:**
```json
{
  "success": true,
  "comparison": {
    "foundSimilar": true,
    "similarCases": [
      {
        "id": "patient_1710345600000",
        "symptoms": "chest pain",
        "urgencyLevel": "HIGH",
        "recommendedAction": "Visit ER immediately",
        "matchScore": 0.8
      }
    ],
    "totalMatches": 3,
    "recommendedActions": ["Visit ER immediately", "Schedule cardiology appointment"],
    "commonUrgencyLevels": { "HIGH": 2, "MEDIUM": 1 }
  },
  "message": "Found 3 similar cases in local database"
}
```

### **2. Compare Appointment Data Against CSV**
**POST** `/compare-appointment-data`

Searches CSV for existing appointments for a phone number.

**Request:**
```json
{
  "phoneNumber": "555-1234"
}
```

**Response:**
```json
{
  "success": true,
  "comparison": {
    "foundExisting": true,
    "existingAppointments": [
      {
        "id": "apt_1710345600000",
        "patientName": "John Doe",
        "preferredDate": "2025-03-20",
        "status": "confirmed"
      }
    ],
    "totalCount": 2,
    "lastAppointment": { ... },
    "statuses": { "confirmed": 1, "pending": 1 }
  },
  "message": "Found 2 existing appointment(s) for this phone"
}
```

### **3. Get All Patients from CSV**
**GET** `/csv/patients`

Retrieves all triage records from patients.csv

**Response:**
```json
{
  "success": true,
  "count": 5,
  "patients": [
    { "id": "patient_1710345600000", "symptoms": "chest pain", ... },
    { "id": "patient_1710345600001", "symptoms": "headache fever", ... }
  ]
}
```

### **4. Search Patients in CSV**
**GET** `/csv/patients/search?symptoms=chest+pain`

Searches for similar symptoms in patients.csv

**Response:**
```json
{
  "success": true,
  "searchTerm": "chest pain",
  "count": 3,
  "results": [
    {
      "id": "patient_1710345600000",
      "symptoms": "chest pain",
      "urgencyLevel": "HIGH",
      "matchScore": 1.0,
      "timestamp": "2025-03-13T10:10:00.000Z"
    }
  ]
}
```

### **5. Get All Appointments from CSV**
**GET** `/csv/appointments`

Retrieves all appointment records.

**Response:**
```json
{
  "success": true,
  "count": 10,
  "appointments": [ ... ]
}
```

### **6. Search Appointments in CSV**
**GET** `/csv/appointments/search?query=John`

Searches appointments by patient name, phone, or reason.

**Response:**
```json
{
  "success": true,
  "searchTerm": "John",
  "count": 2,
  "results": [ ... ]
}
```

### **7. Get Data Statistics**
**GET** `/csv/statistics`

Returns statistics about all stored data.

**Response:**
```json
{
  "success": true,
  "statistics": {
    "totalPatients": 15,
    "totalAppointments": 8,
    "totalConversations": 42,
    "urgencyDistribution": {
      "LOW": 5,
      "MEDIUM": 7,
      "HIGH": 3,
      "EMERGENCY": 0
    },
    "appointmentStatuses": {
      "pending": 2,
      "confirmed": 5,
      "cancelled": 1
    },
    "lastPatient": { ... },
    "lastAppointment": { ... }
  }
}
```

### **8. Export All Data to JSON**
**GET** `/csv/export`

Exports all CSV data to a timestamped JSON file.

**Response:**
```json
{
  "success": true,
  "message": "Data exported successfully",
  "exportPath": "backend/data/export_1710345600000.json"
}
```

---

## 🔄 Data Flow

### When a triage question is asked:
```
User Input → POST /ai → savePatient() to Firebase
                      → savePatientToCSV() to CSV
                      ↓
            Response includes: patientId + databaseSearch results
            (Search results are from both DB and CSV)
```

### When a patient data comparison is needed:
```
POST /compare-patient-data → searchPatientsInCSV()
                          ↓
                    Returns similar cases with scores
                    ↓
                API can show "Found X similar cases"
                and their urgency levels/recommendations
```

### When an appointment is booked:
```
User Input → POST /book-appointment → saveAppointment() to Firebase
                                   → saveAppointmentToCSV() to CSV
                                   ↓
            Response includes: appointment data + existing appointments
            (From both Firebase and CSV search)
```

### When updating an appointment:
```
POST /ai/assessment → compareAppointmentData() checks CSV
                   → Shows existing appointments
                   → User confirms which one to update
                   → System updates both Firebase and CSV
```

---

## 💡 Use Cases

### 1. **Quick Local Query Without Firebase**
If Firebase is down, you can still query the local CSV:
```bash
curl http://localhost:3001/csv/patients/search?symptoms=fever
```

### 2. **Compare New Request Against History**
```bash
curl -X POST http://localhost:3001/compare-patient-data \
  -H "Content-Type: application/json" \
  -d '{"symptoms":"chest pain"}'
```

### 3. **Check If Customer Already Has Appointment**
```bash
curl -X POST http://localhost:3001/compare-appointment-data \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"555-1234"}'
```

### 4. **View All Data Statistics**
```bash
curl http://localhost:3001/csv/statistics
```

### 5. **Export Data for Analysis**
```bash
curl http://localhost:3001/csv/export
```

---

## 📁 Directory Structure
```
backend/
├── data/                      # CSV storage directory
│   ├── patients.csv           # Triage records
│   ├── appointments.csv       # Appointment records
│   ├── conversations.csv      # Conversation history
│   └── export_*.json          # Exported data backups
├── csvService.js              # CSV operations
└── server.js                  # API endpoints
```

---

## 🛡️ Features

✅ **Automatic dual storage** - Firebase + Local CSV simultaneously  
✅ **Smarter queries** - Compare new data against stored history  
✅ **Offline access** - CSV works without internet  
✅ **CSVValue escaping** - Handles commas, quotes, newlines properly  
✅ **Error handling** - Graceful fallback if CSV save fails  
✅ **Statistics tracking** - Urgency levels, appointment statuses, etc.  
✅ **Data export** - JSON backups of all data  
✅ **Relevance scoring** - Find most similar patient cases  

---

## 🚀 Testing

### Test Triage Data Storage
```bash
curl -X POST http://localhost:3001/ai \
  -H "Content-Type: application/json" \
  -d '{"text":"I have severe chest pain"}'
```

Then check:
```bash
cat backend/data/patients.csv
```

### Test Appointment Comparison
```bash
curl -X POST http://localhost:3001/book-appointment \
  -H "Content-Type: application/json" \
  -d '{"userMessage":"Book appointment","userIdentifier":"555-1234"}'
```

Then search:
```bash
curl -X POST http://localhost:3001/compare-appointment-data \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"555-1234"}'
```

---

## 📝 Notes

- CSV files are created automatically on first run
- All timestamps are in ISO 8601 format
- CSV values with commas/quotes are properly escaped
- Search is case-insensitive
- Results are sorted by relevance and recency
- Conversation context is stored as JSON strings in CSV
