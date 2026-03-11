const express = require("express")
const cors = require("cors")
require("dotenv").config()

const { GoogleGenerativeAI } = require("@google/generative-ai")

const app = express()
app.use(cors())
app.use(express.json())

if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️ GEMINI_API_KEY not set. AI features will not work.")
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "missing")
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

// In-memory conversation state (resets on restart)
let conversationHistory = [
  {
    role: "user",
    parts: [
      {
        text:
          "You are an AI interviewer. Ask thoughtful, progressive interview questions. " +
          "Each next question should adapt to the candidate's previous answers. " +
          "Do NOT reveal or pre-plan a list of future questions. " +
          "Output only the next question text (no labels, no bullets), 1–2 sentences."
      }
    ]
  }
]
let currentTopic = "general"

const AVAILABLE_TOPICS = [
  { id: "behavioral", name: "Behavioral" },
  { id: "technical", name: "Technical" },
  { id: "leadership", name: "Leadership" },
  { id: "communication", name: "Communication" },
  { id: "product", name: "Product / PM" },
  { id: "systemDesign", name: "System Design" },
  { id: "hr", name: "HR / Culture Fit" }
]

function resetConversation(topicId) {
  currentTopic = topicId || "general"
  const topicLine =
    currentTopic === "general" ? "" : `The interview topic is: ${currentTopic}. `

  conversationHistory = [
    {
      role: "user",
      parts: [
        {
          text:
            "You are an AI interviewer. " +
            topicLine +
            "Ask thoughtful, progressive interview questions. " +
            "Each next question should adapt to the candidate's previous answers. " +
            "Do NOT reveal or pre-plan a list of future questions. " +
            "Avoid repeating questions. " +
            "Output only the next question text (no labels, no bullets), 1–2 sentences."
        }
      ]
    }
  ]
}

function ensureGeminiKey(res) {
  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({ success: false, error: "GEMINI_API_KEY not configured" })
    return false
  }
  return true
}

app.get("/", (req, res) => {
  res.send("Gemini AI Backend Running")
})

app.get("/health", (req, res) => {
  res.json({
    status: "Server is running",
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY
  })
})

app.get("/topics", (req, res) => {
  res.json({
    success: true,
    topics: AVAILABLE_TOPICS,
    timestamp: new Date().toISOString()
  })
})

app.post("/api/start-session", (req, res) => {
  try {
    const topic = req.body?.topic
    const valid = AVAILABLE_TOPICS.some((t) => t.id === topic)
    resetConversation(valid ? topic : "general")
    res.json({
      success: true,
      topic: currentTopic,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error in /api/start-session:", error)
    res.status(500).json({
      success: false,
      error: "Failed to start session",
      message: error.message
    })
  }
})

// Compatible with your frontend: fetch next question
app.get("/api/next-question", async (req, res) => {
  try {
    if (!ensureGeminiKey(res)) return

    const chat = model.startChat({ history: conversationHistory })
    const result = await chat.sendMessage("Ask the next interview question now.")
    const question = (result?.response?.text() || "").trim()

    if (!question) {
      return res.status(500).json({
        success: false,
        error: "Failed to generate question",
        message: "Empty response from model"
      })
    }

    conversationHistory = conversationHistory.concat([
      { role: "model", parts: [{ text: question }] }
    ])

    res.json({ success: true, question, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error("Error generating question:", error)
    res.status(500).json({
      success: false,
      error: "Failed to generate question",
      message: error.message
    })
  }
})

// Compatible with your frontend: record user's answer
app.post("/answer", (req, res) => {
  try {
    const userAnswer = req.body?.answer
    if (!userAnswer || typeof userAnswer !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid answer" })
    }

    conversationHistory = conversationHistory.concat([
      { role: "user", parts: [{ text: userAnswer }] }
    ])

    res.json({
      success: true,
      answer: userAnswer,
      wordCount: userAnswer.trim().split(/\s+/).length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error in /answer:", error)
    res.status(500).json({
      success: false,
      error: "Failed to process answer",
      message: error.message
    })
  }
})

// Keep the simple endpoint too
app.post("/ai", async (req, res) => {
  try {
    if (!ensureGeminiKey(res)) return

    const userMessage = req.body?.message
    if (!userMessage || typeof userMessage !== "string") {
      return res.status(400).json({ error: "Missing message" })
    }

    const result = await model.generateContent(userMessage)
    const text = result?.response?.text() || ""

    res.json({ reply: text })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "AI generation failed" })
  }
})

const PORT = Number(process.env.PORT) || 3001

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})