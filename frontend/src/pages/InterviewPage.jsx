import { useState, useRef, useEffect, useCallback } from "react"
import "../styles/InterviewPage.css"

function InterviewPage({ topic = "general", onEndInterview, onBack }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [userInput, setUserInput] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [questionCount, setQuestionCount] = useState(0)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const recognitionRef = useRef(null)
  const recordingIntervalRef = useRef(null)
  const fullTranscriptRef = useRef("")
  const chatBoxRef = useRef(null)
  const silenceTimeoutRef = useRef(null)

  /* ─── helpers ─── */
  const addMessage = useCallback((sender, text) => {
    setMessages((prev) => [...prev, { sender, text }])
  }, [])

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (chatBoxRef.current) {
        chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight
      }
    }, 50)
  }, [])

  /* ─── TTS ─── */
  function stopSpeaking() {
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
    } catch { /* ignore */ }
    setIsSpeaking(false)
  }

  function pauseListening() {
    if (recognitionRef.current && recognitionRef.current._keepAlive) {
      try {
        recognitionRef.current.stop()
      } catch { /* ignore */ }
    }
  }

  function speak(text) {
    return new Promise((resolve) => {
      try {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          resolve()
          return
        }
        window.speechSynthesis.cancel()
        
        // DO NOT pause listening - keep listening even while AI speaks
        // User can interrupt anytime
        
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = "en-US"
        utterance.rate = 1.0
        utterance.onstart = () => setIsSpeaking(true)
        utterance.onend = () => { 
          setIsSpeaking(false)
          resolve() 
        }
        utterance.onerror = () => { 
          setIsSpeaking(false)
          resolve() 
        }
        window.speechSynthesis.speak(utterance)
      } catch {
        setIsSpeaking(false)
        resolve()
      }
    })
  }

  /* ─── API calls ─── */
  async function apiStartSession() {
    const res = await fetch("/api/start-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic })
    })
    return res.json()
  }

  async function apiGetGreeting() {
    return "Hey, what is your emergency?"
  }

  async function apiNextQuestion() {
    const res = await fetch("/api/next-question")
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error(data?.message || data?.error || "Failed to get question")
    return { question: data.question, questionNumber: data.questionNumber }
  }

  async function apiSkipQuestion() {
    const res = await fetch("/api/skip-question", { method: "POST" })
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error(data?.message || data?.error || "Failed to skip question")
    return { question: data.question, questionNumber: data.questionNumber }
  }

  async function apiPostAnswer(answer) {
    const res = await fetch("/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer })
    })
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error(data?.message || data?.error || "Failed to save answer")
    return data
  }

  async function apiFeedback() {
    const res = await fetch("/api/feedback")
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error(data?.message || data?.error || "Failed to get feedback")
    return data
  }

  /* ─── Detect Appointment Booking Request ─── */
  function detectAppointmentRequest(text) {
    const lower = text.toLowerCase()
    const bookingPatterns = [
      /book.*appointment/i,
      /schedule.*appointment/i,
      /make.*appointment/i,
      /need.*appointment/i,
      /want.*appointment/i,
      /can i.*appointment/i,
      /i.*need.*to.*see/i
    ]
    return bookingPatterns.some(p => p.test(lower))
  }

  /* ─── Save Appointment from Assessment ─── */
  async function saveAssessmentAppointment(patientAnswer) {
    try {
      const appointmentData = {
        patientName: "Assessment Interview Patient",
        phoneNumber: "assessment-portal",
        doctorSpecialization: "General Practice",
        preferredDate: new Date().toISOString().split('T')[0],
        preferredTime: "09:00",
        reasonForVisit: patientAnswer.substring(0, 100),
        status: "assessment-requested",
        source: "general-assessment-portal"
      }

      const res = await fetch("/api/patient/book-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appointmentData)
      })

      if (res.ok) {
        const data = await res.json()
        console.log("✅ Appointment saved from assessment:", data)
        addMessage("AI", "I've recorded your appointment request. You can view and confirm it in the Book Appointment section.")
        return true
      } else {
        console.warn("⚠️ Could not save appointment:", await res.text())
        return false
      }
    } catch (error) {
      console.error("❌ Error saving appointment:", error)
      return false
    }
  }

  /* ─── Speech Recognition setup ─── */
  useEffect(() => {
    if (typeof window === "undefined") return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition API not supported")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = "en-US"
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let finalText = ""
      // Only process results if user actively clicked record
      if (!recognitionRef.current?._keepAlive) {
        return
      }

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = (result?.[0]?.transcript || "").trim()
        if (!text) continue
        if (result.isFinal) finalText += (finalText ? " " : "") + text
      }
      if (finalText) {
        fullTranscriptRef.current += (fullTranscriptRef.current ? " " : "") + finalText
        setUserInput(finalText)
        // If AI is speaking, stop it immediately when user speaks (user interruption)
        if (isSpeaking) {
          console.log("🎙️ User interrupted AI - stopping speaking and listening")
          stopSpeaking()
        }
        // Reset and restart 2-second silence timeout when user speaks
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current)
        }
        silenceTimeoutRef.current = setTimeout(() => {
          if (recognitionRef.current?._keepAlive && fullTranscriptRef.current.trim()) {
            console.log("2-second silence detected, stopping recording")
            stopRecording()
          }
        }, 2000)
      }
    }

    recognition.onerror = (event) => {
      // Only log errors, don't auto-restart
      console.error("Speech recognition error:", event.error)
      // User intervention needed - don't auto-restart
      if (event.error !== "aborted" && event.error !== "no-speech") {
        setIsRecording(false)
        clearInterval(recordingIntervalRef.current)
      }
    }

    recognition.onend = () => {
      // Only restart if user actively clicked record
      if (recognitionRef.current?._keepAlive) {
        try {
          setTimeout(() => {
            try { recognition.start() } catch { /* ignore */ }
          }, 100)
        } catch { /* ignore */ }
      }
      // Clear timeout on end
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
      }
    }

    recognitionRef.current = recognition

    return () => {
      // Stop TTS when component unmounts (back button)
      stopSpeaking()
      
      // Stop all recognition
      if (recognitionRef.current) {
        recognitionRef.current._keepAlive = false
        recognitionRef.current.onresult = null
        recognitionRef.current.onerror = null
        recognitionRef.current.onend = null
        try { recognitionRef.current.abort() } catch { /* ignore */ }
        recognitionRef.current = null
      }
      clearInterval(recordingIntervalRef.current)
    }
  }, [])

  /* ─── Initialize session ─── */
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true)
        await apiStartSession()
        const greeting = await apiGetGreeting()
        addMessage("AI", greeting)
        scrollToBottom()
        await speak(greeting)
        setSessionStarted(true)
        
        // Auto-start recording so AI is always listening
        setTimeout(() => {
          startRecording()
        }, 500)
      } catch (error) {
        console.error("Init error:", error)
        addMessage("AI", `Error starting session: ${error.message}`)
      } finally {
        setLoading(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic])

  /* ─── Recording controls ─── */
  function startRecording() {
    if (!recognitionRef.current) {
      addMessage("AI", "Speech recognition is not supported in this browser. Please type your answer instead.")
      return
    }

    // Stop TTS immediately when user starts recording
    stopSpeaking()

    fullTranscriptRef.current = ""
    setIsRecording(true)
    setRecordingTime(0)

    recordingIntervalRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1)
    }, 1000)

    try {
      recognitionRef.current._keepAlive = true
      recognitionRef.current.start()
    } catch (error) {
      console.error("Error starting recognition:", error)
      setIsRecording(false)
      clearInterval(recordingIntervalRef.current)
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
      }
      addMessage("AI", "Could not start speech recognition. Please check microphone permissions.")
    }
  }

  async function stopRecording() {
    if (!recognitionRef.current) return

    recognitionRef.current._keepAlive = false
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
    }
    try { recognitionRef.current.stop() } catch { /* ignore */ }
    setIsRecording(false)
    clearInterval(recordingIntervalRef.current)

    // Wait a moment for final results
    await new Promise((r) => setTimeout(r, 300))

    const transcript = fullTranscriptRef.current.trim()
    if (!transcript) {
      // If no transcript, restart recording to keep listening
      setTimeout(() => {
        startRecording()
      }, 300)
      return
    }

    // Show user's answer and process it
    addMessage("You", transcript)
    scrollToBottom()
    await processAnswer(transcript)
  }

  /* ─── Process answer → post to backend → get next question ─── */
  async function processAnswer(answerText) {
    if (!answerText?.trim()) return
    setLoading(true)
    try {
      // Check if user is asking to book appointment
      if (detectAppointmentRequest(answerText)) {
        console.log("📅 Appointment booking request detected")
        await saveAssessmentAppointment(answerText)
      }

      await apiPostAnswer(answerText)
      
      // Minimal delay before AI responds (user had 2 seconds of silence, respond quickly)
      await new Promise((r) => setTimeout(r, 500))
      
      const { question, questionNumber } = await apiNextQuestion()
      setQuestionCount(questionNumber)
      addMessage("AI", question)
      scrollToBottom()
      await speak(question)
      
      // Auto-restart recording so AI keeps listening
      setTimeout(() => {
        startRecording()
      }, 500)
    } catch (error) {
      console.error("Error processing answer:", error)
      addMessage("AI", `Error: ${error.message || "Could not process your answer."}`)
    } finally {
      setLoading(false)
    }
  }

  /* ─── Type + send answer ─── */
  async function sendTypedAnswer() {
    if (!userInput.trim()) return
    const text = userInput.trim()
    setUserInput("")
    stopSpeaking()
    addMessage("You", text)
    scrollToBottom()
    await processAnswer(text)
  }

  /* ─── Skip / Next question ─── */
  async function handleSkipQuestion() {
    setLoading(true)
    stopSpeaking()
    try {
      const { question, questionNumber } = await apiSkipQuestion()
      setQuestionCount(questionNumber)
      addMessage("AI", `(Previous question skipped)\n${question}`)
      scrollToBottom()
      await speak(question)
    } catch (error) {
      console.error("Error skipping:", error)
      addMessage("AI", `Error: ${error.message || "Could not skip question."}`)
    } finally {
      setLoading(false)
    }
  }

  /* ─── View Feedback & Exit ─── */
  async function handleViewFeedback() {
    setLoading(true)
    stopSpeaking()
    try {
      const data = await apiFeedback()
      onEndInterview({ feedback: data.feedback, stats: data.stats })
    } catch (error) {
      console.error("Error getting feedback:", error)
      addMessage("AI", `Error getting feedback: ${error.message}`)
      setLoading(false)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  /* ─── Render ─── */
  return (
    <div className="interview-page">
      <div className="interview-header">
        <button className="back-button" onClick={() => { stopSpeaking(); onBack() }}>
          ← Back
        </button>
        <h1>🏥 CliniQ Medical Triage</h1>
        <p className="subtitle"><strong>General Health Assessment</strong></p>
        <p className="question-counter">Question {questionCount}</p>
      </div>

      <div className="interview-container">
        <div className="chat-box" ref={chatBoxRef}>
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.sender === "AI" ? "ai-message" : "user-message"}`}
            >
              <strong>{msg.sender}:</strong> {msg.text}
            </div>
          ))}
          {loading && <p className="loading">TalkScout is thinking...</p>}
        </div>

        <div className="interview-controls">
          <div className="button-group">
            {!isRecording ? (
              <button
                className="record-button"
                onClick={startRecording}
                disabled={loading || !sessionStarted}
              >
                🎤 Start Recording
              </button>
            ) : (
              <button className="record-button recording" onClick={stopRecording}>
                ⏹ Stop Recording ({formatTime(recordingTime)})
              </button>
            )}

            {isSpeaking && (
              <button className="stop-voice-button" onClick={stopSpeaking}>
                🔇 Stop AI Voice
              </button>
            )}

            <button
              className="next-button"
              onClick={handleSkipQuestion}
              disabled={loading || isRecording}
            >
              ⏭ Next Question
            </button>
          </div>

          <div className="interview-actions">
            <button
              className="end-interview-button"
              onClick={handleViewFeedback}
              disabled={loading || isRecording}
            >
              📊 View Feedback & Exit
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InterviewPage
