


import { savePatient, getUserProfile, saveAppointment, getLatestAppointment, addConversationEntry, updateAppointment, updateAppointmentByName, getAllAppointments, searchPatientsBySymptoms, searchAppointments, getMedicalHistory, saveCompletePatientProfile, saveConversationEntry, saveTriageAssessment, saveVoiceSession, getAllAppointmentsFromFirestore } from "./firestoreService.js";
import { savePatientToCSV, saveAppointmentToCSV, saveConversationToCSV, searchPatientsInCSV, getAllAppointmentsFromCSV, searchAppointmentsInCSV, comparePatientData, compareAppointmentData, getDataStatistics, exportDataAsJSON } from "./csvService.js";
import Groq from "groq-sdk";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express()
app.use(cors())
app.use(express.json({ limit: "10mb" }))

/* ─────────────── Groq Client Initialization ─────────────── */
let groq = null;
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

if (GROQ_API_KEY) {
  groq = new Groq({
    apiKey: GROQ_API_KEY
  });
} else {
  console.warn("⚠️  GROQ_API_KEY not set. Will use Ollama as fallback.");
}

/* ─────────────── Ollama Configuration ─────────────── */
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "phi3:mini";
const OLLAMA_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT || "15000"); // 15 seconds for faster responses

/* ─────────────── API keys check ─────────────── */
const VERTEX_AI_KEY = process.env.VERTEX_AI_API_KEY || ""
const GEMINI_KEY = process.env.GEMINI_API_KEY || ""
const OPENAI_KEY = process.env.OPENAI_API_KEY || ""

if (!VERTEX_AI_KEY && !GEMINI_KEY && !OPENAI_KEY && !GROQ_API_KEY) {
  console.warn("⚠️  No primary AI providers configured. Attempting to use Ollama as fallback.")
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash"
const VERTEX_AI_PROJECT = process.env.VERTEX_AI_PROJECT || "vertex-ai"
const VERTEX_AI_REGION = process.env.VERTEX_AI_REGION || "us-central1"

/* ─────────────── Medical Appointment Database ─────────────── */
const Medical_DB = {
  appointments: [],
  doctors: [
    { id: "dr_sharma", name: "Dr. Priya Sharma", specialty: "General Practice", available: true },
    { id: "dr_kumar", name: "Dr. Arjun Kumar", specialty: "Cardiology", available: true },
    { id: "dr_patel", name: "Dr. Meera Patel", specialty: "Pediatrics", available: true },
    { id: "dr_singh", name: "Dr. Vikram Singh", specialty: "Orthopedics", available: false },
    { id: "dr_gupta", name: "Dr. Anjali Gupta", specialty: "Dermatology", available: true },
    { id: "dr_verma", name: "Dr. Rohan Verma", specialty: "Neurology", available: true },
    { id: "dr_reddy", name: "Dr. Kavita Reddy", specialty: "Gynecology", available: true },
    { id: "dr_chopra", name: "Dr. Amit Chopra", specialty: "Ophthalmology", available: true }
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

/* ─────────────── Helper Functions ─────────────── */
function getRandomAvailableDoctor() {
  const availableDoctors = Medical_DB.doctors.filter(d => d.available)
  if (availableDoctors.length === 0) return "dr_sharma" // fallback
  return availableDoctors[Math.floor(Math.random() * availableDoctors.length)].id
}

/* ─────────────── Medical Tool Functions (Real Execution) ─────────────── */
function generateDefaultSlotsForDate(date) {
  // Generate default slots based on clinic hours (30-minute increments)
  const dt = new Date(date)
  const dayOfWeek = dt.getDay() // 0 = Sunday, 1 = Monday, ...

  // If clinic closed on Sunday
  if (dayOfWeek === 0) {
    return []
  }

  // Default working hours (these could be pulled from Medical_DB.clinicHours if parsed)
  const morningStart = 9
  const morningEnd = 12
  const afternoonStart = 13
  const afternoonEnd = 17

  const slots = []
  const addSlots = (startHour, endHour) => {
    for (let hour = startHour; hour < endHour; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`)
      slots.push(`${hour.toString().padStart(2, '0')}:30`)
    }
  }

  addSlots(morningStart, morningEnd)
  addSlots(afternoonStart, afternoonEnd)
  return slots
}

function checkAvailableSlots(date) {
  // Ensure date string is normalized
  const normalizedDate = date

  // Initialize slots for the date if it doesn’t already exist
  if (!Medical_DB.availableSlots[normalizedDate]) {
    Medical_DB.availableSlots[normalizedDate] = generateDefaultSlotsForDate(normalizedDate)
  }

  const slots = Medical_DB.availableSlots[normalizedDate]
  if (!slots || slots.length === 0) {
    return { success: false, error: `No appointments available for ${normalizedDate}` }
  }

  return { success: true, slots, date: normalizedDate }
}

async function bookAppointment(patientName, phoneNumber, date, time, reason, doctorID = "dr_sharma", patientAge = null) {
  // Ensure we have slots for the given date (generates defaults if missing)
  const slots = checkAvailableSlots(date).slots
  if (!slots || !slots.includes(time)) {
    return { success: false, error: `Time slot ${time} is not available on ${date}` }
  }
  
  // Create appointment (state change - real data persistence)
  const appointmentID = `APT_${Date.now()}`
  const appointment = {
    appointmentID,
    patientName,
    phoneNumber,
    age: patientAge || "Not specified",
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

  // Save appointment to CSV file
  try {
    const appointmentDataForCSV = {
      patientName: patientName,
      phoneNumber: phoneNumber,
      age: patientAge || "Not specified",
      email: "N/A",
      doctorSpecialization: Medical_DB.doctors.find(d => d.id === doctorID)?.specialty || "General",
      preferredDate: date,
      preferredTime: time,
      reasonForVisit: reason,
      status: "confirmed"
    }
    saveAppointmentToCSV(appointmentID, appointmentDataForCSV, "ai_voice")
    console.log(`✅ Appointment saved to CSV: ${appointmentID}`)
  } catch (error) {
    console.error("⚠️ Failed to save appointment to CSV:", error)
  }

  // Save appointment to Firestore database
  try {
    const appointmentDataForFirestore = {
      patientName: patientName,
      phoneNumber: phoneNumber,
      age: patientAge || "Not specified",
      email: "N/A",
      doctorSpecialization: Medical_DB.doctors.find(d => d.id === doctorID)?.specialty || "General",
      doctorName: Medical_DB.doctors.find(d => d.id === doctorID)?.name || "Dr. Priya Sharma",
      preferredDate: date,
      preferredTime: time,
      reasonForVisit: reason,
      status: "confirmed",
      conversationSummary: `Patient ${patientName} booked via voice AI assistant`
    }
    
    // Get or create user profile
    let userId = appointmentID
    try {
      const userProfile = await getUserProfile(phoneNumber)
      userId = userProfile.userId
    } catch (err) {
      console.warn("Could not fetch existing user profile, creating new one")
    }
    
    // Save to Firestore
    await saveAppointment(userId, appointmentDataForFirestore)
    console.log(`✅ Appointment saved to Firestore: ${appointmentID}`)

    // ════════════════════════════════════════════════════════════
    // FIRESTORE: Also save complete patient profile
    // ════════════════════════════════════════════════════════════
    try {
      const completePatientProfile = {
        name: patientName,
        phoneNumber: phoneNumber,
        email: "N/A",
        age: patientAge || "Not specified",
        symptoms: reason,
        chiefComplaint: reason,
        urgencyLevel: "general",
        triageMode: "general",
        sessionId: appointmentID,
        conversationLength: 1
      };
      const savedProfile = await saveCompletePatientProfile(completePatientProfile);
      console.log(`✅ Complete patient profile saved to Firestore: ${savedProfile.patientId}`);
    } catch (error) {
      console.warn("⚠️ Failed to save complete patient profile to Firestore:", error.message);
    }
  } catch (error) {
    console.error("⚠️ Failed to save appointment to Firestore:", error)
  }
  
  return {
    success: true,
    appointmentID,
    message: `✅ APPOINTMENT CONFIRMED!\n\n📅 Date: ${date}\n🕐 Time: ${time}\n👨‍⚕️ Doctor: ${Medical_DB.doctors.find(d => d.id === doctorID)?.name || 'Dr. Priya Sharma'}\n👤 Patient: ${patientName}\n🆔 Confirmation #: ${appointmentID}\n\n📋 APPOINTMENT INSTRUCTIONS:\n\n1️⃣ **Arrive Early**: Please arrive 10-15 minutes before your scheduled time for check-in and registration.\n\n2️⃣ **Bring Documents**: \n   • Government ID (Aadhar, PAN, or Passport)\n   • Health Insurance card (if available)\n   • List of current medications\n   • Any relevant medical reports or previous diagnoses\n\n3️⃣ **Location**: 123 Medical Center Drive, Healthcare City\n   📞 Phone: +91-XXXX-XXXX-XXXX\n\n4️⃣ **Rescheduling/Cancellation**: You can reschedule or cancel up to 24 hours before your appointment by calling us.\n\n5️⃣ **What to Expect**: Your appointment will be with ${Medical_DB.doctors.find(d => d.id === doctorID)?.name || 'Dr. Priya Sharma'} (${Medical_DB.doctors.find(d => d.id === doctorID)?.specialty || 'General Practitioner'}). Typical consultation duration is 20-30 minutes.\n\n✨ Your appointment details have been saved to both local records and Firebase database. You should receive a confirmation SMS/email shortly.\n\nThank you for choosing our clinic!`,
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
function startTriageSession(mode = "general") {
  const sessionId = "triage_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9)
  const session = {
    sessionId,
    startTime: new Date(),
    mode: mode || "general",
    triageLevel: "UNCLEAR",
    chieComplaint: "",
    conversationHistory: [],
    patientData: {
      name: null,
      phone: null,
      age: null,
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
    appointmentData: null,
    appointmentBooking: {
      inProgress: false,
      missingDetails: [],
      collectedDetails: {}
    },
    awaitingSlotSelection: false,
    lastSlotDate: null
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
  const { redFlagsPresent, severity, pregnant, riskFactors } = session.patientData
  
  // Emergency: red flags detected
  if (redFlagsPresent) return "EMERGENCY"
  
  // Urgent: severe symptoms, high-risk conditions, significant pain
  if (severity >= 8 || pregnant === "yes" || riskFactors.length > 0) {
    return "URGENT"
  }
  
  // Soon: moderate symptoms
  if (severity >= 5) {
    return "SOON"
  }
  
  // Routine: mild stable issues
  return "ROUTINE"
}

/* ── Sequential Response Splitter: Break long responses into multiple shorter messages ── */
function splitIntoSequentialResponses(response) {
  // If response is short, return as single message
  if (response.length < 120) {
    return [response]
  }

  const responses = []
  
  // Split by sentence boundaries (. ! ?) to create natural breaks
  const sentences = response.split(/(?<=[.!?])\s+/)
  let currentMessage = ""

  for (const sentence of sentences) {
    // If adding sentence would exceed 100 chars, save current and start new
    if (currentMessage.length + sentence.length > 100 && currentMessage.length > 0) {
      responses.push(currentMessage.trim())
      currentMessage = sentence
    } else {
      currentMessage += (currentMessage ? " " : "") + sentence
    }
  }

  // Add remaining message
  if (currentMessage.trim()) {
    responses.push(currentMessage.trim())
  }

  // Return at most 2 sequential messages for responsive feel
  return responses.slice(0, 2)
}

// Helper: Detect if we should suggest an appointment (for general mode)
function shouldSuggestAppointment(session, userAnswer) {
  // Only for general mode
  if (session.mode !== "general") return { shouldSuggest: false }
  
  // Need at least 3 messages (greeting + user response + AI question + user answer)
  const userMessages = session.conversationHistory.filter(m => m.role === "user")
  if (userMessages.length < 2) return { shouldSuggest: false }
  
  // Check if symptoms mentioned (pain, fever, cough, headache, etc.)
  const symptomKeywords = /\b(pain|fever|cough|headache|nausea|vomit|dizzy|fatigue|ache|hurt|itch|sore|bleed|sweat|weakness|loss of appetite|sick|ill)\b/i
  const hasSymptoms = symptomKeywords.test(userAnswer) || 
    userMessages.some(m => symptomKeywords.test(m.parts[0].text))
  
  if (!hasSymptoms) return { shouldSuggest: false }
  
  // Check if history/duration mentioned (days, weeks, started, when, how long)
  const historyKeywords = /\b(day|week|month|since|for|started|began|when|how long|yesterday|today|last)\b/i
  const hasHistory = historyKeywords.test(userAnswer) || 
    userMessages.some(m => historyKeywords.test(m.parts[0].text))
  
  if (!hasHistory) return { shouldSuggest: false }
  
  // Check if appointment not already being booked
  if (session.appointmentBooking?.inProgress) return { shouldSuggest: false }
  
  // All conditions met - suggest appointment
  return { shouldSuggest: true }
}

// Simple rule-based fallback responder when AI services are unavailable
function generateRuleBasedReply(userAnswer, session) {
  const lower = (userAnswer || "").toLowerCase()
  
  // EMERGENCY DETECTION
  const emergencyKeywords = [
    "chest pain",
    "trouble breathing",
    "can't breathe",
    "shortness of breath",
    "severe bleeding",
    "stroke",
    "faint",
    "unconscious",
    "suicidal",
    "self-harm",
    "seizure",
    "confusion",
    "severe headache",
    "tightness in chest",
    "poisoning",
    "overdose",
    "severe burn",
    "choking"
  ]

  if (emergencyKeywords.some(k => lower.includes(k))) {
    session.triageLevel = "EMERGENCY"
    session.escalationAction = "emergency"
    return "⚠️ This sounds like a medical emergency. Please call 102 (Ambulance) immediately or go to the nearest hospital right away."
  }

  // SYMPTOM-SPECIFIC FOLLOW-UPS
  const symptomPatterns = [
    { pattern: /\b(fever|temperature|hot)\b/, question: "How high is your fever and for how many days have you had it?" },
    { pattern: /\b(pain|ache|hurt|sore|aching)\b/, question: "Where exactly is the pain and on a scale of 1-10, how severe is it?" },
    { pattern: /\b(cough|coughing|coughed)\b/, question: "Is your cough dry or wet? Are you coughing up anything?" },
    { pattern: /\b(nausea|vomit|throwing up|sick)\b/, question: "How long have you been feeling this way? Can you keep food/water down?" },
    { pattern: /\b(dizzy|dizziness|lightheaded|spinning)\b/, question: "Are you dizzy when you move or all the time? Any nausea with it?" },
    { pattern: /\b(headache|migraine|head pain)\b/, question: "Is this a new headache or does it happen often? Any neck stiffness?" },
    { pattern: /\b(stomach|abdominal|belly|nausea|cramps)\b/, question: "Where in your stomach is the discomfort? Is it constant or comes and goes?" },
    { pattern: /\b(rash|itching|itchy|redness|skin)\b/, question: "Where is the rash and how long have you had it? Is it itchy or painful?" },
    { pattern: /\b(sore throat|throat|difficulty swallowing)\b/, question: "How long has your throat been sore? Do you have a fever too?" },
    { pattern: /\b(wound|cut|injury|bleeding)\b/, question: "How deep is the wound and when did it happen? Is it still bleeding?" }
  ]

  // Check for symptom-specific patterns
  for (const item of symptomPatterns) {
    if (item.pattern.test(lower)) {
      return item.question
    }
  }

  // MEDICATION/ALLERGY CHECK
  if (lower.includes("medicine") || lower.includes("medication") || lower.includes("allergy") || lower.includes("allergic")) {
    return "Are you taking any medications right now, and do you have any known allergies?"
  }

  // PREVIOUS HISTORY CHECK
  if (lower.includes("before") || lower.includes("happened") || lower.includes("history")) {
    return "Has something like this happened to you before?"
  }

  // DURATION CHECK
  if (lower.includes("when") || lower.includes("how long") || lower.includes("day") || lower.includes("week")) {
    return "When did these symptoms start exactly?"
  }

  // GENERAL FALLBACK
  return "Can you tell me when these symptoms started and what made you decide to come in today?"
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
app.post("/api/voice-agent/book-appointment", async (req, res) => {
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
    const result = await bookAppointment(patientName, phoneNumber, date, time, reason)
    
    // IMPORTANT: Save to CSV as well (voice agent booking)
    if (result.success) {
      try {
        const appointmentDataForCSV = {
          patientName,
          phoneNumber,
          doctorSpecialization: Medical_DB.doctors.find(d => d.id === "dr_sharma")?.specialty || "General Practice",
          preferredDate: date,
          preferredTime: time,
          reasonForVisit: reason,
          status: "confirmed",
          appointmentID: result.appointmentID
        };
        
        // Use a patient ID derived from phone number
        const userIdForCSV = "patient_" + phoneNumber.replace(/\D/g, "");
        await saveAppointmentToCSV(userIdForCSV, appointmentDataForCSV, "voice_agent");
        console.log("✅ Voice agent appointment also saved to CSV with method: voice_agent");
      } catch (csvError) {
        console.error("⚠️ Warning: Could not save to CSV:", csvError.message);
        // Don't fail the entire request if CSV save fails
      }
    }
    
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
app.post("/api/test/simulate-booking", async (req, res) => {
  try {
    const { patientName = "John Doe", phoneNumber = "555-1234", date = "2026-03-14", time = "09:00" } = req.body
    
    // Execute real tool
    const result = await bookAppointment(patientName, phoneNumber, date, time, "Test appointment")
    
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

// Debug endpoint: view session state (development only)
app.get("/api/debug/session", (req, res) => {
  const { sessionId } = req.query
  if (!sessionId) {
    return res.status(400).json({ success: false, error: "Missing sessionId" })
  }
  const session = triageSessions.get(sessionId)
  if (!session) {
    return res.status(404).json({ success: false, error: "Session not found" })
  }
  res.json({ success: true, session })
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

/* ── PATIENT: Book Appointment ── */
app.post("/api/patient/book-appointment", async (req, res) => {
  try {
    const { patientName, phoneNumber, age, date, time } = req.body
    
    // Validate required fields
    if (!patientName || !phoneNumber || !age || !date || !time) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        required: ["patientName", "phoneNumber", "age", "date", "time"],
        provided: { patientName, phoneNumber, age, date, time }
      })
    }
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        error: "Invalid date format. Use YYYY-MM-DD format."
      })
    }
    
    // Validate time format (HH:MM)
    const timeRegex = /^\d{2}:\d{2}$/
    if (!timeRegex.test(time)) {
      return res.status(400).json({
        success: false,
        error: "Invalid time format. Use HH:MM format (24-hour)."
      })
    }
    
    // Pick any available doctor, but do not force the user to choose one.
    const selectedDoctor =
      Medical_DB.doctors.find(d => d.available) || Medical_DB.doctors[0]
    
    const defaultReason = "General appointment"

    // Book the appointment
    const bookingResult = await bookAppointment(
      patientName,
      phoneNumber,
      date,
      time,
      defaultReason,
      selectedDoctor.id
    )
    
    if (!bookingResult.success) {
      return res.status(400).json({
        success: false,
        error: bookingResult.error
      })
    }

    // Generate a simple patient ID (shared with CSV)
    const patientId = "patient_" + phoneNumber.replace(/\D/g, "")

    // Save to local CSV as well (form-based booking)
    try {
      const appointmentDataForCSV = {
        patientName,
        phoneNumber,
        doctorSpecialization: selectedDoctor.specialty,
        preferredDate: date,
        preferredTime: time,
        reasonForVisit: defaultReason,
        status: "confirmed"
      };
      
      // Use patientId as userId for CSV tracking
      const userIdForCSV = patientId;
      await saveAppointmentToCSV(userIdForCSV, appointmentDataForCSV, "form");
      console.log("✅ Form-based appointment also saved to CSV with method: form");
    } catch (csvError) {
      console.error("⚠️ Warning: Could not save to CSV:", csvError.message);
      // Don't fail the entire request if CSV save fails
    }
    
    // Return success response
    res.json({
      success: true,
      message: "Appointment booked successfully!",
      appointment: {
        id: bookingResult.appointmentID,
        patientId,
        patientName,
        phoneNumber,
        age,
        date,
        time,
        status: "confirmed",
        bookedAt: new Date().toISOString(),
        confirmationMessage: `Your appointment is confirmed for ${date} at ${time}. Your Patient ID is ${patientId}.`
      },
      clinicInfo: {
        address: "123 Medical Center Drive, Healthcare City",
        phone: "(555) 123-4567",
        hours: Medical_DB.clinicHours
      }
    })
    
  } catch (error) {
    console.error("Error booking patient appointment:", error)
    res.status(500).json({
      success: false,
      error: "Failed to book appointment",
      message: error.message
    })
  }
})

/* ── PATIENT: Check Available Slots ── */
app.get("/api/patient/available-slots", (req, res) => {
  try {
    const { date } = req.query
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: "Date parameter is required (format: YYYY-MM-DD)"
      })
    }
    
    const slotsResult = checkAvailableSlots(date)
    
    if (!slotsResult.success) {
      return res.status(404).json({
        success: false,
        error: slotsResult.error
      })
    }
    
    res.json({
      success: true,
      date,
      availableSlots: slotsResult.slots,
      clinicHours: Medical_DB.clinicHours,
      doctors: Medical_DB.doctors.filter(d => d.available)
    })
    
  } catch (error) {
    console.error("Error checking available slots:", error)
    res.status(500).json({
      success: false,
      error: "Failed to check available slots",
      message: error.message
    })
  }
})

/* ── PATIENT: Get Doctors ── */
app.get("/api/patient/doctors", (req, res) => {
  try {
    res.json({
      success: true,
      doctors: Medical_DB.doctors,
      clinicHours: Medical_DB.clinicHours
    })
  } catch (error) {
    console.error("Error getting doctors:", error)
    res.status(500).json({
      success: false,
      error: "Failed to get doctors list",
      message: error.message
    })
  }
})

/* ── APPOINTMENTS: Get All (for Clinic Hours view) ── */
app.get("/api/appointments/all", async (req, res) => {
  try {
    // Get appointments from both CSV and Firestore
    const csvAppointments = await getAllAppointmentsFromCSV()
    const firestoreAppointments = await getAllAppointmentsFromFirestore()
    
    // Combine and deduplicate by composite key (phone + date + time)
    const appointmentMap = new Map()
    
    // Add CSV appointments first
    csvAppointments.forEach(apt => {
      const phone = apt.phoneNumber || ""
      const date = apt.preferredDate || apt.date || ""
      const time = apt.preferredTime || apt.time || ""
      const compositeKey = `${phone}_${date}_${time}`
      appointmentMap.set(compositeKey, {
        ...apt,
        source: "csv"
      })
    })
    
    // Add Firestore appointments (preferring Firestore over CSV if duplicate)
    firestoreAppointments.forEach(apt => {
      const phone = apt.phoneNumber || ""
      const date = apt.preferredDate || apt.date || ""
      const time = apt.preferredTime || apt.time || ""
      const compositeKey = `${phone}_${date}_${time}`
      appointmentMap.set(compositeKey, {
        ...apt,
        source: "firestore"
      })
    })
    
    // Convert map to array and sort by date
    const appointments = Array.from(appointmentMap.values()).sort((a, b) => {
      const dateA = new Date(`${a.preferredDate || a.date} ${a.preferredTime || a.time}`);
      const dateB = new Date(`${b.preferredDate || b.date} ${b.preferredTime || b.time}`);
      return dateA - dateB;
    })
    
    console.log(`📅 Retrieved ${appointments.length} deduplicated appointments (Original CSV: ${csvAppointments.length}, Original Firestore: ${firestoreAppointments.length})`)
    
    res.json({
      success: true,
      appointments,
      summary: {
        total: appointments.length,
        fromCSV: csvAppointments.length,
        fromFirestore: firestoreAppointments.length
      }
    })
  } catch (error) {
    console.error("Error getting all appointments:", error)
    res.status(500).json({
      success: false,
      error: "Failed to get appointments",
      message: error.message
    })
  }
})

/* ── Start triage session ── */
app.post("/api/triage/start", (req, res) => {
  try {
    const { mode = "general" } = req.body
    const sessionId = startTriageSession(mode)
    const session = triageSessions.get(sessionId)
    
    // Determine greeting based on mode
    let greeting = ""
    switch ((mode || "").toString().toLowerCase()) {
      case "urgent":
        greeting = "Urgent Care Evaluation Started"
        break
      case "general":
      default:
        greeting = "Hey, how are you today?"
        break
    }
    
    res.json({
      success: true,
      sessionId,
      mode,
      message: greeting,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error starting triage session:", error)
    res.status(500).json({ success: false, error: "Failed to start session", message: error.message })
  }
})

/* ── First triage question (consent + emergency screening) ── */
app.get("/api/triage/initial-question", (req, res) => {
  const { sessionId, mode = "general" } = req.query
  const session = getSession(sessionId, res)
  if (!session) return

  try {
    let question
    let questionType

    switch ((mode || "").toString().toLowerCase()) {
      case "urgent":
        questionType = "urgent_screen"
        question = "What are your most critical symptoms right now?"
        break
      case "mental":
        questionType = "mental_screen"
        question = "How have you been feeling emotionally lately?"
        break
      case "general":
      default:
        questionType = "general_screen"
        question = "What symptoms or concerns bring you in today?"
        break
    }

    session.conversationHistory.push({
      role: "assistant",
      parts: [{ text: question }]
    })

    res.json({
      success: true,
      question,
      questionType,
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

    // STEP 1: Database search for related cases
    console.log("🔍 Searching database for related symptoms...")
    const medicalHistory = await getMedicalHistory(userAnswer)
    const databaseSearch = {
      searchPerformed: true,
      relatedCasesFound: medicalHistory.recentCases.length > 0,
      casesCount: medicalHistory.recentCases.length,
      recentCases: medicalHistory.recentCases.map(c => ({
        symptoms: c.symptoms,
        urgencyLevel: c.urgencyLevel,
        recommendedAction: c.recommendedAction,
        createdAt: c.timestamp
      })),
      commonUrgencies: medicalHistory.commonUrgencies
    }
    console.log("✅ Database search completed. Found", databaseSearch.casesCount, "related cases")

    // Store user response
    session.conversationHistory.push({
      role: "user",
      parts: [{ text: userAnswer }]
    })

    // ════════════════════════════════════════════════════════════
    // FIRESTORE: Save user message to conversations collection
    // ════════════════════════════════════════════════════════════
    try {
      await saveConversationEntry(sessionId, session.patientId || sessionId, "user", userAnswer, {
        messageType: "voice_transcription",
        confidence: 0.95 // Default confidence, can be improved with actual STT confidence
      });
      console.log("✅ User message saved to Firestore");
    } catch (error) {
      console.warn("⚠️ Failed to save user message to Firestore:", error.message);
    }

    // Check for emergency indicators in urgent mode
    const lowerAnswer = userAnswer.toLowerCase()
    const seriousSymptoms = /chest pain|heart|breathing|breath|shortness|bleeding|bleed|injury|broken|fracture|unconscious|faint|collapse|stroke|seizure|poison|overdose|burn|choking|difficulty breathing|can't breathe|severe/i
    
    if (session.mode === "urgent" && seriousSymptoms.test(userAnswer)) {
      session.triageLevel = "EMERGENCY"
      session.escalationAction = "emergency"
      
      res.json({
        success: true,
        answer: userAnswer,
        triageLevel: "EMERGENCY",
        nextAction: "escalate_emergency",
        emergencyRouting: true,
        message: "🚨 EMERGENCY DETECTED 🚨\n\nCall 102 (Ambulance) or go to the nearest hospital immediately.",
        sessionId,
        timestamp: new Date().toISOString(),
        databaseSearch
      })
      return
    }

    // Quick check for irrelevant / off-topic questions before tool execution
    const irrelevantPatterns = /\b(what\s+time\s+is\s+it|what\s+is\s+the\s+time|what\s+day\s+is\s+it|what\s+is\s+your\s+name|tell\s+me\s+a\s+joke|how\s+are\s+you|what\s+is\s+the\s+weather|who\s+are\s+you)\b/i
    if (irrelevantPatterns.test(userAnswer)) {
      const responseText = "Question irrelevant. Please provide details about your symptoms or the reason for seeking care."
      session.conversationHistory.push({ role: "assistant", parts: [{ text: responseText }] })
      return res.json({
        success: true,
        answer: userAnswer,
        sessionId,
        toolExecuted: false,
        nextQuestion: responseText,
        questionType: "irrelevant",
        timestamp: new Date().toISOString(),
        databaseSearch
      })
    }

    // ╔═══════════════════════════════════════════╗
    // ║ AUTONOMOUS TOOL CALLING FOR APPOINTMENTS ║
    // ╚═══════════════════════════════════════════╝

    let toolExecuted = false
    let toolResult = null
    let toolName = null

    // If we asked the user to pick a time slot, allow a bare time reply to book it
    const extractedTime = extractTime(userAnswer)
    const isTimeOnlyResponse = /^\s*(\d{1,2})(:\d{2})?\s*(am|pm)?\s*\.?\s*$/i.test(userAnswer)
    if (session.awaitingSlotSelection && extractedTime && isTimeOnlyResponse) {
      const bookDate = session.lastSlotDate || getNextBusinessDay()
      toolName = "book_appointment"
      toolResult = await bookAppointment(
        session.patientData?.name || "Patient",
        session.patientData?.phone || "555-0000",
        bookDate,
        extractedTime,
        session.chiefComplaint || "General consultation",
        getRandomAvailableDoctor(),
        session.patientData?.age || null
      )
      toolExecuted = true
      session.awaitingSlotSelection = false
      session.lastSlotDate = null
      console.log("✅ Booking appointment from time-only reply")
    }

    // 1. DETECT: Book Request Pattern (Enhanced)
    const bookPatterns = /(\bbook\b|\bschedule\b|\bmake\b|\bget\b|\bset\b|\bwant\b|\bneed\b)\s*(\ban\s*)?appointment|\bappointment\s*(for|on|at|next|tomorrow|today)|\bi'd\s+like\s+to\s+(book|schedule|make)|\bcan\s+i\s+(book|get|schedule|make)|\bappointment\s+please/i
    if (!toolExecuted && bookPatterns.test(userAnswer)) {
      console.log("📅 Detected appointment booking request")

      // Check if urgent mode and serious symptoms detected
      const seriousSymptoms = /chest pain|heart|breathing|breath|shortness|bleeding|bleed|injury|broken|fracture|unconscious|faint|collapse|stroke|seizure|poison|overdose|burn|choking|emergency/i
      const isUrgentWithSeriousSymptoms = session.mode === "urgent" && seriousSymptoms.test(session.conversationHistory.map(m => m.parts?.[0]?.text || "").join(" "))
      
      if (isUrgentWithSeriousSymptoms) {
        // Present emergency routing options for urgent mode with serious symptoms
        console.log("🚨 URGENT MODE: Serious symptoms detected - presenting emergency options")
        toolName = "emergency_routing"
        toolResult = {
          success: true,
          emergencyRouting: true,
          options: [
            { id: "er", label: "Go to Nearest Emergency Room", description: "Immediate evaluation at the nearest ER" },
            { id: "ambulance", label: "Call Ambulance (102)", description: "Emergency ambulance dispatch and immediate medical care" }
          ],
          message: "⚠️ Based on your symptoms, I recommend immediate emergency care. You have two options:"
        }
        toolExecuted = true
      } else {
        // General appointment booking - collect missing details first
        const missingDetails = []
        if (!session.patientData?.name || session.patientData.name === "Patient") {
          missingDetails.push("name")
        }
        if (!session.patientData?.phone || session.patientData.phone === "555-0000") {
          missingDetails.push("phone")
        }
        if (!session.patientData?.age) {
          missingDetails.push("age")
        }

        if (missingDetails.length > 0) {
          // Need to collect details first
          console.log("📋 Need to collect details:", missingDetails)
          
          // Create a friendly message for each detail needed
          let detailMessage = "Perfect! Before I can book your appointment, I need to collect some information:\n\n"
          if (missingDetails.includes("name")) {
            detailMessage += "👤 First, what's your full name?\n"
          }
          if (missingDetails.includes("phone")) {
            detailMessage += "📱 What's your phone number?\n"
          }
          if (missingDetails.includes("age")) {
            detailMessage += "🎂 And your age?\n"
          }
          detailMessage += "\nOnce I have these details, I can show you available appointment slots."
          
          toolName = "collect_appointment_details"
          toolResult = {
            success: true,
            missingDetails,
            message: detailMessage,
            nextDetail: missingDetails[0]
          }
          toolExecuted = true
        } else {
          // All details collected - show available slots
          console.log("✅ All appointment details collected, showing slots")
          const tomorrow = getNextBusinessDay()
          const slotsResult = checkAvailableSlots(tomorrow)
          
          if (slotsResult.success && slotsResult.slots && slotsResult.slots.length > 0) {
            toolName = "show_appointment_slots"
            toolResult = {
              success: true,
              date: tomorrow,
              availableSlots: slotsResult.slots,
              patientInfo: {
                name: session.patientData?.name,
                phone: session.patientData?.phone,
                age: session.patientData?.age
              },
              message: `Perfect! Here are the available appointment times for ${tomorrow}:\n\nPlease select one of the times below by clicking on it or saying the time (e.g., "10:00 AM" or "2:30 PM"):`
            }
            session.awaitingSlotSelection = true
            session.lastSlotDate = tomorrow
            toolExecuted = true
          } else {
            // No slots available
            toolName = "check_slots"
            toolResult = {
              success: false,
              message: `No appointments available for ${tomorrow}. The clinic is closed on Sundays. Would you like to check another date?`
            }
            toolExecuted = true
          }
        }
      }
    }

    // 2. DETECT: Reschedule Request Pattern (Enhanced)
    const reschedulePatterns = /\breschedule\b|\bmove\b|\bchange\b.*\bappointment\b|\bdifferent\b.*\btime\b|\bnew\b.*\btime\b|\bchange\b.*\bdate\b/i
    if (reschedulePatterns.test(userAnswer) && !toolExecuted) {
      console.log("🔄 Detected reschedule request")

      // Find patient's last appointment
      const lastAppointment = Medical_DB.appointments
        .filter(a => a.phoneNumber === (session.patientData?.phone || "555-0000") && a.status === "confirmed")
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0]

      if (lastAppointment) {
        const extractedDate = extractDate(userAnswer)
        const extractedTime = extractTime(userAnswer)

        if (extractedDate && extractedTime) {
          toolName = "reschedule_appointment"
          toolResult = rescheduleAppointment(lastAppointment.appointmentID, extractedDate, extractedTime)
          toolExecuted = true
          console.log("✅ Rescheduling appointment")
        } else {
          // Show current appointment and ask for new date/time
          toolName = "check_current_appointment"
          toolResult = {
            success: true,
            currentAppointment: lastAppointment,
            message: `Your current appointment is on ${lastAppointment.date} at ${lastAppointment.time}. What date and time would you prefer instead?`
          }
          toolExecuted = true
        }
      } else {
        toolResult = {
          success: false,
          error: "I couldn't find any confirmed appointments for you. Would you like to book a new appointment instead?"
        }
        toolExecuted = true
      }
    }

    // 3. DETECT: Cancel Request Pattern (Enhanced)
    const cancelPatterns = /\bcancel\b|\bremove\b|\bdelete\b.*\bappointment\b|\bdon't\s+need\b|\bno\s+longer\b.*\bneed\b/i
    if (cancelPatterns.test(userAnswer) && !toolExecuted) {
      console.log("❌ Detected cancel request")

      const lastAppointment = Medical_DB.appointments
        .filter(a => a.phoneNumber === (session.patientData?.phone || "555-0000") && a.status === "confirmed")
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0]

      if (lastAppointment) {
        toolName = "cancel_appointment"
        toolResult = cancelAppointment(lastAppointment.appointmentID)
        toolExecuted = true
        console.log("✅ Cancelling appointment")
      } else {
        toolResult = {
          success: false,
          error: "I couldn't find any confirmed appointments for you to cancel."
        }
        toolExecuted = true
      }
    }

    // 4. DETECT: Slot Availability Request (Enhanced)
    const availabilityPatterns = /\b(availability|available|slots?|open|free|check)\b/i
    if (availabilityPatterns.test(userAnswer) && !toolExecuted) {
      console.log("📅 Detected availability check request")

      const extractedDate = extractDate(userAnswer)
      const targetDate = extractedDate || getNextBusinessDay()

      console.log("🗓 availability parsing:", { extractedDate, targetDate, userAnswer })

      toolName = "check_slots"
      toolResult = checkAvailableSlots(targetDate)
      toolExecuted = true
      console.log(`📋 Checking slots for ${targetDate}`)
    }

    // 6. DETECT: Patient Information (Name/Phone/Age)
    const namePatterns = /\bmy\s+(?:\w+\s+)*name\s+is\b|\bi'm\b|\bi\s+am\b|\bname\b.*\b\w+|\bcall\s+me\b/i
    const phonePatterns = /\bphone\b|\bnumber\b|\bcontact\b|\d{3}[-\s]?\d{3}[-\s]?\d{4}|\(\d{3}\)\s*\d{3}[-\s]?\d{4}|\d{10}/i
    const agePatterns = /\bage\b|\byears?\s+old\b|\bi'm\s+\d+\b|\bi\s+am\s+\d+\b/i

    // Extract name
    if (namePatterns.test(userAnswer) && !session.patientData?.name) {
      const nameMatch = userAnswer.match(/(?:my\s+(?:\w+\s+)*name\s+is|i'm|i\s+am|call\s+me)\s+([A-Za-z\s]+?)(?:\s+(?:my|phone|number|age|is|and)\b|$)/i)
      if (nameMatch) {
        session.patientData.name = nameMatch[1].trim()
        console.log(`✅ Extracted name: ${session.patientData.name}`)
        if (!toolExecuted) {
          toolName = "collect_info"
          toolResult = {
            success: true,
            message: `Thanks, ${session.patientData.name}! I've noted your name.`
          }
          toolExecuted = true
        }
      }
    }

    // Extract phone number (supports both US and Indian formats)
    if (phonePatterns.test(userAnswer) && !session.patientData?.phone) {
      const phoneMatch = userAnswer.match(/(\d{10}|\d{3}[-\s]?\d{3}[-\s]?\d{4}|\(\d{3}\)\s*\d{3}[-\s]?\d{4})/)
      if (phoneMatch) {
        session.patientData.phone = phoneMatch[1].replace(/[^0-9]/g, '')
        console.log(`✅ Extracted phone: ${session.patientData.phone}`)
        if (!toolExecuted) {
          toolName = "collect_info"
          toolResult = {
            success: true,
            message: `Got it! I've saved your phone number: ${session.patientData.phone}`
          }
          toolExecuted = true
        }
      }
    }

    // Extract age
    if (agePatterns.test(userAnswer) && !session.patientData?.age) {
      const ageMatch = userAnswer.match(/(\d{1,3})(?:\s+years?\s+old|\b)/i)
      if (ageMatch) {
        const ageValue = parseInt(ageMatch[1])
        if (ageValue > 0 && ageValue < 150) {
          session.patientData.age = ageValue.toString()
          console.log(`✅ Extracted age: ${session.patientData.age}`)
          if (!toolExecuted) {
            toolName = "collect_info"
            toolResult = {
              success: true,
              message: `Got it! I've saved your age as ${session.patientData.age} years.`
            }
            toolExecuted = true
          }
        }
      }
    }
    
    // Keep track of slot selection state so time-only replies can book automatically
    if (toolExecuted && toolName === "check_slots" && toolResult?.success) {
      session.awaitingSlotSelection = true
      session.lastSlotDate = toolResult.date
    } else if (toolExecuted) {
      session.awaitingSlotSelection = false
      session.lastSlotDate = null
    }

    // Build response
    const responseObject = {
      success: true,
      answer: userAnswer,
      sessionId,
      toolExecuted,
      timestamp: new Date().toISOString(),
      databaseSearch
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
            const doctorName = Medical_DB.doctors.find(d => d.id === toolResult.appointment.doctorID)?.name || "your doctor"
            confirmationMsg = `✅ **Appointment Confirmed!**\n\n📅 Date: ${toolResult.appointment.date}\n🕐 Time: ${toolResult.appointment.time}\n👨‍⚕️ Doctor: ${doctorName}\n🆔 Confirmation #: ${toolResult.appointmentID}\n\n📍 Location: 123 Medical Center Drive, Healthcare City\n⏰ **Please arrive 15 minutes early** for check-in. Bring your ID and any relevant medical documents.\n\n✨ Your appointment details have been saved. You can reschedule or cancel up to 24 hours before your appointment by contacting us.\n\nThank you for using our clinic. See you soon!`
            break
          case "reschedule_appointment":
            confirmationMsg = `✅ **Appointment Rescheduled!**\n\n📅 New Date: ${toolResult.appointment.date}\n🕐 New Time: ${toolResult.appointment.time}\n🆔 Confirmation #: ${toolResult.appointment.appointmentID}\n\nYour appointment has been moved successfully.`
            break
          case "cancel_appointment":
            confirmationMsg = `✅ **Appointment Cancelled**\n\nYour appointment has been cancelled. If you'd like to book a new appointment, just let me know what date and time works for you.`
            break
          case "show_appointment_slots":
            const slotsList = toolResult.availableSlots && toolResult.availableSlots.length > 0
              ? toolResult.availableSlots.map((slot, i) => `${i + 1}. ${slot}`).join('\n')
              : 'No slots available'
            confirmationMsg = `📅 **Available Appointment Times for ${toolResult.date}**\n\nI have your details:\n👤 Name: ${toolResult.patientInfo.name}\n📞 Phone: ${toolResult.patientInfo.phone}\n🎂 Age: ${toolResult.patientInfo.age}\n\nChoose from these available times:\n${slotsList}\n\nJust tell me which time works best for you!`
            responseObject.appointmentSlots = {
              date: toolResult.date,
              slots: toolResult.availableSlots,
              patientInfo: toolResult.patientInfo
            }
            break
          case "collect_appointment_details":
            confirmationMsg = `${toolResult.message}`
            responseObject.collectingDetails = {
              missingDetails: toolResult.missingDetails,
              nextDetail: toolResult.nextDetail
            }
            break
          case "emergency_routing":
            const erOption = `🏥 **Go to Nearest Emergency Room**\nImmediate evaluation at the nearest ER`
            const callOption = `📞 **Call Ambulance (102)**\nEmergency ambulance dispatch and immediate medical care`
            confirmationMsg = `${toolResult.message}\n\n${erOption}\n\n${callOption}\n\n⏱️ Please choose one of these options immediately.`
            responseObject.emergencyRouting = {
              options: toolResult.options,
              isEmergency: true
            }
            break
          case "check_slots":
            const slots = toolResult.slots || []
            if (slots.length > 0) {
              confirmationMsg = `📅 **Available Times for ${toolResult.date}:**\n\n${slots.join(", ")}\n\nTo book an appointment, just tell me which time you'd prefer!`
            } else {
              confirmationMsg = `❌ No appointments available for ${toolResult.date}. The clinic is closed on Sundays. Would you like me to check another date?`
            }
            break
          case "collect_patient_info":
            confirmationMsg = toolResult.message
            break
          case "collect_info":
            confirmationMsg = toolResult.message
            break
          case "clinic_info":
            const hoursText = Object.entries(toolResult.hours)
              .map(([day, hours]) => `${day.charAt(0).toUpperCase() + day.slice(1)}: ${hours}`)
              .join('\n')
            confirmationMsg = `🏥 **${toolResult.clinicName}**\n\n📍 Address: ${toolResult.address}\n📞 Phone: ${toolResult.phone}\n\n🕐 Hours:\n${hoursText}\n\nAvailable Doctors:\n${toolResult.doctors.map(d => `• ${d.name} (${d.specialty})`).join('\n')}`
            break
        }
        responseObject.confirmationMessage = confirmationMsg
      } else {
        responseObject.confirmationMessage = `❌ I encountered an issue: ${toolResult.error || "Unable to process your request."}\n\nPlease try again or provide different information.`
      }
      
      res.json(responseObject)
    } else {
      // NO TOOL EXECUTED - Use AI if available, otherwise fall back to a simple rule-based responder.
      if (!hasAnyKey()) {
        const fallback = generateRuleBasedReply(userAnswer, session)
        session.conversationHistory.push({
          role: "assistant",
          parts: [{ text: fallback }]
        })

        responseObject.nextQuestion = fallback
        responseObject.questionType = "rule_based"
        responseObject.aiGenerated = false
        
        // Check if we should suggest appointment (general mode only)
        const appointmentCheck = shouldSuggestAppointment(session, userAnswer)
        if (appointmentCheck.shouldSuggest) {
          console.log("💡 Suggesting appointment booking to user (no keys)")
          responseObject.suggestAppointment = true
        }
        
        return res.json(responseObject)
      }

      try {
        const systemPrompt = `You are CliniQ, a fast medical triage assistant. Be brief, direct, and conversational.

Patient said: "${userAnswer}"

Rules:
- ONE question only
- 1 sentence maximum
- Ask for: severity/duration OR location/intensity OR other symptoms
- Be warm but concise, skip pleasantries

Examples:
Patient: "I have a headache"
AI: "How long have you had it, and is it severe?"

Patient: "My chest hurts"
AI: "Where exactly and on a scale of 1-10, how bad?"

Generate your single follow-up question now:`;

        // Use Groq for reliable medical understanding
        const nextQuestion = await triageWithFallback(systemPrompt, userAnswer)
        
        if (nextQuestion?.aiReply && nextQuestion.aiReply.trim()) {
          const responseText = nextQuestion.aiReply.trim()
          console.log("✅ AI understood and responded:", responseText.slice(0, 80) + "...")
          
          // Store AI response in history
          session.conversationHistory.push({
            role: "assistant",
            parts: [{ text: responseText }]
          })

          // ════════════════════════════════════════════════════════════
          // FIRESTORE: Save AI response to conversations collection
          // ════════════════════════════════════════════════════════════
          try {
            await saveConversationEntry(sessionId, session.patientId || sessionId, "assistant", responseText, {
              messageType: "ai_response",
              questionType: nextQuestion.type || "follow_up"
            });
            console.log("✅ AI response saved to Firestore");
          } catch (error) {
            console.warn("⚠️ Failed to save AI response to Firestore:", error.message);
          }
          
          responseObject.nextQuestion = responseText
          
          // Split into sequential responses for better responsiveness
          const sequentialResponses = splitIntoSequentialResponses(responseText)
          responseObject.nextQuestion = sequentialResponses[0]
          responseObject.followUpQuestion = sequentialResponses.length > 1 ? sequentialResponses[1] : null
          
          responseObject.questionType = "ai_generated"
          responseObject.aiGenerated = true
          
          // Check if we should suggest appointment (general mode only)
          const appointmentCheck = shouldSuggestAppointment(session, userAnswer)
          if (appointmentCheck.shouldSuggest) {
            console.log("💡 Suggesting appointment booking to user")
            responseObject.suggestAppointment = true
          }
          
          res.json(responseObject)
        } else {
          console.warn("⚠️ AI returned empty response")
          const fallback = generateRuleBasedReply(userAnswer, session)
          session.conversationHistory.push({
            role: "assistant",
            parts: [{ text: fallback }]
          })

          // ════════════════════════════════════════════════════════════
          // FIRESTORE: Save fallback response to conversations collection
          // ════════════════════════════════════════════════════════════
          try {
            await saveConversationEntry(sessionId, session.patientId || sessionId, "assistant", fallback, {
              messageType: "fallback_response",
              reason: "empty_ai_response"
            });
            console.log("✅ Fallback response saved to Firestore");
          } catch (error) {
            console.warn("⚠️ Failed to save fallback response to Firestore:", error.message);
          }

          responseObject.nextQuestion = fallback
          responseObject.questionType = "rule_based"
          responseObject.aiGenerated = false
          
          // Check if we should suggest appointment (general mode only)
          const appointmentCheck = shouldSuggestAppointment(session, userAnswer)
          if (appointmentCheck.shouldSuggest) {
            console.log("💡 Suggesting appointment booking to user (rule-based)")
            responseObject.suggestAppointment = true
          }
          
          res.json(responseObject)
        }
      } catch (error) {
        console.error("❌ AI generation error:", error.message)
        const fallback = generateRuleBasedReply(userAnswer, session)
        session.conversationHistory.push({
          role: "assistant",
          parts: [{ text: fallback }]
        })
        responseObject.nextQuestion = fallback
        responseObject.questionType = "rule_based"
        responseObject.aiGenerated = false
        responseObject.error = error.message
        
        // Check if we should suggest appointment (general mode only)
        const appointmentCheckErr = shouldSuggestAppointment(session, userAnswer)
        if (appointmentCheckErr.shouldSuggest) {
          console.log("💡 Suggesting appointment booking to user (error fallback)")
          responseObject.suggestAppointment = true
        }
        
        // Return success so the frontend can display the message without showing a network error
        res.json(responseObject)
      }
    }
  } catch (error) {
    console.error("Error processing answer:", error)
    const fallback = "Something went wrong on our side. Please try again in a moment."
    res.json({
      success: true,
      answer: "",
      sessionId,
      toolExecuted: false,
      nextQuestion: fallback,
      questionType: "error_fallback",
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

/* ── Helper: Extract date from natural language ── */
function extractDate(text) {
  const lowerText = text.toLowerCase()

  // Direct date formats
  const datePatterns = [
    /(\d{1,2})\s*[\/-]\s*(\d{1,2})\s*[\/-]\s*(\d{2,4})/,  // MM/DD/YYYY or DD-MM-YYYY (with optional spaces)
    /(\d{4})\s*[\/-]\s*(\d{2})\s*[\/-]\s*(\d{2})/           // YYYY-MM-DD (with optional spaces)
  ]

  for (const pattern of datePatterns) {
    const match = text.match(pattern)
    if (match) {
      let year, month, day

      // Determine whether the first capture group is a 4-digit year (YYYY-MM-DD) or month (MM-DD-YYYY)
      if (match[1].length === 4) {
        // YYYY-MM-DD format
        year = parseInt(match[1])
        month = parseInt(match[2]) - 1 // JS months are 0-based
        day = parseInt(match[3])
      } else {
        // MM/DD/YYYY or MM-DD-YYYY format
        month = parseInt(match[1]) - 1
        day = parseInt(match[2])
        year = parseInt(match[3])
        if (year < 100) year += 2000 // Convert 2-digit year
      }

      const date = new Date(year, month, day)
      if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      }
    }
  }

  // Relative dates
  const today = new Date()
  const formatLocalDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  if (lowerText.includes('tomorrow')) {
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    return formatLocalDate(tomorrow)
  }

  if (lowerText.includes('today')) {
    return formatLocalDate(today)
  }

  if (lowerText.includes('next monday') || lowerText.includes('monday')) {
    const nextMonday = new Date(today)
    const daysUntilMonday = (1 - today.getDay() + 7) % 7 || 7
    nextMonday.setDate(today.getDate() + daysUntilMonday)
    return formatLocalDate(nextMonday)
  }

  if (lowerText.includes('next tuesday') || lowerText.includes('tuesday')) {
    const nextTuesday = new Date(today)
    const daysUntilTuesday = (2 - today.getDay() + 7) % 7 || 7
    nextTuesday.setDate(today.getDate() + daysUntilTuesday)
    return formatLocalDate(nextTuesday)
  }

  if (lowerText.includes('next wednesday') || lowerText.includes('wednesday')) {
    const nextWednesday = new Date(today)
    const daysUntilWednesday = (3 - today.getDay() + 7) % 7 || 7
    nextWednesday.setDate(today.getDate() + daysUntilWednesday)
    return formatLocalDate(nextWednesday)
  }

  if (lowerText.includes('next thursday') || lowerText.includes('thursday')) {
    const nextThursday = new Date(today)
    const daysUntilThursday = (4 - today.getDay() + 7) % 7 || 7
    nextThursday.setDate(today.getDate() + daysUntilThursday)
    return formatLocalDate(nextThursday)
  }

  if (lowerText.includes('next friday') || lowerText.includes('friday')) {
    const nextFriday = new Date(today)
    const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7
    nextFriday.setDate(today.getDate() + daysUntilFriday)
    return formatLocalDate(nextFriday)
  }

  // Day after tomorrow
  if (lowerText.includes('day after tomorrow')) {
    const dayAfterTomorrow = new Date(today)
    dayAfterTomorrow.setDate(today.getDate() + 2)
    return dayAfterTomorrow.toISOString().split('T')[0]
  }

  return null
}

/* ── Helper: Extract time from natural language ── */
function extractTime(text) {
  const lowerText = text.toLowerCase()

  // Direct time formats
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm)?/i,
    /(\d{1,2})\s*(am|pm)/i,
    /(\d{1,2})\s*o'clock\s*(am|pm)?/i
  ]

  for (const pattern of timePatterns) {
    const match = text.match(pattern)
    if (match) {
      let hour = parseInt(match[1])
      let minute = 0
      let ampm = null

      // Handle different capture groups based on pattern
      if (pattern.source.includes(':')) {
        // Pattern with colon: hour:minute am/pm
        minute = match[2] ? parseInt(match[2]) : 0
        ampm = match[3] ? match[3].toLowerCase() : null
      } else {
        // Pattern without colon: hour am/pm
        ampm = match[2] ? match[2].toLowerCase() : null
      }

      // Convert to 24-hour format
      if (ampm === 'pm' && hour !== 12) {
        hour += 12
      } else if (ampm === 'am' && hour === 12) {
        hour = 0
      }

      // Validate hour range
      if (hour >= 9 && hour <= 16) { // Clinic hours: 9 AM - 4 PM
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      }
    }
  }

  // Common time expressions
  const timeMappings = {
    'morning': '09:00',
    '9 am': '09:00',
    '9am': '09:00',
    '10 am': '10:00',
    '10am': '10:00',
    '11 am': '11:00',
    '11am': '11:00',
    'noon': '12:00',
    '12 pm': '12:00',
    '12pm': '12:00',
    '1 pm': '13:00',
    '1pm': '13:00',
    '2 pm': '14:00',
    '2pm': '14:00',
    '3 pm': '15:00',
    '3pm': '15:00',
    '4 pm': '16:00',
    '4pm': '16:00',
    'afternoon': '14:00',
    'early morning': '09:00',
    'late morning': '11:00',
    'early afternoon': '13:00',
    'late afternoon': '15:00'
  }

  for (const [phrase, time] of Object.entries(timeMappings)) {
    if (lowerText.includes(phrase)) {
      return time
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
      contactNumber: "102",
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
          emergency_line: "102"
        }
      }
    }
    
    case "escalate_to_emergency": {
      const { reason } = params
      return {
        success: true,
        message: `Emergency escalation initiated. Reason: ${reason}`,
        emergency_number: "102",
        instruction: "Please call 102 (Ambulance) immediately for emergency medical assistance."
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
7. For emergencies, immediately recommend calling 102 (Ambulance)

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

/* ─────────────── AI Helper Functions ─────────────── */

/**
 * Call Ollama API with medical triage prompt
 */
async function callOllama(systemPrompt, userMessage) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT);

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        stream: true,
        temperature: 0.2,
        num_predict: 150
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    // Handle streaming responses efficiently
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let aiReply = "";
    let buffer = "";
    let firstChunk = true;
    const startTime = Date.now();
    const maxStreamTime = 8000; // 8 seconds max for streaming

    while (true) {
      // Timeout check for streaming
      if (Date.now() - startTime > maxStreamTime) {
        console.warn("⚠️ Streaming timeout, returning partial response");
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim()) {
          try {
            const json = JSON.parse(line);
            if (json.message?.content) {
              aiReply += json.message.content;
              // Log first chunk arrival for responsiveness feedback
              if (firstChunk) {
                console.log("✅ First response chunk received (fast)");
                firstChunk = false;
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    if (!aiReply.trim()) {
      throw new Error("No response content from Ollama");
    }

    return aiReply.trim();
  } catch (error) {
    console.error("Ollama error:", error.message);
    throw error;
  }
}

/**
 * Medical triage with Groq (primary) and Ollama (fallback)
 */
async function triageWithFallback(systemPrompt, userMessage) {
  let groqError = null;

  // Try Groq first if available
  if (groq) {
    try {
      console.log("📡 Attempting Groq API...");
      const completion = await groq.chat.completions.create({
        model: "llama3-70b-8192",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: 0.2,
        max_tokens: 200
      });

      const aiReply = completion.choices[0]?.message?.content;
      if (!aiReply) {
        throw new Error("No response from Groq");
      }

      console.log("✅ Groq API successful");
      return { aiReply, provider: "groq" };
    } catch (error) {
      groqError = error;
      console.warn("⚠️  Groq failed:", error.message);
    }
  } else {
    console.log("⏭️  Groq not configured, skipping to Ollama...");
  }

  // Fallback to Ollama
  try {
    console.log("📡 Attempting Ollama API...");
    const aiReply = await callOllama(systemPrompt, userMessage);
    console.log("✅ Ollama fallback successful");
    return { aiReply, provider: "ollama" };
  } catch (ollamaError) {
    console.error("❌ Both Groq and Ollama failed");
    const errors = groqError ? `Groq: ${groqError.message}, ` : "";
    throw new Error(
      `AI services unavailable. ${errors}Ollama: ${ollamaError.message}`
    );
  }
}

/* ── Medical Triage AI Assistant ── */
app.post("/ai", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'text' field in request body" });
    }

    console.log("🔍 Searching database for related symptoms...");
    
    // STEP 1: Search database for related cases
    const medicalHistory = await getMedicalHistory(text);
    const dbSearchResults = {
      foundRelated: medicalHistory.recentCases.length > 0,
      recentCases: medicalHistory.recentCases.map(c => ({
        symptoms: c.symptoms,
        urgencyLevel: c.urgencyLevel,
        recommendedAction: c.recommendedAction,
        createdAt: c.timestamp
      })),
      commonUrgencies: medicalHistory.commonUrgencies,
      recommendations: medicalHistory.recommendations
    };

    console.log("✅ Database search completed. Found", dbSearchResults.recentCases.length, "related cases");

    // STEP 2: Build AI prompt with database context
    let enhancedSystemPrompt = `You are a medical triage assistant for CliniQ healthcare platform. Your role is to:
1. Analyze patient symptoms and provide urgency classification
2. Recommend immediate actions based on symptom severity
3. Provide general medical guidance (NOT medical diagnosis)

URGENCY LEVELS:
- EMERGENCY: Life-threatening symptoms requiring immediate emergency services (102/nearest hospital)
- HIGH: Severe symptoms requiring same-day medical attention
- MEDIUM: Moderate symptoms requiring appointment within 24-72 hours
- LOW: Mild symptoms that can be managed at home or routine check-up

RELEVANT DATABASE INFORMATION (for context):`;

    if (dbSearchResults.recentCases.length > 0) {
      enhancedSystemPrompt += `\nSimilar cases in system: ${dbSearchResults.recentCases.length}`;
      dbSearchResults.recentCases.forEach((c, i) => {
        enhancedSystemPrompt += `\n${i + 1}. Urgency: ${c.urgencyLevel}, Action: ${c.recommendedAction}`;
      });
    }

    if (Object.keys(dbSearchResults.commonUrgencies).length > 0) {
      enhancedSystemPrompt += `\nCommon urgency classifications for similar symptoms: ${JSON.stringify(dbSearchResults.commonUrgencies)}`;
    }

    enhancedSystemPrompt += `

RESPONSE FORMAT:
You MUST respond with valid JSON only (no markdown, no extra text):
{
  "urgencyLevel": "LOW|MEDIUM|HIGH|EMERGENCY",
  "recommendedAction": "Brief recommended action",
  "aiResponse": "Helpful medical guidance based on symptoms"
}

SAFETY RULES:
- Do NOT provide specific medication dosages
- Do NOT attempt to diagnose
- Do NOT replace professional medical advice
- If emergency symptoms detected, set urgencyLevel to EMERGENCY`;

    // STEP 3: Get AI response (with database context)
    const { aiReply, provider } = await triageWithFallback(enhancedSystemPrompt, text);

    if (!aiReply) {
      return res.status(500).json({ error: "Failed to generate AI response" });
    }

    // Parse JSON response safely
    let triageData;
    try {
      triageData = JSON.parse(aiReply);
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiReply);
      return res.status(500).json({ error: "Invalid response format from AI model" });
    }

    // Validate required fields
    const { urgencyLevel, recommendedAction, aiResponse } = triageData;

    if (!urgencyLevel || !recommendedAction || !aiResponse) {
      return res.status(500).json({ error: "Incomplete response data from AI model" });
    }

    // Validate urgency level
    const validUrgencyLevels = ["LOW", "MEDIUM", "HIGH", "EMERGENCY"];
    if (!validUrgencyLevels.includes(urgencyLevel)) {
      return res.status(500).json({ error: "Invalid urgency level from AI model" });
    }

    // Save to Firestore + Local CSV
    console.log("💾 Attempting to save patient data to Firestore and CSV...");
    console.log("📊 Patient Data:", { text, urgencyLevel, recommendedAction });
    
    let patientId;
    try {
      // Save to Firestore
      patientId = await savePatient(text, aiResponse, urgencyLevel, recommendedAction);
      console.log("✅ Patient data saved to Firestore with ID:", patientId);
      
      // Also save to local CSV
      await savePatientToCSV(text, aiResponse, urgencyLevel, recommendedAction);
    } catch (dbError) {
      console.error("❌ SAVE ERROR:", dbError.message);
      console.error("❌ Error code:", dbError.code);
      console.error("❌ Full error:", dbError);
      throw dbError;
    }

    // Return structured response with database search results
    res.json({
      response: aiResponse,
      urgencyLevel: urgencyLevel,
      recommendedAction: recommendedAction,
      patientId: patientId,
      aiProvider: provider,
      databaseSearch: {
        searchPerformed: true,
        relatedCasesFound: dbSearchResults.foundRelated,
        casesCount: dbSearchResults.recentCases.length,
        recentCases: dbSearchResults.recentCases,
        commonUrgencies: dbSearchResults.commonUrgencies
      }
    });

  } catch (error) {
    console.error("Error in /ai route:", error);
    res.status(500).json({ error: "Medical triage service unavailable" });
  }
});

/* ─────────────── AI-Based Appointment Booking ─────────────── */

/**
 * Appointment extraction prompt for AI
 */
const APPOINTMENT_EXTRACTION_PROMPT = `You are an expert medical appointment assistant. Your job is to:
1. Extract appointment details from user messages
2. Keep track of previously mentioned information
3. When user says "change" or "update", modify the existing data without asking for confirmation

APPOINTMENT FIELDS TO EXTRACT:
- patientName: Full name of patient
- phoneNumber: Contact phone (required)
- email: Email address (optional)
- doctorSpecialization: Medical specialty (e.g., Cardiology, General Practice)
- preferredDate: Date in YYYY-MM-DD format
- preferredTime: Time in HH:MM format (24-hour)
- reasonForVisit: Why they're visiting
- ageGroup: Age category (e.g., 18-30, 31-45, 46-60, 60+)

RESPONSE FORMAT (Valid JSON only):
{
  "understood": true,
  "extractedData": {
    "patientName": "value or null",
    "phoneNumber": "value or null",
    "email": "value or null",
    "doctorSpecialization": "value or null",
    "preferredDate": "value or null",
    "preferredTime": "value or null",
    "reasonForVisit": "value or null",
    "ageGroup": "value or null"
  },
  "missingFields": ["field1", "field2"],
  "assistantMessage": "Natural language response to user",
  "appointmentReady": false,
  "changeDetected": false
}

IMPORTANT RULES:
- Return VALID JSON only (no markdown)
- If user says "change [field] to [value]", update that field and set changeDetected to true
- appointmentReady = true ONLY when all required fields are present (patientName, phoneNumber, doctorSpecialization, preferredDate, preferredTime, reasonForVisit)
- Always be conversational and friendly
- If updating, acknowledge the change in assistantMessage`;

const VOICE_ASSESSMENT_PROMPT = `You are a medical appointment management assistant. Your job is to:
1. Help patients review, reschedule, or cancel existing appointments
2. Always confirm patient identity by asking for their name
3. Show appointment details clearly
4. Make changes only after name confirmation
5. Handle requests to change time, date, add notes, or cancel

CURRENT PATIENT APPOINTMENT DATA:
[APPOINTMENT_DATA_PLACEHOLDER]

RESPONSE FORMAT (Valid JSON only):
{
  "action": "view|reschedule|cancel|add_notes|confirm_identity",
  "confirmationNeeded": true|false,
  "confirmedPatientName": "name or null",
  "requestedChange": {
    "type": "time|date|notes|cancel",
    "oldValue": "current value",
    "newValue": "requested value"
  },
  "assistantMessage": "Natural language response to user",
  "updateReady": false
}

IMPORTANT RULES:
- Return VALID JSON only (no markdown)
- ALWAYS ask "Can you confirm your name?" before making ANY changes
- If user says "change time to [time]", set action to "reschedule" and requestedChange.type to "time"
- If user says "cancel appointment", ask for confirmation first
- Only set updateReady: true after name is confirmed
- Be empathetic and professional
- Never make assumptions about changes without explicit confirmation`;

app.post("/book-appointment", async (req, res) => {
  try {
    const { userMessage, userIdentifier, previousAppointmentData } = req.body;

    if (!userMessage || typeof userMessage !== "string") {
      return res.status(400).json({ error: "Missing 'userMessage' field" });
    }

    if (!userIdentifier || typeof userIdentifier !== "string") {
      return res.status(400).json({ error: "Missing 'userIdentifier' (phone or email)" });
    }

    console.log("🔍 Searching database for existing appointments...");

    // STEP 1: Search database for existing appointments
    const existingAppointments = await searchAppointments(userIdentifier);
    
    console.log("✅ Database search completed. Found", existingAppointments.length, "existing appointments");

    // Get user profile and latest appointment
    const userProfile = await getUserProfile(userIdentifier);
    const latestAppointment = await getLatestAppointment(userProfile.userId);

    // Prepare database search results
    const dbSearchResults = {
      searchPerformed: true,
      appointmentsFound: existingAppointments.length,
      foundAppointments: existingAppointments.map(apt => ({
        patientName: apt.patientName,
        date: apt.preferredDate,
        time: apt.preferredTime,
        doctor: apt.doctorSpecialization,
        reason: apt.reasonForVisit,
        status: apt.status,
        createdAt: apt.createdAt
      }))
    };

    // STEP 2: Build context for AI with database search results
    let contextMessage = userMessage;
    if (latestAppointment) {
      contextMessage = `[PREVIOUS APPOINTMENT DATA]: ${JSON.stringify(latestAppointment)}
[DATABASE SEARCH FOUND]: ${existingAppointments.length} existing appointment(s)
[EXISTING APPOINTMENTS]: ${existingAppointments.map(a => `${a.patientName} on ${a.preferredDate} at ${a.preferredTime}`).join(", ")}

[USER NEW MESSAGE]: ${userMessage}`;
    } else if (existingAppointments.length > 0) {
      contextMessage = `[DATABASE SEARCH FOUND]: ${existingAppointments.length} existing appointment(s) for this identifier
[EXISTING APPOINTMENTS]: ${existingAppointments.map(a => `${a.patientName} on ${a.preferredDate} at ${a.preferredTime}`).join(", ")}

[USER NEW MESSAGE]: ${userMessage}`;
    }

    // STEP 3: Use AI with Groq (primary) or Ollama (fallback) to extract appointment details
    const { aiReply, provider } = await triageWithFallback(
      APPOINTMENT_EXTRACTION_PROMPT,
      contextMessage
    );

    // Parse JSON response
    let appointmentExtraction;
    try {
      appointmentExtraction = JSON.parse(aiReply);
    } catch (parseError) {
      console.error("Failed to parse appointment extraction:", aiReply);
      return res.status(500).json({ error: "Failed to parse AI response", databaseSearch: dbSearchResults });
    }

    // Validate extraction
    if (!appointmentExtraction.understood) {
      return res.status(400).json({
        error: "Could not understand appointment request",
        assistantMessage: appointmentExtraction.assistantMessage,
        databaseSearch: dbSearchResults
      });
    }

    // Save conversation entry
    try {
      await addConversationEntry(
        userProfile.userId,
        "user",
        userMessage,
        appointmentExtraction.extractedData
      );
      // Also save to CSV
      await saveConversationToCSV(
        userProfile.userId,
        "user",
        userMessage,
        appointmentExtraction.extractedData
      );
    } catch (err) {
      console.error("⚠️ Failed to save conversation:", err.message);
      // Continue - this is not critical
    }

    // If change was detected and we have previous data, update it
    if (appointmentExtraction.changeDetected && latestAppointment) {
      const updatedAppointment = {
        ...latestAppointment,
        ...appointmentExtraction.extractedData,
        conversationSummary: appointmentExtraction.assistantMessage
      };

      // Remove null values to keep previous data
      Object.keys(updatedAppointment).forEach(key => {
        if (updatedAppointment[key] === null) {
          delete updatedAppointment[key];
        }
      });

      const appointmentIndex = userProfile.appointments.length - 1;
      await updateAppointment(userProfile.userId, appointmentIndex, updatedAppointment);

      try {
        await addConversationEntry(
          userProfile.userId,
          "assistant",
          appointmentExtraction.assistantMessage,
          updatedAppointment
        );
        // Also save to CSV
        await saveConversationToCSV(
          userProfile.userId,
          "assistant",
          appointmentExtraction.assistantMessage,
          updatedAppointment
        );
      } catch (err) {
        console.error("⚠️ Failed to save conversation:", err.message);
      }

      return res.json({
        success: true,
        status: "updated",
        message: "Appointment updated successfully",
        appointment: updatedAppointment,
        assistantMessage: appointmentExtraction.assistantMessage,
        missingFields: appointmentExtraction.missingFields,
        databaseSearch: dbSearchResults,
        aiProvider: provider
      });
    }

    // If appointment is ready, save it
    if (appointmentExtraction.appointmentReady) {
      const completeAppointment = {
        ...appointmentExtraction.extractedData,
        conversationSummary: appointmentExtraction.assistantMessage
      };

      console.log("💾 Attempting to save appointment to Firestore and CSV...");
      console.log("📅 Appointment Data:", completeAppointment);
      
      try {
        // Save to Firestore
        await saveAppointment(userProfile.userId, completeAppointment);
        console.log("✅ Appointment saved to Firestore for user:", userProfile.userId);
        
        // Also save to local CSV with bookingMethod="ai"
        await saveAppointmentToCSV(userProfile.userId, completeAppointment, "ai");
      } catch (dbError) {
        console.error("❌ FIRESTORE APPOINTMENT SAVE ERROR:", dbError.message);
        console.error("❌ Error code:", dbError.code);
        console.error("❌ Full error:", dbError);
        throw dbError;
      }

      try {
        await addConversationEntry(
          userProfile.userId,
          "assistant",
          appointmentExtraction.assistantMessage,
          completeAppointment
        );
        // Also save to CSV
        await saveConversationToCSV(
          userProfile.userId,
          "assistant",
          appointmentExtraction.assistantMessage,
          completeAppointment
        );
        console.log("✅ Conversation entry saved to Firestore and CSV");
      } catch (dbError) {
        console.error("❌ CONVERSATION SAVE ERROR:", dbError.message);
        // Don't throw here - conversation entry is less critical than appointment save
      }

      return res.json({
        success: true,
        status: "completed",
        message: "Appointment booked successfully!",
        appointment: completeAppointment,
        assistantMessage: appointmentExtraction.assistantMessage,
        databaseSearch: dbSearchResults,
        aiProvider: provider
      });
    }

    // If still missing fields, ask for them
    try {
      await addConversationEntry(
        userProfile.userId,
        "assistant",
        appointmentExtraction.assistantMessage,
        appointmentExtraction.extractedData
      );
      // Also save to CSV
      await saveConversationToCSV(
        userProfile.userId,
        "assistant",
        appointmentExtraction.assistantMessage,
        appointmentExtraction.extractedData
      );
      console.log("✅ Conversation entry saved to Firestore and CSV");
    } catch (dbError) {
      console.error("⚠️ CONVERSATION SAVE ERROR:", dbError.message);
      // Don't throw here - conversation entry is less critical
    }

    return res.json({
      success: true,
      status: "in-progress",
      message: "Appointment booking in progress",
      extractedData: appointmentExtraction.extractedData,
      missingFields: appointmentExtraction.missingFields,
      assistantMessage: appointmentExtraction.assistantMessage,
      appointmentReady: false,
      databaseSearch: dbSearchResults,
      aiProvider: provider
    });

  } catch (error) {
    console.error("Error in /book-appointment:", error);
    res.status(500).json({ error: "Appointment booking failed", details: error.message });
  }
});

/* ─────────────── Get User Appointments ─────────────── */
app.get("/appointments/:userIdentifier", async (req, res) => {
  try {
    const { userIdentifier } = req.params;

    if (!userIdentifier) {
      return res.status(400).json({ error: "Missing userIdentifier" });
    }

    const userProfile = await getUserProfile(userIdentifier);

    res.json({
      success: true,
      userId: userProfile.userId,
      appointments: userProfile.appointments || [],
      conversationHistory: userProfile.conversationHistory || []
    });

  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

/* ─────────────── Voice Assessment Portal (Integrated Appointment Management) ─────────────── */
app.post("/ai/assessment", async (req, res) => {
  try {
    const { userMessage, phoneNumber, conversationState } = req.body;

    if (!userMessage || typeof userMessage !== "string") {
      return res.status(400).json({ error: "Missing 'userMessage' field" });
    }

    if (!phoneNumber || typeof phoneNumber !== "string") {
      return res.status(400).json({ error: "Missing 'phoneNumber' for appointment lookup" });
    }

    console.log("🔍 Searching database for appointments matching:", phoneNumber);

    // STEP 1: Search database for appointments
    const dbAppointments = await searchAppointments(phoneNumber);
    const userProfile = await getUserProfile(phoneNumber);
    const userAppointments = await getAllAppointments(userProfile.userId);

    console.log("✅ Database search completed. Found", userAppointments.length, "appointments");

    if (userAppointments.length === 0) {
      return res.json({
        success: true,
        action: "no_appointments",
        assistantMessage: "No appointments found for this phone number. Would you like to book a new appointment?",
        appointments: [],
        databaseSearch: {
          searchPerformed: true,
          appointmentsFound: 0,
          foundAppointments: []
        }
      });
    }

    // STEP 2: Format appointment data with search results
    const appointmentsList = userAppointments.map((apt, idx) => 
      `Appointment ${idx + 1}: ${apt.patientName} on ${apt.preferredDate} at ${apt.preferredTime} with Dr. (${apt.doctorSpecialization}) - Reason: ${apt.reasonForVisit}`
    ).join("\n");

    // Prepare database search results
    const dbSearchResults = {
      searchPerformed: true,
      appointmentsFound: userAppointments.length,
      foundAppointments: userAppointments.map(apt => ({
        patientName: apt.patientName,
        date: apt.preferredDate,
        time: apt.preferredTime,
        doctor: apt.doctorSpecialization,
        reason: apt.reasonForVisit,
        status: apt.status
      }))
    };

    const contextMessage = `PATIENT PHONE: ${phoneNumber}
EXISTING APPOINTMENTS IN DATABASE:
${appointmentsList}

[PATIENT REQUEST]: ${userMessage}`;

    // STEP 3: Use AI to understand request (with database context)
    const systemPrompt = VOICE_ASSESSMENT_PROMPT.replace("[APPOINTMENT_DATA_PLACEHOLDER]", appointmentsList);
    const { aiReply, provider } = await triageWithFallback(systemPrompt, contextMessage);

    // Parse AI response
    let assessmentData;
    try {
      assessmentData = JSON.parse(aiReply);
    } catch (parseError) {
      console.error("Failed to parse assessment response:", aiReply);
      return res.status(500).json({ error: "Failed to process request" });
    }

    // Step 1: If action is to view appointments, confirm identity first
    if (!conversationState?.identityConfirmed && assessmentData.confirmationNeeded) {
      return res.json({
        success: true,
        action: "confirm_identity",
        stage: "request_name_confirmation",
        assistantMessage: "Can you please confirm your full name?",
        appointments: userAppointments,
        databaseSearch: dbSearchResults,
        aiProvider: provider
      });
    }

    // Step 2: Process identity confirmation
    if (conversationState?.awaitingNameConfirmation && !conversationState?.identityConfirmed) {
      const confirmedName = userMessage.trim();
      
      // Check if the name matches any appointment
      const matchingAppointment = userAppointments.find(apt => 
        apt.patientName.toLowerCase().includes(confirmedName.toLowerCase()) || 
        confirmedName.toLowerCase().includes(apt.patientName.toLowerCase())
      );

      if (!matchingAppointment) {
        return res.json({
          success: true,
          action: "identity_not_matched",
          assistantMessage: `I couldn't find an appointment under the name "${confirmedName}". Please verify your name or check your phone number.`,
          appointments: userAppointments,
          databaseSearch: dbSearchResults,
          aiProvider: provider
        });
      }

      // Identity confirmed, proceed with appointment management
      assessmentData.confirmedPatientName = confirmedName;
    }

    // Step 3: Handle appointment updates (reschedule, cancel, add notes)
    if (assessmentData.action === "reschedule" || assessmentData.action === "cancel" || assessmentData.action === "add_notes") {
      if (!assessmentData.confirmedPatientName) {
        assessmentData.confirmedPatientName = conversationState?.confirmedPatientName;
      }

      if (!assessmentData.confirmedPatientName) {
        return res.json({
          success: true,
          action: "confirmation_required",
          stage: "awaiting_name",
          assistantMessage: "To make changes to your appointment, I need to confirm your identity. What's your full name?",
          requestedChange: assessmentData.requestedChange,
          databaseSearch: dbSearchResults,
          aiProvider: provider
        });
      }

      // Update appointment after confirmation
      try {
        const updatePayload = {};
        
        if (assessmentData.requestedChange.type === "time") {
          updatePayload.preferredTime = assessmentData.requestedChange.newValue;
        } else if (assessmentData.requestedChange.type === "date") {
          updatePayload.preferredDate = assessmentData.requestedChange.newValue;
        } else if (assessmentData.requestedChange.type === "notes") {
          updatePayload.appointmentNotes = assessmentData.requestedChange.newValue;
        } else if (assessmentData.requestedChange.type === "cancel") {
          updatePayload.status = "cancelled";
        }

        const result = await updateAppointmentByName(userProfile.userId, assessmentData.confirmedPatientName, updatePayload);

        const confirmationMessage = `✅ Your appointment has been updated! 
${assessmentData.requestedChange.type === "time" ? `Time changed from ${assessmentData.requestedChange.oldValue} to ${assessmentData.requestedChange.newValue}` : ""}
${assessmentData.requestedChange.type === "date" ? `Date changed to ${assessmentData.requestedChange.newValue}` : ""}
${assessmentData.requestedChange.type === "cancel" ? "Your appointment has been cancelled" : ""}`;

        try {
          await addConversationEntry(userProfile.userId, "assistant", confirmationMessage);
          // Also save to CSV
          await saveConversationToCSV(userProfile.userId, "assistant", confirmationMessage);
        } catch (err) {
          console.error("⚠️ Failed to save conversation:", err.message);
        }

        return res.json({
          success: true,
          action: "appointment_updated",
          assistantMessage: confirmationMessage,
          updatedAppointment: result.foundAppointment,
          confirmedPatientName: assessmentData.confirmedPatientName,
          databaseSearch: dbSearchResults,
          aiProvider: provider
        });
      } catch (updateError) {
        return res.json({
          success: false,
          action: "update_failed",
          assistantMessage: `Could not update appointment: ${updateError.message}`,
          databaseSearch: dbSearchResults,
          aiProvider: provider
        });
      }
    }

    // Step 4: View appointments
    if (assessmentData.action === "view") {
      const appointmentSummary = userAppointments.map((apt, idx) => `
${idx + 1}. Date: ${apt.preferredDate}
   Time: ${apt.preferredTime}
   Doctor: ${apt.doctorSpecialization}
   Reason: ${apt.reasonForVisit}
   Status: ${apt.status}`).join("\n");

      return res.json({
        success: true,
        action: "view_appointments",
        assistantMessage: `You have ${userAppointments.length} appointment(s):\n${appointmentSummary}`,
        appointments: userAppointments,
        databaseSearch: dbSearchResults,
        aiProvider: provider
      });
    }

    // Save conversation entry
    try {
      await addConversationEntry(userProfile.userId, "user", userMessage);
      // Also save to CSV
      await saveConversationToCSV(userProfile.userId, "user", userMessage);
    } catch (err) {
      console.error("⚠️ Failed to save conversation:", err.message);
    }

    res.json({
      success: true,
      action: assessmentData.action,
      assistantMessage: assessmentData.assistantMessage,
      appointments: userAppointments,
      databaseSearch: dbSearchResults,
      aiProvider: provider
    });

  } catch (error) {
    console.error("Error in /ai/assessment:", error);
    res.status(500).json({ error: "Assessment service failed", details: error.message });
  }
});

/* ─────────────── Local CSV Data Endpoints ─────────────── */

/**
 * Get all appointments with booking method (AI or Form)
 */
app.get("/appointments/all", async (req, res) => {
  try {
    const { userIdentifier } = req.query;

    console.log("📋 Fetching all appointments with booking methods...");
    
    if (userIdentifier) {
      // Get appointments for specific user
      const csvAppointments = await getAllAppointmentsFromCSV();
      const userAppointments = csvAppointments.filter(apt => 
        apt.phoneNumber.includes(userIdentifier) || 
        apt.userId.includes(userIdentifier)
      );

      return res.json({
        success: true,
        filter: `For identifier: ${userIdentifier}`,
        count: userAppointments.length,
        appointments: userAppointments.map(apt => ({
          id: apt.id,
          patientName: apt.patientName,
          phoneNumber: apt.phoneNumber,
          date: apt.preferredDate,
          time: apt.preferredTime,
          doctor: apt.doctorSpecialization,
          reason: apt.reasonForVisit,
          status: apt.status,
          bookingMethod: apt.bookingMethod || "form", // "ai" or "form"
          createdAt: apt.createdAt,
          updatedAt: apt.updatedAt
        }))
      });
    } else {
      // Get all appointments
      const csvAppointments = await getAllAppointmentsFromCSV();

      return res.json({
        success: true,
        count: csvAppointments.length,
        summary: {
          aiBooked: csvAppointments.filter(a => a.bookingMethod === "ai").length,
          formBooked: csvAppointments.filter(a => a.bookingMethod === "form").length
        },
        appointments: csvAppointments.map(apt => ({
          id: apt.id,
          patientName: apt.patientName,
          phoneNumber: apt.phoneNumber,
          date: apt.preferredDate,
          time: apt.preferredTime,
          doctor: apt.doctorSpecialization,
          reason: apt.reasonForVisit,
          status: apt.status,
          bookingMethod: apt.bookingMethod || "form", // "ai" or "form"
          createdAt: apt.createdAt,
          updatedAt: apt.updatedAt
        }))
      });
    }
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({ error: "Failed to fetch appointments", details: error.message });
  }
});

/**
 * Compare patient symptoms against stored CSV data
 */
app.post("/compare-patient-data", async (req, res) => {
  try {
    const { symptoms } = req.body;

    if (!symptoms || typeof symptoms !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'symptoms' field" });
    }

    console.log("🔍 Comparing patient symptoms against CSV data...");
    const comparison = await comparePatientData(symptoms);

    res.json({
      success: true,
      comparison,
      message: comparison.foundSimilar
        ? `Found ${comparison.totalMatches} similar cases in local database`
        : "No similar cases found in local database"
    });
  } catch (error) {
    console.error("Error comparing patient data:", error);
    res.status(500).json({ error: "Comparison failed", details: error.message });
  }
});

/**
 * Compare appointment data against stored CSV
 */
app.post("/compare-appointment-data", async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber || typeof phoneNumber !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'phoneNumber' field" });
    }

    console.log("🔍 Comparing appointment data against CSV data...");
    const comparison = await compareAppointmentData(phoneNumber);

    res.json({
      success: true,
      comparison,
      message: comparison.foundExisting
        ? `Found ${comparison.totalCount} existing appointment(s) for this phone`
        : "No existing appointments found"
    });
  } catch (error) {
    console.error("Error comparing appointment data:", error);
    res.status(500).json({ error: "Comparison failed", details: error.message });
  }
});

/**
 * Get all patients from local CSV
 */
app.get("/csv/patients", async (req, res) => {
  try {
    console.log("📋 Fetching all patients from CSV...");
    const patients = await getAllPatientsFromCSV();

    res.json({
      success: true,
      count: patients.length,
      patients
    });
  } catch (error) {
    console.error("Error fetching patients:", error);
    res.status(500).json({ error: "Failed to fetch patients" });
  }
});

/**
 * Search patients in CSV by symptoms
 */
app.get("/csv/patients/search", async (req, res) => {
  try {
    const { symptoms } = req.query;

    if (!symptoms) {
      return res.status(400).json({ error: "Missing 'symptoms' query parameter" });
    }

    console.log("🔍 Searching patients in CSV by symptoms...");
    const results = await searchPatientsInCSV(symptoms);

    res.json({
      success: true,
      searchTerm: symptoms,
      count: results.length,
      results
    });
  } catch (error) {
    console.error("Error searching patients:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

/**
 * Get all appointments from local CSV
 */
app.get("/csv/appointments", async (req, res) => {
  try {
    console.log("📋 Fetching all appointments from CSV...");
    const appointments = await getAllAppointmentsFromCSV();

    res.json({
      success: true,
      count: appointments.length,
      appointments
    });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

/**
 * Search appointments in CSV
 */
app.get("/csv/appointments/search", async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: "Missing 'query' parameter" });
    }

    console.log("🔍 Searching appointments in CSV...");
    const results = await searchAppointmentsInCSV(query);

    res.json({
      success: true,
      searchTerm: query,
      count: results.length,
      results
    });
  } catch (error) {
    console.error("Error searching appointments:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

/**
 * Get data statistics from CSV
 */
app.get("/csv/statistics", async (req, res) => {
  try {
    console.log("📊 Fetching data statistics from CSV...");
    const stats = await getDataStatistics();

    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

/**
 * Export all data as JSON
 */
app.get("/csv/export", async (req, res) => {
  try {
    console.log("💾 Exporting all data to JSON...");
    const exportPath = await exportDataAsJSON();

    res.json({
      success: true,
      message: "Data exported successfully",
      exportPath
    });
  } catch (error) {
    console.error("Error exporting data:", error);
    res.status(500).json({ error: "Export failed", details: error.message });
  }
});

/* ─────────────── Server Startup ─────────────── */
const PORT = Number(process.env.PORT) || 3001
app.listen(PORT, () => {
  console.log(`\n🏥 Virtual Clinic Medical Triage System`)
  console.log(`📡 Server running on port ${PORT}`)
  console.log(`\n  AI Services:`)
  console.log(`  Groq: ✅ enabled`)
  console.log(`  Ollama: ${OLLAMA_BASE_URL} (${OLLAMA_MODEL})`)
  console.log(`  Fallback Chain: Groq → Ollama\n`)
  console.log(`  Vertex AI: ${VERTEX_AI_KEY ? "✅ configured" : "❌ not set"}`)
  console.log(`  Gemini: ${GEMINI_KEY ? "✅ configured" : "❌ not set"}`)
  console.log(`  OpenAI: ${OPENAI_KEY ? "✅ configured" : "❌ not set"}\n`)
})