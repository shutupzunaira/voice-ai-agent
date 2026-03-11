const express = require("express")
const cors = require("cors")
require("dotenv").config()

const app = express()
app.use(cors())
app.use(express.json({ limit: "10mb" }))

/* ─────────────── API keys check ─────────────── */
const GEMINI_KEY = process.env.GEMINI_API_KEY || ""
const OPENAI_KEY = process.env.OPENAI_API_KEY || ""

if (!GEMINI_KEY && !OPENAI_KEY) {
  console.warn("⚠️  Neither GEMINI_API_KEY nor OPENAI_API_KEY is set. AI features will not work.")
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash"

/* ─────────────── Gemini client (lazy) ─────────────── */
let aiClientPromise = null
async function getGeminiClient() {
  if (!GEMINI_KEY) return null
  if (aiClientPromise) return aiClientPromise
  aiClientPromise = (async () => {
    const { GoogleGenAI } = await import("@google/genai")
    return new GoogleGenAI({ apiKey: GEMINI_KEY })
  })()
  return aiClientPromise
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
    throw new Error(`OpenAI fallback failed (${res.status}): ${errText.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ""
}

/* ─────────────── Generate with Gemini, fallback to OpenAI ─────────────── */
async function generateText(contents) {
  // Try Gemini first
  if (GEMINI_KEY) {
    try {
      const ai = await getGeminiClient()
      const result = await ai.models.generateContent({ model: GEMINI_MODEL, contents })
      const text = (result?.text || "").trim()
      if (text) return text
    } catch (err) {
      console.error("Gemini error, falling back to OpenAI:", err.message)
    }
  }

  // Fallback: convert Gemini-style contents to OpenAI messages
  if (OPENAI_KEY) {
    const messages = contents.map((c) => ({
      role: c.role === "model" ? "assistant" : "user",
      content: c.parts?.map((p) => p.text).join("\n") || ""
    }))
    return await openaiChat(messages)
  }

  throw new Error("No AI provider available")
}

/* ─────────────── In-memory conversation state ─────────────── */
let conversationHistory = []
let currentTopic = "general"
let questionCount = 0
let sessionQA = [] // { question, answer } pairs for feedback

const AVAILABLE_TOPICS = [
  { id: "behavioral", name: "Behavioral" },
  { id: "technical", name: "Technical" },
  { id: "leadership", name: "Leadership" },
  { id: "communication", name: "Communication" },
  { id: "product", name: "Product / PM" },
  { id: "systemDesign", name: "System Design" },
  { id: "hr", name: "HR / Culture Fit" }
]

const topicDisplayName = (id) => {
  const t = AVAILABLE_TOPICS.find((x) => x.id === id)
  return t ? t.name : id
}

function resetConversation(topicId) {
  currentTopic = topicId || "general"
  questionCount = 0
  sessionQA = []

  const topicLine =
    currentTopic === "general" ? "" : `The interview topic is: ${topicDisplayName(currentTopic)}. `

  conversationHistory = [
    {
      role: "user",
      parts: [
        {
          text:
            "You are an AI interviewer conducting a professional interview. " +
            topicLine +
            "Ask thoughtful, progressive interview questions one at a time. " +
            "Each next question should adapt to the candidate's previous answers. " +
            "Do NOT reveal or pre-plan a list of future questions. " +
            "Avoid repeating questions. " +
            "Output ONLY the next question text — no labels, no bullets, no numbering. " +
            "Keep each question to 1–2 crisp sentences."
        }
      ]
    }
  ]
}

function hasAnyKey() {
  return !!(GEMINI_KEY || OPENAI_KEY)
}

function ensureAnyKey(res) {
  if (!hasAnyKey()) {
    res.status(500).json({ success: false, error: "No AI API key configured (GEMINI_API_KEY or OPENAI_API_KEY)" })
    return false
  }
  return true
}

/* ─────────────── Routes ─────────────── */
app.get("/", (req, res) => res.send("TalkScout AI Backend Running"))

app.get("/health", (req, res) => {
  res.json({
    status: "Server is running",
    timestamp: new Date().toISOString(),
    geminiConfigured: !!GEMINI_KEY,
    openaiConfigured: !!OPENAI_KEY
  })
})

app.get("/topics", (req, res) => {
  res.json({ success: true, topics: AVAILABLE_TOPICS, timestamp: new Date().toISOString() })
})

/* ── Start / reset session ── */
app.post("/api/start-session", (req, res) => {
  try {
    const topic = req.body?.topic
    const valid = AVAILABLE_TOPICS.some((t) => t.id === topic)
    resetConversation(valid ? topic : "general")
    res.json({ success: true, topic: currentTopic, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error("Error in /api/start-session:", error)
    res.status(500).json({ success: false, error: "Failed to start session", message: error.message })
  }
})

/* ── Greeting ── */
app.get("/api/greeting", (req, res) => {
  const name = topicDisplayName(currentTopic)
  const greeting =
    `Hey there! I am here to take your ${name} interview. ` +
    `Tell me, are you ready to begin?`
  res.json({ success: true, greeting })
})

/* ── Next question ── */
app.get("/api/next-question", async (req, res) => {
  try {
    if (!ensureAnyKey(res)) return

    const contents = conversationHistory.concat([
      { role: "user", parts: [{ text: "Ask the next interview question now." }] }
    ])

    const question = await generateText(contents)

    if (!question) {
      return res.status(500).json({ success: false, error: "Empty response from model" })
    }

    conversationHistory.push({ role: "user", parts: [{ text: "Ask the next interview question now." }] })
    conversationHistory.push({ role: "model", parts: [{ text: question }] })
    questionCount++

    sessionQA.push({ question, answer: null })

    res.json({ success: true, question, questionNumber: questionCount, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error("Error generating question:", error)
    res.status(500).json({ success: false, error: "Failed to generate question", message: error.message })
  }
})

/* ── Skip question (next without answer) ── */
app.post("/api/skip-question", async (req, res) => {
  try {
    if (!ensureAnyKey(res)) return

    if (sessionQA.length > 0 && sessionQA[sessionQA.length - 1].answer === null) {
      sessionQA[sessionQA.length - 1].answer = "[SKIPPED]"
    }

    conversationHistory.push({
      role: "user",
      parts: [{ text: "The candidate chose to skip this question. Ask a different interview question now." }]
    })

    const question = await generateText(conversationHistory)

    if (!question) {
      return res.status(500).json({ success: false, error: "Empty response from model" })
    }

    conversationHistory.push({ role: "model", parts: [{ text: question }] })
    questionCount++
    sessionQA.push({ question, answer: null })

    res.json({ success: true, question, questionNumber: questionCount, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error("Error skipping question:", error)
    res.status(500).json({ success: false, error: "Failed to skip question", message: error.message })
  }
})

/* ── Submit answer ── */
app.post("/answer", (req, res) => {
  try {
    const userAnswer = req.body?.answer
    if (!userAnswer || typeof userAnswer !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid answer" })
    }

    conversationHistory.push({ role: "user", parts: [{ text: userAnswer }] })

    if (sessionQA.length > 0 && sessionQA[sessionQA.length - 1].answer === null) {
      sessionQA[sessionQA.length - 1].answer = userAnswer
    }

    res.json({
      success: true,
      answer: userAnswer,
      wordCount: userAnswer.trim().split(/\s+/).length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error in /answer:", error)
    res.status(500).json({ success: false, error: "Failed to process answer", message: error.message })
  }
})

/* ── Comprehensive interview feedback ── */
app.get("/api/feedback", async (req, res) => {
  try {
    if (!ensureAnyKey(res)) return

    const answered = sessionQA.filter((qa) => qa.answer && qa.answer !== "[SKIPPED]")
    const skipped = sessionQA.filter((qa) => qa.answer === "[SKIPPED]")

    if (answered.length === 0) {
      return res.json({
        success: true,
        feedback: "No answers were provided during this interview, so there is no feedback to give. Try answering some questions next time!",
        stats: { totalQuestions: sessionQA.length, answered: 0, skipped: skipped.length }
      })
    }

    const qaPairs = sessionQA
      .map((qa, i) => {
        const ans = qa.answer === "[SKIPPED]" ? "(Skipped)" : qa.answer || "(No answer)"
        return `Q${i + 1}: ${qa.question}\nA${i + 1}: ${ans}`
      })
      .join("\n\n")

    const feedbackPrompt = [
      {
        role: "user",
        parts: [
          {
            text:
              `You are an expert interview coach. The candidate just finished a ${topicDisplayName(currentTopic)} interview. ` +
              `Below are the questions and their answers.\n\n${qaPairs}\n\n` +
              `Please provide a comprehensive, structured feedback report:\n` +
              `1. Overall Performance (score out of 10 and brief summary)\n` +
              `2. Strengths (bullet points)\n` +
              `3. Areas for Improvement (bullet points)\n` +
              `4. Question-by-question brief feedback\n` +
              `5. Tips for next time\n\n` +
              `Be encouraging but honest. Keep it concise and actionable.`
          }
        ]
      }
    ]

    const feedback = await generateText(feedbackPrompt)

    res.json({
      success: true,
      feedback: feedback || "Could not generate feedback at this time.",
      stats: {
        totalQuestions: sessionQA.length,
        answered: answered.length,
        skipped: skipped.length,
        topic: topicDisplayName(currentTopic)
      }
    })
  } catch (error) {
    console.error("Error generating feedback:", error)
    res.status(500).json({ success: false, error: "Failed to generate feedback", message: error.message })
  }
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

/* ─────────────── Start ─────────────── */
const PORT = Number(process.env.PORT) || 3001
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`  Gemini: ${GEMINI_KEY ? "✅ configured" : "❌ not set"}`)
  console.log(`  OpenAI: ${OPENAI_KEY ? "✅ configured" : "❌ not set"}`)
})