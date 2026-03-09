const express = require("express")
const cors = require("cors")
const fs = require("fs")
const path = require("path")
const multer = require("multer")
require("dotenv").config()

const app = express()

// Initialize OpenAI only if API key is provided
let openai = null
if (process.env.OPENAI_API_KEY) {
  const OpenAI = require("openai")
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })
}

// Configure multer for audio file uploads
const upload = multer({
  dest: path.join(__dirname, "uploads"),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true)
    } else {
      cb(new Error("Only audio files are allowed"))
    }
  }
})

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads")
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Middleware
app.use(cors())
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ limit: "50mb" }))

// Interview questions organized by topic with progressive difficulty
const questionsByTopic = {
  behavioral: [
    "Tell me about yourself and your professional background.",
    "Describe a challenging situation you handled and how you resolved it.",
    "Give an example of when you failed and what you learned from it.",
    "Tell me about a time you worked in a team. What was your role?",
    "Describe a situation where you had to meet a tight deadline.",
    "How do you handle conflict with colleagues?"
  ],
  technical: [
    "What are the most important technical skills for your role?",
    "Explain a complex technical concept you understand well.",
    "Walk me through your approach to solving a difficult technical problem.",
    "How do you stay updated with new technologies and trends?",
    "Tell me about the most challenging technical project you've worked on.",
    "How do you debug code or troubleshoot issues?"
  ],
  motivation: [
    "Why do you want this job specifically?",
    "Where do you see yourself in 5 years?",
    "What motivates you in your work?",
    "Why are you leaving your current position?",
    "What are your career goals?",
    "What attracted you to our company?"
  ],
  strength: [
    "What are your greatest professional strengths?",
    "Tell me about a project where you made a significant impact.",
    "What achievement are you most proud of?",
    "How would your colleagues describe you?",
    "What unique value do you bring to a team?"
  ],
  weakness: [
    "What are your weaknesses and how do you address them?",
    "Tell me about a time you received critical feedback. How did you respond?",
    "What areas do you want to improve?",
    "How do you handle stress and pressure?",
    "What's a skill you're currently working to develop?"
  ],
  situational: [
    "If you had to choose between tight deadlines and quality, which would you prioritize?",
    "How would you handle a disagreement with your manager?",
    "If a colleague took credit for your work, what would you do?",
    "How do you prioritize when you have multiple urgent tasks?",
    "What would you do if you didn't know how to solve a problem?"
  ]
}

const topics = Object.keys(questionsByTopic)

// Critical AI feedback generator
const generateCriticalFeedback = (answer, topic) => {
  if (!answer || answer.trim().length === 0) {
    return "❌ **No answer provided.** This is a critical miss in interviews. Always engage with questions."
  }

  const wordCount = answer.trim().split(/\s+/).length
  const sentences = answer.trim().split(/[.!?]+/).filter(s => s.trim().length > 0)
  const hasExamples = /example|specifically|for instance|case|story|situation|time|project|worked on/i.test(answer)
  const hasMetrics = /\d+%|increased|improved|reduced|saved|\$|revenue|growth|efficiency|performance/i.test(answer)
  const hasAction = /did|took|implemented|created|led|developed|built|designed|managed|launched/i.test(answer)
  const hasReflection = /learned|realized|understand|appreciated|discovered|growth|improve/i.test(answer)

  const feedbacks = []

  // Length analysis
  if (wordCount < 10) {
    feedbacks.push("❌ **Way too brief.** You've given a one-liner. Interviewers need substance to evaluate you.")
  } else if (wordCount < 25) {
    feedbacks.push("⚠️ **Insufficient detail.** This sounds rehearsed and shallow. Elaborate with real context.")
  } else if (wordCount > 200) {
    feedbacks.push("⚠️ **You rambled.** Talking too much makes you seem unfocused. Show discipline in your communication.")
  } else {
    feedbacks.push("✅ Good length - professional and substantive.")
  }

  // Content analysis
  if (!hasExamples && wordCount > 15) {
    feedbacks.push("❌ **Zero concrete examples.** Interviews are about STORIES. 'Tell me a story' is rule #1. You failed it.")
  } else if (hasExamples) {
    feedbacks.push("✅ Good - you provided specific examples.")
  }

  if (!hasAction && wordCount > 15) {
    feedbacks.push("⚠️ **Passive voice detected.** You used 'we' instead of 'I'. Take ownership of YOUR actions.")
  } else if (hasAction) {
    feedbacks.push("✅ Strong ownership - clear action verbs.")
  }

  if (!hasMetrics && (topic === "strength" || topic === "behavioral" || topic === "technical")) {
    feedbacks.push("⚠️ **Missing metrics.** '30% improvement' is stronger than 'much better.' Quantify your impact.")
  } else if (hasMetrics) {
    feedbacks.push("✅ Strong - you used numbers to demonstrate impact.")
  }

  if (!hasReflection && (topic === "weakness" || topic === "behavioral")) {
    feedbacks.push("⚠️ **No growth mindset shown.** What did you learn? How did you improve?")
  } else if (hasReflection) {
    feedbacks.push("✅ Good - you showed self-awareness and growth.")
  }

  // Topic-specific critical feedback
  if (topic === "weakness") {
    if (/don't have|can't think|none|never|perfect|honestly i don't/i.test(answer)) {
      feedbacks.push("❌ **Red flag.** You're either dishonest or lack self-awareness. Candidates who claim perfection don't get hired.")
    }
    if (!/addressing|improving|working on|developing|overcoming/i.test(answer)) {
      feedbacks.push("❌ **Missing action plan.** Best answers show HOW you're actively improving. You just listed a weakness.")
    }
  }

  if (topic === "motivation") {
    if (/money|salary|benefits|paycheck|pay/i.test(answer)) {
      feedbacks.push("❌ **Career suicide.** Never lead with compensation. You just communicated: 'I only care about money.'")
    }
    if (/i don't know|not sure|maybe/i.test(answer)) {
      feedbacks.push("❌ **Lack of preparation.** You clearly didn't research the company. This is unacceptable.")
    }
    if (wordCount < 30) {
      feedbacks.push("❌ **Insufficient.** This should be your best answer. You're underselling yourself.")
    }
  }

  if (topic === "strength") {
    if (/i'm a hard worker|i'm a good person|i'm organized/i.test(answer)) {
      feedbacks.push("⚠️ **Generic clichés.** Every candidate says these. Be specific about what makes YOU different.")
    }
  }

  // Positive feedback
  if (hasExamples && hasAction && (hasMetrics || hasReflection) && wordCount >= 40 && wordCount <= 180) {
    feedbacks.push("✅ **Strong answer overall.** You combined storytelling with impact. This is competitive-level.")
  }

  return feedbacks.length > 0 
    ? feedbacks.join("\n\n") 
    : "⚠️ Acceptable but unremarkable. Add more specificity and strategic thinking."
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Server is running",
    timestamp: new Date().toISOString(),
    openaiConfigured: !!process.env.OPENAI_API_KEY
  })
})

// Get available topics
app.get("/topics", (req, res) => {
  try {
    res.json({
      success: true,
      topics: topics.map(t => ({
        id: t,
        name: t.charAt(0).toUpperCase() + t.slice(1),
        description: {
          behavioral: "Real-world situations and how you handled them",
          technical: "Your technical skills and problem-solving approach",
          motivation: "Your career goals and interest in the role",
          strength: "What makes you stand out",
          weakness: "Your growth areas and self-awareness",
          situational: "Hypothetical scenarios and decision-making"
        }[t],
        count: questionsByTopic[t].length
      })),
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error in /topics endpoint:", error)
    res.status(500).json({
      success: false,
      error: "Failed to retrieve topics",
      message: error.message
    })
  }
})

// Get a random question from a specific topic
app.get("/api/:topic", (req, res) => {
  try {
    const { topic } = req.params

    if (!questionsByTopic[topic]) {
      return res.status(400).json({
        success: false,
        error: "Invalid topic",
        message: `Topic must be one of: ${topics.join(", ")}`
      })
    }

    const questionsForTopic = questionsByTopic[topic]
    const randomQuestion = questionsForTopic[Math.floor(Math.random() * questionsForTopic.length)]

    console.log(`[${new Date().toISOString()}] Question served from ${topic}: ${randomQuestion}`)

    res.json({
      success: true,
      topic,
      question: randomQuestion,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error in /api/:topic endpoint:", error)
    res.status(500).json({
      success: false,
      error: "Failed to retrieve question",
      message: error.message
    })
  }
})

// Get a random interview question (fallback)
app.get("/api", (req, res) => {
  try {
    const randomTopic = topics[Math.floor(Math.random() * topics.length)]
    const questionsForTopic = questionsByTopic[randomTopic]
    const randomQuestion = questionsForTopic[Math.floor(Math.random() * questionsForTopic.length)]

    console.log(`[${new Date().toISOString()}] Question served: ${randomQuestion}`)

    res.json({
      success: true,
      topic: randomTopic,
      question: randomQuestion,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error in /api endpoint:", error)
    res.status(500).json({
      success: false,
      error: "Failed to retrieve question",
      message: error.message
    })
  }
})

// Speech to Text endpoint
app.post("/speech-to-text", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No audio file provided"
      })
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "OpenAI API key not configured"
      })
    }

    const audioPath = req.file.path
    const audioFile = fs.createReadStream(audioPath)

    console.log(`[${new Date().toISOString()}] Processing audio file: ${req.file.filename}`)

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1"
    })

    fs.unlink(audioPath, (err) => {
      if (err) console.error("Error deleting temp file:", err)
    })

    const text = transcription.text

    console.log(`[${new Date().toISOString()}] Transcribed text: ${text}`)

    res.json({
      success: true,
      text,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error in /speech-to-text endpoint:", error)

    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting temp file:", err)
      })
    }

    res.status(500).json({
      success: false,
      error: "Failed to transcribe audio",
      message: error.message
    })
  }
})

// Text to Speech endpoint
app.post("/text-to-speech", async (req, res) => {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "No text provided"
      })
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "OpenAI API key not configured"
      })
    }

    console.log(`[${new Date().toISOString()}] Converting text to speech: ${text.substring(0, 50)}...`)

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text
    })

    const buffer = await mp3.arrayBuffer()

    res.setHeader("Content-Type", "audio/mpeg")
    res.setHeader("Content-Length", buffer.byteLength)
    res.send(Buffer.from(buffer))

    console.log(`[${new Date().toISOString()}] Speech generated successfully`)
  } catch (error) {
    console.error("Error in /text-to-speech endpoint:", error)
    res.status(500).json({
      success: false,
      error: "Failed to generate speech",
      message: error.message
    })
  }
})

// Receive and analyze user's answer with critical feedback
app.post("/answer", (req, res) => {
  try {
    const userAnswer = req.body?.answer
    const topic = req.body?.topic

    if (!userAnswer) {
      return res.status(400).json({
        success: false,
        error: "Missing answer",
        message: "Please provide an answer in the request body."
      })
    }

    if (typeof userAnswer !== "string") {
      return res.status(400).json({
        success: false,
        error: "Invalid answer format",
        message: "Answer must be a string."
      })
    }

    // Generate critical feedback
    const feedback = generateCriticalFeedback(userAnswer, topic)

    console.log(`[${new Date().toISOString()}] User answer received:`, userAnswer.substring(0, 100) + "...")
    console.log(`[${new Date().toISOString()}] Critical feedback generated for topic: ${topic}`)

    res.json({
      success: true,
      feedback,
      wordCount: userAnswer.trim().split(/\s+/).length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error in /answer endpoint:", error)
    res.status(500).json({
      success: false,
      error: "Failed to process answer",
      message: error.message
    })
  }
})

// 404 error handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Not Found",
    message: `Route ${req.path} does not exist`,
    availableRoutes: [
      "GET /health",
      "GET /topics",
      "GET /api",
      "GET /api/:topic",
      "POST /answer",
      "POST /speech-to-text (with audio file)",
      "POST /text-to-speech (with text body)"
    ]
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err)
  res.status(500).json({
    success: false,
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong"
  })
})

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`)
  console.log(`📝 Available endpoints:`)
  console.log(`   - GET  /health             (health check)`)
  console.log(`   - GET  /topics             (get all topics)`)
  console.log(`   - GET  /api                (random question)`)
  console.log(`   - GET  /api/:topic         (question from topic)`)
  console.log(`   - POST /answer             (get critical feedback)`)
  console.log(`   - POST /speech-to-text     (convert audio to text via Whisper)`)
  console.log(`   - POST /text-to-speech     (convert text to audio)`)
  console.log(`🔗 CORS enabled for all origins`)
  console.log(`🔑 OpenAI configured: ${process.env.OPENAI_API_KEY ? "✅ Yes" : "❌ No"}`)
})
