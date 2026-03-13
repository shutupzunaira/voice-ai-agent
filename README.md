# 🏥 Virtual Clinic — Autonomous Medical Voice Agent

**AI-powered medical triage and autonomous appointment scheduling system** with real state management.

Smart intake assistant that:
- 🩺 Triages symptoms and detects emergencies
- 🎤 Understands voice commands in natural language
- 📅 **Autonomously books, reschedules, and cancels appointments** (with real database persistence)
- 💊 Follows HIPAA-aligned best practices

## ✨ Key Features

### Medical Triage
- **Emergency Detection** — Identifies life-threatening symptoms
- **Smart Questions** — Adaptive follow-up questions based on responses
- **Session Management** — Preserves context across conversation
- **Voice & Text** — Input via voice (STR) or typed text

### 🤖 Autonomous Tool Calling (NEW!)
- **Intent Recognition** — Understands appointment requests in natural language
- **Real Execution** — Actually creates/modifies/cancels appointments (not just describing actions)
- **State Verification** — Database proves appointments were created
- **Error Handling** — Validates availability, clinic hours, patient data
- **Confirmations** — Returns human-readable confirmations

### Available Medical Tools
| Tool | Capability | Example |
|------|-----------|---------|
| **Book Appointment** | Create appointments in calendar | "Book me Monday at 2 PM" |
| **Check Slots** | View available times | "What times are free?" |
| **Reschedule** | Modify appointment timing | "Move to 3 PM" |
| **Cancel** | Remove appointments | "Cancel my appointment" |
| **View Appointments** | See booked appointments | "Show my appointments" |
| **Clinic Info** | Doctor profiles & hours | "Who are the doctors?" |

## 🏗️ Architecture

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite (pastel hospital UI) |
| **Backend** | Node.js (18+), Express 5 |
| **AI Models** | Gemini 2.5-flash, Vertex AI, OpenAI |
| **Voice I/O** | Web Speech API (browser STT/TTS) |
| **Database** | In-memory Medical_DB (appointment storage) |

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18
- **Gemini API key** — [aistudio.google.com](https://aistudio.google.com/app/apikey)
- *(Optional)* OpenAI API key — [platform.openai.com](https://platform.openai.com/api-keys)

### 1. Clone & Setup
```bash
git clone https://github.com/shutupzunaira/voice-ai-agent.git
cd voice-ai-agent
npm install
npm run install:all  # backend + frontend dependencies
```

### 2. Configure Environment
Create `backend/.env`:
```env
VERTEX_AI_API_KEY=your_vertex_key
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
VERTEX_AI_PROJECT=your_project_id
VERTEX_AI_REGION=us-central1
```

### 3. Start Development Servers
```bash
npm run dev
```

- **Frontend:** http://localhost:5175 (React app)
- **Backend:** http://localhost:3001 (API server)

## 🧪 Test Autonomous Tool Calling

### 1. View Available Tools
```bash
curl http://localhost:3001/api/test/tool-calling | jq
```

### 2. Book an Appointment (Real State Change!)
```bash
curl -X POST http://localhost:3001/api/test/simulate-booking \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "John Doe",
    "phoneNumber": "555-1234",
    "date": "2026-03-14",
    "time": "09:00"
  }' | jq
```

### 3. Verify Appointment Was Created
```bash
curl http://localhost:3001/api/test/appointments | jq '.appointments'
```

✅ **Proof:** Appointment persists in Medical_DB

### 4. Full Triage Flow with Tool Calling
```bash
# Start session
curl -X GET http://localhost:3001/api/triage/start | jq

# Answer with appointment request
curl -X POST http://localhost:3001/api/triage/answer \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "YOUR_SESSION_ID",
    "userAnswer": "Can you book me Monday at 2 PM?",
    "patientPhone": "555-1234"
  }' | jq '.toolResult'
```

## 📚 📚 Documentation

- **[API Reference](API-REFERENCE.md)** ⭐ **NEW** — Complete REST API with all tool endpoints & examples
- **[Voice Agent Complete Guide](VOICE-AGENT-GUIDE.md)** — Detailed tool descriptions, database schema, integration patterns
- **[Quick Start](VOICE-AGENT-QUICKSTART.md)** — 60-second testing guide (start here!)
- **[Setup Guide](SETUP_GUIDE.md)** — Environment configuration
- **[Network Setup](NETWORK-SETUP.md)** — Firewall & local development
- **[Troubleshooting](TROUBLESHOOTING.md)** — Common issues & solutions

## 🏥 Clinic Database

### Doctors
- 👨‍⚕️ Dr. Sarah Smith — General Practice (Available)
- 👩‍⚕️ Dr. Emily Lee — Pediatrics (Available)
- 🧑‍⚕️ Dr. Michael Johnson — Cardiology (Available)
- 👨‍⚕️ Dr. Rajesh Patel — Orthopedics (Full)

### Clinic Hours
- **Monday–Friday:** 9:00 AM – 5:00 PM
- **Saturday:** 10:00 AM – 2:00 PM  
- **Sunday:** CLOSED

### Available Appointment Dates
- 🗓️ March 14–16 (Mon–Wed)
- 🗓️ March 18 (Fri)
- ❌ March 17 (Sun) — Clinic Closed

## 🎯 Health-Only Scope

✓ **EXCLUSIVELY medical appointment booking** (no interviews, logistics, incidents, or other scenarios)  
✓ **Focused on clinic intake** — Patient assessment and appointment scheduling  
✓ **HIPAA-aligned practices** — Secure session management, input validation  
✓ **Emergency-aware** — Escalates serious symptoms to 911  

## 🔧 API Endpoints

### Voice Agent Tools (Autonomous)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/voice-agent/book-appointment` | Create appointment (real state change) |
| GET | `/api/voice-agent/check-slots?date=YYYY-MM-DD` | Check available time slots |
| POST | `/api/voice-agent/reschedule` | Move appointment to different time |
| POST | `/api/voice-agent/cancel` | Cancel an appointment |
| GET | `/api/voice-agent/clinic-info` | Get doctor profiles and clinic hours |
| GET | `/api/voice-agent/my-appointments?phoneNumber=XXX` | View patient's appointments |

### Medical Triage

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/triage/start` | Initialize new triage session |
| POST | `/api/triage/answer` | Process user response (with tool calling) |
| GET | `/api/triage/assessment` | Get triage assessment |
| POST | `/api/triage/escalate-emergency` | Escalate to emergency |

### Testing/Debug

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/test/tool-calling` | View tool-calling system status |
| POST | `/api/test/simulate-booking` | Test appointment booking |
| GET | `/api/test/appointments` | View all appointments in database |

## 🚀 Configure & Run

### 4. Set API Keys
Create `backend/.env`:
```env
VERTEX_AI_API_KEY=your_vertex_key
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key  # optional fallback
VERTEX_AI_PROJECT=your_project
VERTEX_AI_REGION=us-central1
PORT=3001
```

### 5. Start Development Servers
```bash
npm run dev
```

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://127.0.0.1:5175      |
| Backend  | http://localhost:3001      |

Open the frontend URL in your browser.

---

## Available Scripts

| Command               | Description                              |
|-----------------------|------------------------------------------|
| `npm run dev`         | Start backend + frontend simultaneously  |
| `npm run dev:backend` | Start backend only                       |
| `npm run dev:frontend`| Start frontend only                      |
| `npm run install:all` | Install deps for both backend & frontend |

## Project Structure

```
voice-ai-agent/
├── package.json          # Root scripts (concurrently)
├── README.md             # This file
├── VOICE-AGENT-GUIDE.md      # Complete tool calling reference
├── VOICE-AGENT-QUICKSTART.md # 60-second testing guide
├── backend/
│   ├── server.js         # Express API — Medical triage, tool functions
│   ├── .env              # API keys (not committed)
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   └── pages/
    │       ├── HomePage.jsx       # Landing page (emergency numbers)
    │       ├── InterviewPage.jsx  # Voice/text interview flow
    │       └── ReviewPage.jsx     # AI feedback report
    ├── vite.config.js    # Dev server + proxy config
    └── package.json
```

## How It Works

1. **Home** — Select an interview topic
2. **Interview** — AI greets you, asks the first question (spoken aloud)
3. **Record** — Press "Start Recording", speak your answer, press "Stop Recording"
4. **Repeat** — AI asks the next adaptive question; skip anytime with "Next Question"
5. **Feedback** — Press "View Feedback & Exit" to get a full AI-generated performance report

---

## License

ISC
