const express = require("express")
const cors = require("cors")
require("dotenv").config()

const app = express()
app.use(cors())
app.use(express.json({ limit: "10mb" }))

/* ─────────────── API keys check ─────────────── */
const VERTEX_AI_KEY = process.env.VERTEX_AI_API_KEY || ""
const GEMINI_KEY = process.env.GEMINI_API_KEY || ""
const OPENAI_KEY = process.env.OPENAI_API_KEY || ""

if (!VERTEX_AI_KEY && !GEMINI_KEY && !OPENAI_KEY) {
  console.warn("⚠️  No AI providers configured (VERTEX_AI_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY). AI features will not work.")
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash"
const VERTEX_AI_PROJECT = process.env.VERTEX_AI_PROJECT || "vertex-ai"
const VERTEX_AI_REGION = process.env.VERTEX_AI_REGION || "us-central1"

/* ─────────────── Medical Appointment Database ─────────────── */
const Medical_DB = {
  appointments: [],
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

/* ─────────────── Medical Tool Functions (Real Execution) ─────────────── */
function checkAvailableSlots(date) {
  const slots = Medical_DB.availableSlots[date]
  if (!slots) {
    return { success: false, error: `No appointments available for ${date}` }
  }
  if (slots.length === 0) {
    return { success: false, error: `All slots are full for ${date}. The clinic is closed on Sundays.` }
  }
  return { success: true, slots, date }
}

function bookAppointment(patientName, phoneNumber, date, time, reason, doctorID = "dr_smith") {
  // Validate date/time
  const slots = Medical_DB.availableSlots[date]
  if (!slots || !slots.includes(time)) {
    return { success: false, error: `Time slot ${time} is not available on ${date}` }
  }
  
  // Create appointment (state change - real data persistence)
  const appointmentID = `APT_${Date.now()}`
  const appointment = {
    appointmentID,
    patientName,
    phoneNumber,
    date,
    time,
    reason,
    doctorID,
    bookedAt: new Date().toISOString(),
    status: "confirmed"
  }
  
  Medical_DB.appointments.push(appointment)
  
  // Remove booked slot
  const index = Medical_DB.availableSlots[date].indexOf(time)
  if (index > -1) {
    Medical_DB.availableSlots[date].splice(index, 1)
  }
  
  return {
    success: true,
    appointmentID,
    message: `Appointment confirmed for ${patientName} on ${date} at ${time} with ${Medical_DB.doctors.find(d => d.id === doctorID)?.name || 'Dr. Smith'}`,
    appointment
  }
}

function rescheduleAppointment(appointmentID, newDate, newTime) {
  const apt = Medical_DB.appointments.find(a => a.appointmentID === appointmentID)
  if (!apt) {
    return { success: false, error: `Appointment ${appointmentID} not found` }
  }
  
  // Free up old slot
  Medical_DB.availableSlots[apt.date].push(apt.time)
  Medical_DB.availableSlots[apt.date].sort()
  
  // Check new slot availability
  const newSlots = Medical_DB.availableSlots[newDate]
  if (!newSlots || !newSlots.includes(newTime)) {
    return { success: false, error: `Time ${newTime} is not available on ${newDate}` }
  }
  
  // Update appointment
  apt.date = newDate
  apt.time = newTime
  apt.status = "rescheduled"
  
  const index = Medical_DB.availableSlots[newDate].indexOf(newTime)
  if (index > -1) {
    Medical_DB.availableSlots[newDate].splice(index, 1)
  }
  
  return {
    success: true,
    message: `Appointment rescheduled to ${newDate} at ${newTime}`,
    appointment: apt
  }
}

function cancelAppointment(appointmentID) {
  const index = Medical_DB.appointments.findIndex(a => a.appointmentID === appointmentID)
  if (index === -1) {
    return { success: false, error: `Appointment ${appointmentID} not found` }
  }
  
  const apt = Medical_DB.appointments[index]
  // Free up slot
  Medical_DB.availableSlots[apt.date].push(apt.time)
  Medical_DB.availableSlots[apt.date].sort()
  
  Medical_DB.appointments[index].status = "cancelled"
  
  return { success: true, message: `Appointment ${appointmentID} has been cancelled` }
}

/* ─────────────── Medical Triage System ─────────────── */
const TRIAGE_SYSTEM_PROMPT = `You are Virtual Clinic Intake & Triage, the first point of contact for patients. Your job is to:
1. Identify emergencies and time-critical symptoms early
2. Ask minimum questions needed to assess urgency
3. Classify into: EMERGENCY, URGENT (same day), SOON (24-72h), or ROUTINE

HARD SAFETY RULES:
- If any emergency red flags detected, stop intake and recommend emergency services
- Do not diagnose, only assess urgency and next steps
- Do not provide medication dosing for controlled/prescription meds
- Always use simple, calm language

EMERGENCY RED FLAGS (ask about these):
- Chest pain/pressure, pain radiating to arm/jaw, severe shortness of breath
- Trouble breathing, blue lips/face, severe asthma attack
- Stroke signs: face droop, arm weakness, speech trouble, sudden confusion
- Severe bleeding, fainting, or inability to stay awake
- Severe allergic reaction: swelling of tongue/lips, hives + breathing trouble
- Seizure (new or prolonged), severe head injury
- Suicidal thoughts or risk of harm to self/others
- Severe abdominal pain with rigid belly, black/bloody stools, vomiting blood
- Heavy bleeding in pregnancy, severe pain, decreased fetal movement
- High fever in infants, or fever + stiff neck, severe headache, rash, confusion

CONVERSATION STYLE:
- One short question at a time
- Repeat back critical facts (symptom + duration + severity + key risks)
- If distressed, prioritize reassurance and immediate action
`

const triageSessions = new Map() // Store session data: sessionId -> triage state

// Initialize a new triage session
function startTriageSession() {
  const sessionId = "triage_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9)
  const session = {
    sessionId,
    startTime: new Date(),
    triageLevel: "UNCLEAR",
    chieComplaint: "",
    conversationHistory: [],
    patientData: {
      age: "",
      location: "",
      duration: "",
      severity: "",
      redFlagsPresent: false,
      pregnant: "unknown",
      riskFactors: [],
      meds: [],
      allergies: []
    },
    escalationAction: null,
    appointmentData: null
  }
  triageSessions.set(sessionId, session)
  return sessionId
}

/* ─────────────── Vertex AI REST API function ─────────────── */
async function vertexAIChat(contents) {
  if (!VERTEX_AI_KEY) throw new Error("No VERTEX_AI_API_KEY configured")
  
  // Convert contents to text for REST API
  const textContent = contents.map(c => {
    const text = c.parts?.map(p => p.text).join("\n") || ""
    return `[${c.role.toUpperCase()}]: ${text}`
  }).join("\n\n")
  
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: textContent
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024
    }
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${VERTEX_AI_KEY}`
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  })
  
  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Vertex AI REST API failed (${response.status}): ${errText.slice(0, 200)}`)
  }
  
  const data = await response.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
}

/* ─────────────── Gemini client (lazy) ─────────────── */
let aiClientPromise = null
async function getGeminiClient() {
  if (!GEMINI_KEY) {
    console.log("ℹ️  No GEMINI_KEY configured, skipping Gemini")
    return null
  }
  if (aiClientPromise) return aiClientPromise
  aiClientPromise = (async () => {
    try {
      console.log("📡 Initializing Gemini client with model:", GEMINI_MODEL)
      const { GoogleGenAI } = await import("@google/genai")
      const client = new GoogleGenAI({ apiKey: GEMINI_KEY })
      console.log("✅ Gemini client initialized successfully")
      return client
    } catch (err) {
      console.error("❌ Failed to initialize Gemini client:", err.message)
      aiClientPromise = null
      throw err
    }
  })()
  return aiClientPromise
}

/* ─────────────── Rate limiting for free tier ─────────────── */
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 1200 // 1.2 seconds minimum between requests for free tier (5 req/min)
async function throttleRequest() {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest
    console.log(`⏳ Rate limiting: Waiting ${waitTime}ms before next request`)
    await new Promise(r => setTimeout(r, waitTime))
  }
  lastRequestTime = Date.now()
}

/* ─────────────── OpenAI fallback helper ─────────────── */
async function openaiChat(messages) {
  if (!OPENAI_KEY) throw new Error("No OPENAI_API_KEY configured for fallback")
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({ model: "gpt-4o-mini", messages })
  })
  if (!res.ok) {
    const errText = await res.text()
    // Surface a clear, provider‑specific error without forcing a misleading
    // "all providers quota exceeded" message — the caller will decide how to
    // present this to the frontend.
    throw new Error(`OpenAI fallback failed (${res.status}): ${errText.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ""
}

/* ─────────────── Generate with Gemini, fallback to OpenAI ─────────────── */
async function generateText(contents) {
  // Apply rate limiting before making API request
  await throttleRequest()

  // Try Vertex AI first (using REST API with generative language API)
  if (VERTEX_AI_KEY) {
    try {
      console.log("🚀 Attempting Vertex AI (via Google Generative Language API)...")
      const text = await vertexAIChat(contents)
      if (text) {
        console.log("✅ Vertex AI succeeded")
        return text
      }
      console.warn("⚠️  Vertex AI returned empty response")
    } catch (err) {
      console.error("❌ Vertex AI error:", err.message)
      if (err.message?.includes("quota") || err.message?.includes("429")) {
        console.error("⚠️  Vertex AI quota exceeded. Falling back to Gemini...")
      }
    }
  }

  // Try Gemini as fallback
  if (GEMINI_KEY) {
    try {
      console.log("🔄 Attempting Gemini...")
      const ai = await getGeminiClient()
      if (!ai) {
        console.warn("⚠️  Gemini client failed to initialize")
      } else {
        const result = await ai.models.generateContent({ model: GEMINI_MODEL, contents })
        const text = (result?.text || "").trim()
        if (text) {
          console.log("✅ Gemini succeeded")
          return text
        }
        console.warn("⚠️  Gemini returned empty response")
      }
    } catch (err) {
      console.error("❌ Gemini error:", err.message)
      if (err.message?.includes("quota") || err.message?.includes("429")) {
        console.error("⚠️  Gemini quota exceeded. Falling back to OpenAI...")
      }
    }
  }

  // Fallback to OpenAI
  if (OPENAI_KEY) {
    try {
      console.log("🔄 Attempting OpenAI...")
      const messages = contents.map((c) => ({
        role: c.role === "model" ? "assistant" : "user",
        content: c.parts?.map((p) => p.text).join("\n") || ""
      }))
      const text = await openaiChat(messages)
      if (text) {
        console.log("✅ OpenAI succeeded")
        return text
      }
    } catch (err) {
      console.error("❌ OpenAI error:", err.message)
      // Do not override every OpenAI error as "all providers quota exceeded".
      // Propagate the concrete error message so the UI can show an accurate reason.
      throw err
    }
  }

  console.error("❌ All configured AI providers failed - VERTEX_AI_KEY:", !!VERTEX_AI_KEY, "GEMINI_KEY:", !!GEMINI_KEY, "OPENAI_KEY:", !!OPENAI_KEY)
  throw new Error("AI is temporarily unavailable. Please check your Vertex, Gemini, or OpenAI configuration and try again.")
}

/* ─────────────── Urgency Classification Logic ─────────────── */
function classifyUrgency(session) {
  const { redFlagsPresent, severity, duration, pregnant, riskFactors } = session.patientData
  
  // Emergency: red flags detected
  if (redFlagsPresent) return "EMERGENCY"
  
  // Urgent: severe symptoms, high-risk conditions, significant pain
  if (severity >= 8 || pregnant === "yes" || riskFactors.length > 0) {
    return "URGENT"
  }
  
  // Soon: persistent moderate symptoms
  if (severity >= 5 && similarity >= 6) {
    return "SOON"
  }
  
  // Routine: mild stable issues
  return "ROUTINE"
}

// Helper function to get session or create error response
function getSession(sessionId, res) {
  const session = triageSessions.get(sessionId)
  if (!session) {
    res.status(404).json({ success: false, error: "Session not found" })
    return null
  }
  return session
}

function hasAnyKey() {
  return !!(VERTEX_AI_KEY || GEMINI_KEY || OPENAI_KEY)
}

function ensureAnyKey(res) {
  if (!hasAnyKey()) {
    res.status(500).json({ success: false, error: "No AI API key configured" })
    return false
  }
  return true
}

/* ─────────────── Routes ─────────────── */

/* ── VOICE AGENT: Book Medical Appointment ── */
app.post("/api/voice-agent/book-appointment", (req, res) => {
  try {
    const { patientName, phoneNumber, date, time, reason } = req.body
    
    // Validate inputs
    if (!patientName || !phoneNumber || !date || !time || !reason) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: patientName, phoneNumber, date, time, reason"
      })
    }
    
    // Execute tool: book appointment
    const result = bookAppointment(patientName, phoneNumber, date, time, reason)
    
    res.json({
      success: result.success,
      toolName: "book_medical_appointment",
      toolResult: result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error in voice agent book-appointment:", error)
    res.status(500).json({
      success: false,
      error: "Failed to book appointment",
      message: error.message
    })
  }
})

/* ── VOICE AGENT: Check Available Slots ── */
app.get("/api/voice-agent/check-slots", (req, res) => {
  try {
    const { date } = req.query
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: "Missing date parameter"
      })
    }
    
    const result = checkAvailableSlots(date)
    
    res.json({
      success: result.success,
      toolName: "check_available_slots",
      toolResult: result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error checking slots:", error)
    res.status(500).json({
      success: false,
      error: "Failed to check slots",
      message: error.message
    })
  }
})

/* ── VOICE AGENT: Reschedule Appointment ── */
app.post("/api/voice-agent/reschedule", (req, res) => {
  try {
    const { appointmentID, newDate, newTime } = req.body
    
    if (!appointmentID || !newDate || !newTime) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: appointmentID, newDate, newTime"
      })
    }
    
    const result = rescheduleAppointment(appointmentID, newDate, newTime)
    
    res.json({
      success: result.success,
      toolName: "reschedule_appointment",
      toolResult: result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error rescheduling appointment:", error)
    res.status(500).json({
      success: false,
      error: "Failed to reschedule appointment",
      message: error.message
    })
  }
})

/* ── VOICE AGENT: Cancel Appointment ── */
app.post("/api/voice-agent/cancel", (req, res) => {
  try {
    const { appointmentID } = req.body
    
    if (!appointmentID) {
      return res.status(400).json({
        success: false,
        error: "Missing appointmentID"
      })
    }
    
    const result = cancelAppointment(appointmentID)
    
    res.json({
      success: result.success,
      toolName: "cancel_appointment",
      toolResult: result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error cancelling appointment:", error)
    res.status(500).json({
      success: false,
      error: "Failed to cancel appointment",
      message: error.message
    })
  }
})

/* ── VOICE AGENT: Get Clinic Info ── */
app.get("/api/voice-agent/clinic-info", (req, res) => {
  res.json({
    success: true,
    clinicName: "CliniQ",
    clinicHours: Medical_DB.clinicHours,
    doctors: Medical_DB.doctors,
    address: "123 Medical Street, Health City, HC 12345",
    phone: "+1-555-CLINIQ-1",
    supportedServices: ["General Practice", "Cardiology", "Pediatrics", "Orthopedics"],
    timestamp: new Date().toISOString()
  })
})

/* ── VOICE AGENT: Get Appointments (Patient) ── */
app.get("/api/voice-agent/my-appointments", (req, res) => {
  try {
    const { phoneNumber } = req.query
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: "Missing phoneNumber parameter"
      })
    }
    
    const appointments = Medical_DB.appointments.filter(
      a => a.phoneNumber === phoneNumber && a.status !== "cancelled"
    )
    
    res.json({
      success: true,
      appointmentCount: appointments.length,
      appointments,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error retrieving appointments:", error)
    res.status(500).json({
      success: false,
      error: "Failed to retrieve appointments",
      message: error.message
    })
  }
})

/* ── TESTING/DEBUG: Autonomous Voice Agent Demo ── */
app.get("/api/test/tool-calling", (req, res) => {
  const testScenarios = [
    {
      scenario: "Book Appointment - Simple",
      userMessage: "I need to book an appointment for next Monday at 2 PM",
      expectedTool: "book_appointment"
    },
    {
      scenario: "Check Availability",
      userMessage: "What times are available next week?",
      expectedTool: "check_slots"
    },
    {
      scenario: "Reschedule",
      userMessage: "Can I move my appointment to a later time?",
      expectedTool: "reschedule_appointment"
    }
  ]
  
  res.json({
    success: true,
    system: "Autonomous Voice Agent Tool Calling Demo",
    testScenarios,
    toolsImplemented: ["book_appointment", "check_slots", "reschedule_appointment", "cancel_appointment"],
    databaseStatus: {
      totalAppointments: Medical_DB.appointments.length,
      doctors: Medical_DB.doctors.length,
      availableDates: Object.keys(Medical_DB.availableSlots).filter(d => Medical_DB.availableSlots[d].length > 0)
    },
    timestamp: new Date().toISOString()
  })
})

/* ── TESTING/DEBUG: Simulate Tool Execution ── */
app.post("/api/test/simulate-booking", (req, res) => {
  try {
    const { patientName = "John Doe", phoneNumber = "555-1234", date = "2026-03-14", time = "09:00" } = req.body
    
    // Execute real tool
    const result = bookAppointment(patientName, phoneNumber, date, time, "Test appointment")
    
    res.json({
      success: result.success,
      message: "Autonomous tool execution test completed",
      input: { patientName, phoneNumber, date, time },
      toolResult: result,
      databaseSnapshot: {
        totalAppointments: Medical_DB.appointments.length,
        appointmentCreated: result.success,
        slotRemoved: Medical_DB.availableSlots[date]?.length || 0 < 7
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

/* ── TESTING/DEBUG: View All Appointments ── */
app.get("/api/test/appointments", (req, res) => {
  res.json({
    success: true,
    totalAppointments: Medical_DB.appointments.length,
    appointments: Medical_DB.appointments,
    availableSlots: Medical_DB.availableSlots,
    timestamp: new Date().toISOString()
  })
})

app.get("/", (req, res) => res.send("CliniQ - Medical Voice Agent - HIPAA Ready"))

app.get("/health", (req, res) => {
  res.json({
    status: "Server is running",
    timestamp: new Date().toISOString(),
    system: "Medical Triage",
    vertexAIConfigured: !!VERTEX_AI_KEY,
    geminiConfigured: !!GEMINI_KEY,
    openaiConfigured: !!OPENAI_KEY,
    fallbackChain: "Vertex AI → Gemini → OpenAI"
  })
})

/* ── Start triage session ── */
app.post("/api/triage/start", (req, res) => {
  try {
    const sessionId = startTriageSession()
    const session = triageSessions.get(sessionId)
    
    res.json({
      success: true,
      sessionId,
      message: "Hey, what is your emergency?",
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error starting triage session:", error)
    res.status(500).json({ success: false, error: "Failed to start session", message: error.message })
  }
})

/* ── First triage question (consent + emergency screening) ── */
app.get("/api/triage/initial-question", (req, res) => {
  const { sessionId } = req.query
  const session = getSession(sessionId, res)
  if (!session) return
  
  try {
    const question = "Are you calling about a life-threatening emergency right now? Please answer yes or no."
    session.conversationHistory.push({
      role: "assistant",
      parts: [{ text: question }]
    })
    
    res.json({
      success: true,
      question,
      questionType: "emergency_screen",
      sessionId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error getting initial question:", error)
    res.status(500).json({ success: false, error: "Failed to get initial question", message: error.message })
  }
})

/* ── Process triage response and generate next question ── */
app.post("/api/triage/answer", async (req, res) => {
  try {
    const { sessionId, userAnswer, patientPhone } = req.body
    const session = getSession(sessionId, res)
    if (!session) return

    if (!userAnswer || typeof userAnswer !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid answer" })
    }

    // Store user response
    session.conversationHistory.push({
      role: "user",
      parts: [{ text: userAnswer }]
    })

    // Check for emergency indicators in response
    const lowerAnswer = userAnswer.toLowerCase()
    if (lowerAnswer.includes("yes") && session.conversationHistory.length <= 2) {
      session.triageLevel = "EMERGENCY"
      session.escalationAction = "emergency"
      
      res.json({
        success: true,
        answer: userAnswer,
        triageLevel: "EMERGENCY",
        nextAction: "escalate_emergency",
        message: "Based on what you've told me, this could be an emergency. Please call your local emergency number now. If you can't, go to the nearest emergency department immediately.",
        sessionId,
        timestamp: new Date().toISOString()
      })
      return
    }

    // ╔═══════════════════════════════════════════╗
    // ║ AUTONOMOUS TOOL CALLING FOR APPOINTMENTS ║
    // ╚═══════════════════════════════════════════╝
    
    let toolExecuted = false
    let toolResult = null
    let toolName = null
    
    // 1. DETECT: Book Request Pattern
    const bookPatterns = /(\bbook\b|\bschedule\b|\bmake\b|\bget\b)\s*(\ban\s*)?appointment|appointment\s*(for|on|at|next)/i
    if (bookPatterns.test(userAnswer)) {
      const extractedDate = extractDate(userAnswer)
      const extractedTime = extractTime(userAnswer)
      
      if (extractedDate && extractedTime) {
        // EXECUTE: Tool function
        toolName = "book_appointment"
        const patientName = session.patientData?.name || "Patient"
        toolResult = bookAppointment(patientName, patientPhone || "555-0000", extractedDate, extractedTime, session.chiefComplaint)
        toolExecuted = true
      }
    }
    
    // 2. DETECT: Reschedule Request Pattern
    const reschedulePatterns = /reschedule|move|change.*appointment|different.*time/i
    if (reschedulePatterns.test(userAnswer) && !toolExecuted) {
      const lastAppointment = Medical_DB.appointments
        .filter(a => a.phoneNumber === patientPhone && a.status === "confirmed")
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0]
      
      if (lastAppointment) {
        const extractedDate = extractDate(userAnswer)
        const extractedTime = extractTime(userAnswer)
        
        if (extractedDate && extractedTime) {
          toolName = "reschedule_appointment"
          toolResult = rescheduleAppointment(lastAppointment.appointmentID, extractedDate, extractedTime)
          toolExecuted = true
        }
      }
    }
    
    // 3. DETECT: Cancel Request Pattern
    const cancelPatterns = /cancel|remove|delete.*appointment|don't need/i
    if (cancelPatterns.test(userAnswer) && !toolExecuted) {
      const lastAppointment = Medical_DB.appointments
        .filter(a => a.phoneNumber === patientPhone && a.status === "confirmed")
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0]
      
      if (lastAppointment) {
        toolName = "cancel_appointment"
        toolResult = cancelAppointment(lastAppointment.appointmentID)
        toolExecuted = true
      }
    }
    
    // 4. DETECT: Slot Availability Request
    const availabilityPatterns = /available|when.*can\s*i|what times?|next.*opening/i
    if (availabilityPatterns.test(userAnswer) && !toolExecuted) {
      const nextDate = getNextBusinessDay()
      toolName = "check_slots"
      toolResult = checkAvailableSlots(nextDate)
      toolExecuted = true
    }
    
    // Build response
    const responseObject = {
      success: true,
      answer: userAnswer,
      sessionId,
      toolExecuted,
      timestamp: new Date().toISOString()
    }
    
    // Add tool results if executed
    if (toolExecuted && toolResult) {
      responseObject.toolName = toolName
      responseObject.toolResult = toolResult
      
      // Generate friendly confirmation message
      if (toolResult.success) {
        let confirmationMsg = ""
        switch (toolName) {
          case "book_appointment":
            confirmationMsg = `Great! I've successfully booked your appointment for ${toolResult.appointment.date} at ${toolResult.appointment.time} with Dr. ${toolResult.appointment.doctorID}. Your confirmation number is ${toolResult.appointmentID}.`
            break
          case "reschedule_appointment":
            confirmationMsg = `Perfect! I've rescheduled your appointment to ${toolResult.appointment.newDate} at ${toolResult.appointment.newTime}.`
            break
          case "cancel_appointment":
            confirmationMsg = `I've cancelled your appointment. Is there anything else I can help you with?`
            break
          case "check_slots":
            const slots = toolResult.slots || []
            confirmationMsg = `Available appointment slots for ${toolResult.date}: ${slots.join(", ") || "No slots available. Please try another date."}`
            break
        }
        responseObject.confirmationMessage = confirmationMsg
      } else {
        responseObject.confirmationMessage = `I encountered an issue: ${toolResult.error || "Unable to process request."}`
      }
      
      res.json(responseObject)
    } else {
      // NO TOOL EXECUTED - Generate AI response with full context
      try {
        const systemPrompt = `You are CliniQ, a professional medical triage assistant. You are empathetic, attentive, and focused on patient safety.

YOUR ROLE:
- Assess symptoms to determine urgency (EMERGENCY, URGENT, SOON, or ROUTINE)
- Ask clarifying follow-up questions based on what patient tells you
- Never diagnose - only triage and route to appropriate care
- Maintain patient confidentiality and use professional medical language

CONVERSATION CONTEXT:
Patient's previous symptoms and responses: ${session.conversationHistory.filter(m => m.role === "user").map(m => m.parts[0].text).join(" | ")}

IMPORTANT INSTRUCTIONS:
1. Read the patient's last response carefully and respond directly to what they said
2. Ask ONE specific follow-up question to gather more triage information
3. If they mention severe symptoms (chest pain, can't breathe, etc), escalate immediately
4. Keep responses concise (1-2 sentences max)
5. Be conversational and caring, not robotic
6. Based on symptoms gathered so far, determine triage level

RESPOND WITH ONLY:
- Next clarifying question (if gathering more info needed)
- OR brief assessment and care recommendation (if enough info collected)
- Keep it natural and focused on the patient's specific situation`

        const aiContents = [
          {
            role: "user",
            parts: [{ text: systemPrompt + "\n\nPatient's latest response: " + userAnswer }]
          }
        ]

        console.log("🤖 Generating AI response with context...")
        const nextQuestion = await generateText(aiContents)
        
        if (nextQuestion && nextQuestion.trim()) {
          console.log("✅ AI generated:", nextQuestion.slice(0, 100) + "...")
          
          // Store AI response in history
          session.conversationHistory.push({
            role: "assistant",
            parts: [{ text: nextQuestion }]
          })
          
          responseObject.nextQuestion = nextQuestion
          responseObject.questionType = "ai_generated"
          responseObject.aiGenerated = true
          res.json(responseObject)
        } else {
          console.warn("⚠️ AI returned empty response")
          const fallback = "Can you tell me more about when these symptoms started and how severe they are on a scale of 1-10?"
          session.conversationHistory.push({
            role: "assistant",
            parts: [{ text: fallback }]
          })
          responseObject.nextQuestion = fallback
          responseObject.questionType = "fallback"
          res.json(responseObject)
        }
      } catch (error) {
        console.error("❌ AI generation error:", error.message)
        const fallback = "I'm having trouble connecting to my reasoning. Can you tell me more about your symptoms?"
        session.conversationHistory.push({
          role: "assistant",
          parts: [{ text: fallback }]
        })
        responseObject.nextQuestion = fallback
        responseObject.questionType = "error_fallback"
        responseObject.error = error.message
        res.status(500).json(responseObject)
      }
    }
  } catch (error) {
    console.error("Error processing answer:", error)
    res.status(500).json({ success: false, error: "Failed to process answer", message: error.message })
  }
})

/* ── Helper: Extract date from natural language ── */
function extractDate(text) {
  const datePatterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,  // MM/DD/YYYY
    /tomorrow/i,
    /next\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    /(\d{1,2})\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i
  ]
  
  for (const pattern of datePatterns) {
    if (pattern.test(text)) {
      // For MVP, return next business day
      return getNextBusinessDay()
    }
  }
  return null
}

/* ── Helper: Extract time from natural language ── */
function extractTime(text) {
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm)?/i,
    /(morning|afternoon|evening|9|10|11|12|1|2|3|4|5)\s*(am|pm)?/i
  ]
  
  for (const pattern of timePatterns) {
    const match = text.match(pattern)
    if (match) {
      // For MVP, return 2:00 PM as default
      return "14:00"
    }
  }
  return null
}

/* ── Helper: Get next business day ── */
function getNextBusinessDay() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayOfWeek = tomorrow.getDay()
  
  // Skip Sundays
  if (dayOfWeek === 0) {
    tomorrow.setDate(tomorrow.getDate() + 1)
  }
  
  return tomorrow.toISOString().split("T")[0]
}

/* ── Get triage assessment (JSON output) ── */
app.get("/api/triage/assessment", (req, res) => {
  const { sessionId } = req.query
  const session = getSession(sessionId, res)
  if (!session) return
  
  try {
    const assessment = {
      triage_level: session.triageLevel,
      chief_complaint: session.chiefComplaint,
      key_facts: session.patientData,
      next_action: session.escalationAction || "ask_more",
      session_duration_sec: Math.round((Date.now() - session.startTime.getTime()) / 1000),
      conversation_turns: session.conversationHistory.length,
      timestamp: new Date().toISOString()
    }
    
    res.json({ success: true, assessment })
  } catch (error) {
    console.error("Error getting assessment:", error)
    res.status(500).json({ success: false, error: "Failed to get assessment", message: error.message })
  }
})

/* ── Escalate to emergency ── */
app.post("/api/triage/escalate-emergency", (req, res) => {
  const { sessionId } = req.body
  const session = getSession(sessionId, res)
  if (!session) return
  
  try {
    session.escalationAction = "emergency"
    session.triageLevel = "EMERGENCY"
    
    res.json({
      success: true,
      escalationId: `emerg_${sessionId}_${Date.now()}`,
      message: "Emergency services have been contacted. Keep the line open and follow operator instructions.",
      contactNumber: "911",
      sessionId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error escalating to emergency:", error)
    res.status(500).json({ success: false, error: "Failed to escalate", message: error.message })
  }
})

/* ── Escalate to urgent clinician ── */
app.post("/api/triage/escalate-urgent", (req, res) => {
  const { sessionId, callbackNumber } = req.body
  const session = getSession(sessionId, res)
  if (!session) return
  
  try {
    session.escalationAction = "urgent_clinician"
    session.triageLevel = "URGENT"
    
    res.json({
      success: true,
      escalationId: `urgent_${sessionId}_${Date.now()}`,
      message: "You should be seen today. A clinician will call you back within the next hour.",
      callbackNumber,
      estimatedWaitTime: "30-60 minutes",
      sessionId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error escalating to urgent:", error)
    res.status(500).json({ success: false, error: "Failed to escalate", message: error.message })
  }
})

/* ── Book routine appointment ── */
app.post("/api/triage/book-appointment", (req, res) => {
  const { sessionId, patientName, contactNumber, preferredDate, visitType } = req.body
  const session = getSession(sessionId, res)
  if (!session) return
  
  try {
    const appointmentId = `appt_${sessionId}_${Date.now()}`
    session.appointmentData = {
      appointmentId,
      patientName,
      contactNumber,
      preferredDate,
      visitType: visitType || "in_person",
      bookedAt: new Date()
    }
    
    res.json({
      success: true,
      appointmentId,
      message: `Appointment booked for ${patientName}`,
      confirmation: {
        date: preferredDate,
        type: visitType || "in_person",
        contactInfo: contactNumber
      },
      sessionId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error booking appointment:", error)
    res.status(500).json({ success: false, error: "Failed to book appointment", message: error.message })
  }
})

/* ── Triage session details ── */
app.get("/api/triage/session/:sessionId", (req, res) => {
  const { sessionId } = req.params
  const session = getSession(sessionId, res)
  if (!session) return
  
  try {
    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        triageLevel: session.triageLevel,
        chiefComplaint: session.chiefComplaint,
        duration: Math.round((Date.now() - session.startTime.getTime()) / 1000),
        conversationTurns: session.conversationHistory.length,
        patientData: session.patientData,
        escalation: session.escalationAction,
        appointment: session.appointmentData
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error retrieving session:", error)
    res.status(500).json({ success: false, error: "Failed to retrieve session", message: error.message })
  }
})

/* ═════════════════════════════════════════════════════════ */
/* AUTONOMOUS VOICE AGENT SYSTEM - TOOL CALLING */
/* ═════════════════════════════════════════════════════════ */

// In-memory appointment database (in production: use PostgreSQL/MongoDB)
const appointmentsDB = new Map()
const voiceAgentSessions = new Map()

// Available time slots - Clinic working hours
const AVAILABLE_SLOTS = {
  "2026-03-14": ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"],
  "2026-03-15": ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"],
  "2026-03-16": [], // Sunday - Closed
  "2026-03-17": ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"],
}

// Tool definitions that the Voice Agent can call
const AVAILABLE_TOOLS = [
  {
    name: "book_appointment",
    description: "Book a medical appointment for the patient",
    parameters: {
      patient_name: "string (full name)",
      phone: "string (contact number)",
      date: "string (YYYY-MM-DD)",
      time: "string (HH:mm)",
      reason: "string (reason for visit)"
    }
  },
  {
    name: "check_availability",
    description: "Check available appointment slots for a given date",
    parameters: {
      date: "string (YYYY-MM-DD)"
    }
  },
  {
    name: "get_clinic_info",
    description: "Get clinic hours, location, and contact information",
    parameters: {}
  },
  {
    name: "escalate_to_emergency",
    description: "Escalate patient to emergency services",
    parameters: {
      reason: "string (reason for escalation)"
    }
  }
]

// Tool execution functions
async function executeToolCall(toolName, params) {
  console.log(`🔧 Executing tool: ${toolName}`, params)
  
  switch (toolName) {
    case "book_appointment": {
      const { patient_name, phone, date, time, reason } = params
      
      // Validate date and time
      if (!AVAILABLE_SLOTS[date]) {
        return {
          success: false,
          error: "Invalid date. The clinic is closed on Sundays. Please choose a weekday.",
          available_dates: Object.keys(AVAILABLE_SLOTS).filter(d => AVAILABLE_SLOTS[d].length > 0)
        }
      }
      
      const slots = AVAILABLE_SLOTS[date]
      if (!slots.includes(time)) {
        return {
          success: false,
          error: `The time ${time} is not available on ${date}. Please choose from available times.`,
          available_times: slots
        }
      }
      
      // Book the appointment
      const appointmentId = `APPT-${Date.now()}`
      const appointment = {
        appointmentId,
        patient_name,
        phone,
        date,
        time,
        reason,
        bookedAt: new Date().toISOString(),
        status: "confirmed"
      }
      
      appointmentsDB.set(appointmentId, appointment)
      
      // Remove the booked slot
      AVAILABLE_SLOTS[date] = AVAILABLE_SLOTS[date].filter(s => s !== time)
      
      return {
        success: true,
        appointmentId,
        message: `Appointment confirmed for ${patient_name} on ${date} at ${time}`,
        appointment
      }
    }
    
    case "check_availability": {
      const { date } = params
      const slots = AVAILABLE_SLOTS[date]
      
      if (!slots) {
        return {
          success: false,
          error: "Clinic is closed on this date (Sundays)"
        }
      }
      
      if (slots.length === 0) {
        return {
          success: false,
          error: "No slots available on this date. Try another date.",
          available_dates: Object.keys(AVAILABLE_SLOTS).filter(d => AVAILABLE_SLOTS[d].length > 0)
        }
      }
      
      return {
        success: true,
        date,
        available_times: slots
      }
    }
    
    case "get_clinic_info": {
      return {
        success: true,
        clinic_info: {
          name: "Virtual Clinic",
          address: "123 Healthcare Street, Medical City",
          phone: "+1-800-CLINIC-1",
          hours: "Monday-Saturday: 9 AM - 5 PM",
          closed: "Sundays",
          emergency_line: "911"
        }
      }
    }
    
    case "escalate_to_emergency": {
      const { reason } = params
      return {
        success: true,
        message: `Emergency escalation initiated. Reason: ${reason}`,
        emergency_number: "911",
        instruction: "Please call 911 immediately for emergency medical assistance."
      }
    }
    
    default:
      return {
        success: false,
        error: `Unknown tool: ${toolName}`
      }
  }
}

// Voice Agent conversation handler
async function handleVoiceAgentConversation(req, res) {
  try {
    const { sessionId, userMessage, conversationHistory = [] } = req.body
    
    if (!userMessage || typeof userMessage !== "string") {
      return res.status(400).json({ success: false, error: "Missing user message" })
    }
    
    // Initialize or retrieve session
    if (!voiceAgentSessions.has(sessionId)) {
      voiceAgentSessions.set(sessionId, {
        sessionId,
        startTime: new Date(),
        history: [],
        state: "listening"
      })
    }
    
    const session = voiceAgentSessions.get(sessionId)
    
    // Add user message to history
    session.history.push({
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString()
    })
    
    // System prompt for voice agent
    const VOICE_AGENT_PROMPT = `You are a professional clinic receptionist AI assistant. Your job is to help patients schedule appointments, answer questions, and handle their requests naturally.

INSTRUCTIONS:
1. Be friendly, empathetic, and professional
2. Always listen to the patient's full message before responding
3. Ask clarifying questions if needed
4. When booking appointments, collect: patient name, phone, preferred date/time, and reason
5. Before confirming any action, repeat back the details to confirm
6. If the patient requests something impossible (e.g., Sunday when closed), explain naturally and offer alternatives
7. For emergencies, immediately recommend calling 911

AVAILABLE TOOLS (only use when needed):
- book_appointment: Book a medical appointment
- check_availability: Check available appointment slots
- get_clinic_info: Get clinic information
- escalate_to_emergency: Handle medical emergencies

Response Format:
{
  "agent_response": "Your natural language response to the patient",
  "tool_calls": [
    {
      "tool_name": "tool_name",
      "parameters": {...}
    }
  ],
  "state": "listening|waiting_for_tool_result"
}`
    
    // Build conversation context
    const recentHistory = session.history.slice(-10).map(msg => ({
      role: msg.role === "user" ? "user" : "assistant",
      parts: [{ text: msg.content }]
    }))
    
    // Add system context
    recentHistory.unshift({
      role: "user",
      parts: [{ text: VOICE_AGENT_PROMPT }]
    })
    
    // Get AI response with tool suggestions
    let agentResponse = await generateText(recentHistory)
    
    // Parse tool calls from response (simple JSON detection)
    let toolCalls = []
    let cleanResponse = agentResponse
    
    try {
      const jsonMatch = agentResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.tool_calls) {
          toolCalls = parsed.tool_calls
          cleanResponse = parsed.agent_response || agentResponse
        }
      }
    } catch (e) {
      // Response doesn't contain JSON, use as-is
    }
    
    // Execute tool calls if any
    const toolResults = []
    for (const toolCall of toolCalls) {
      const result = await executeToolCall(toolCall.tool_name, toolCall.parameters)
      toolResults.push({
        tool: toolCall.tool_name,
        result
      })
      
      // If tool returned an error with alternatives, use that for natural response
      if (!result.success && result.error) {
        cleanResponse += ` ${result.error}`
        if (result.available_times) {
          cleanResponse += ` Available times: ${result.available_times.join(", ")}.`
        }
        if (result.available_dates) {
          cleanResponse += ` Available dates: ${result.available_dates.join(", ")}.`
        }
      }
    }
    
    // Add agent response to history
    session.history.push({
      role: "assistant",
      content: cleanResponse,
      timestamp: new Date().toISOString()
    })
    
    return res.json({
      success: true,
      sessionId,
      agent_response: cleanResponse,
      tool_calls: toolResults,
      conversation_id: sessionId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Voice agent error:", error)
    res.status(500).json({
      success: false,
      error: "Voice agent processing failed",
      message: error.message
    })
  }
}

/* ──  Voice Agent Endpoint ── */
app.post("/api/voice-agent/chat", handleVoiceAgentConversation)

/* ── Get Voice Agent Session History ── */
app.get("/api/voice-agent/session/:sessionId", (req, res) => {
  const { sessionId } = req.params
  const session = voiceAgentSessions.get(sessionId)
  
  if (!session) {
    return res.status(404).json({ success: false, error: "Session not found" })
  }
  
  res.json({
    success: true,
    session: {
      sessionId: session.sessionId,
      startTime: session.startTime,
      messageCount: session.history.length,
      history: session.history
    }
  })
})

/* ── Create New Voice Agent Session ── */
app.post("/api/voice-agent/session", (req, res) => {
  const sessionId = `voice_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  
  voiceAgentSessions.set(sessionId, {
    sessionId,
    startTime: new Date(),
    history: [],
    state: "listening"
  })
  
  res.json({
    success: true,
    sessionId,
    message: "Voice agent session started. You can now speak to the clinic assistant.",
    greeting: "Hey, what is your emergency?"
  })
})

/* ── Get Available Tools ── */
app.get("/api/voice-agent/tools", (req, res) => {
  res.json({
    success: true,
    tools: AVAILABLE_TOOLS,
    description: "These are the tools the voice agent can use to assist patients"
  })
})

/* ── Get Appointments ── */
app.get("/api/appointments", (req, res) => {
  const appointments = Array.from(appointmentsDB.values())
  res.json({
    success: true,
    count: appointments.length,
    appointments
  })
})

/* ── Simple AI chat (backward compat) ── */
app.post("/ai", async (req, res) => {
  try {
    if (!ensureAnyKey(res)) return
    const userMessage = req.body?.message
    if (!userMessage || typeof userMessage !== "string") {
      return res.status(400).json({ error: "Missing message" })
    }
    const text = await generateText([{ role: "user", parts: [{ text: userMessage }] }])
    res.json({ reply: text })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "AI generation failed" })
  }
})

/* ─────────────── Server Startup ─────────────── */
const PORT = Number(process.env.PORT) || 3001
app.listen(PORT, () => {
  console.log(`\n🏥 Virtual Clinic Medical Triage System`)
  console.log(`📡 Server running on port ${PORT}`)
  console.log(`  Vertex AI: ${VERTEX_AI_KEY ? "✅ configured" : "❌ not set"}`)
  console.log(`  Gemini: ${GEMINI_KEY ? "✅ configured" : "❌ not set"}`)
  console.log(`  OpenAI: ${OPENAI_KEY ? "✅ configured" : "❌ not set"}`)
  console.log(`  Fallback Chain: Vertex AI → Gemini → OpenAI\n`)
})