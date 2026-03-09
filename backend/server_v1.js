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
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
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

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Server is running",
    timestamp: new Date().toISOString(),
    openaiConfigured: !!process.env.OPENAI_API_KEY
  })
})

// Interview questions pool
const questions = [
  "Tell me about yourself.",
  "Why do you want this job?",
  "What are your strengths?",
  "Describe a challenging situation you handled.",
  "Where do you see yourself in 5 years?",
  "What are your weaknesses and how do you work on them?",
  "Tell me about a project you're proud of.",
  "How do you handle feedback?"
]

// AI feedback templates based on answer length and quality
const generateFeedback = (answer) => {
  if (!answer || answer.trim().length === 0) {
    return "Please provide a substantive answer to receive feedback."
  }

  const wordCount = answer.trim().split(/\s+/).length

  if (wordCount < 5) {
    return "Your answer is too brief. Try to provide more details, examples, and explain your reasoning."
  }

  if (wordCount < 20) {
    return "Good start! Try to add specific examples or achievements to make your answer stronger."
  }

  if (wordCount < 50) {
    return "Solid answer! Consider adding quantifiable results or outcomes to demonstrate impact."
  }

  return "Excellent response! You provided good details and examples. Keep maintaining this level of detail."
}

// Get a random interview question
app.get("/api", (req, res) => {
  try {
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)]

    console.log(`[${new Date().toISOString()}] Question served: ${randomQuestion}`)

    res.json({
      success: true,
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

// Speech to Text endpoint - converts audio to text using OpenAI Whisper
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

    // Use OpenAI Whisper to transcribe audio
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1"
    })

    // Clean up uploaded file
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

    // Clean up file on error
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

// Text to Speech endpoint - converts text to audio using OpenAI TTS
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

    // Use OpenAI TTS to generate speech
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text
    })

    // Convert to buffer
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

// Receive and analyze user's answer
app.post("/answer", (req, res) => {
  try {
    const userAnswer = req.body?.answer

    // Validate input
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

    // Generate feedback
    const feedback = generateFeedback(userAnswer)

    console.log(`[${new Date().toISOString()}] User answer received:`, userAnswer.substring(0, 100) + "...")
    console.log(`[${new Date().toISOString()}] Feedback generated:`, feedback)

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
      "GET /api",
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
  console.log(`   - GET  /api                (get random interview question)`)
  console.log(`   - POST /answer             (analyze user answer)`)
  console.log(`   - POST /speech-to-text     (convert audio to text via Whisper)`)
  console.log(`   - POST /text-to-speech     (convert text to audio)`)
  console.log(`🔗 CORS enabled for all origins`)
  console.log(`🔑 OpenAI configured: ${process.env.OPENAI_API_KEY ? "✅ Yes" : "❌ No"}`)
})
