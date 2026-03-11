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

  function speak(text) {
    return new Promise((resolve) => {
      try {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          resolve()
          return
        }
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = "en-US"
        utterance.rate = 1.0
        utterance.onstart = () => setIsSpeaking(true)
        utterance.onend = () => { setIsSpeaking(false); resolve() }
        utterance.onerror = () => { setIsSpeaking(false); resolve() }
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
    const res = await fetch("/api/greeting")
    const data = await res.json()
    return data.greeting || "Hey there! Let's begin your interview."
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
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = (result?.[0]?.transcript || "").trim()
        if (!text) continue
        if (result.isFinal) finalText += (finalText ? " " : "") + text
      }
      if (finalText) {
        fullTranscriptRef.current += (fullTranscriptRef.current ? " " : "") + finalText
      }
    }

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error)
      // Don't stop on no-speech errors, just keep going
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setIsRecording(false)
        clearInterval(recordingIntervalRef.current)
      }
    }

    recognition.onend = () => {
      // Auto-restart if still recording (browser may stop after silence)
      if (recognitionRef.current?._keepAlive) {
        try { recognition.start() } catch { /* ignore */ }
      }
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current._keepAlive = false
        recognitionRef.current.onresult = null
        recognitionRef.current.onerror = null
        recognitionRef.current.onend = null
        try { recognitionRef.current.stop() } catch { /* ignore */ }
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

        // Fetch first question
        const { question, questionNumber } = await apiNextQuestion()
        setQuestionCount(questionNumber)
        addMessage("AI", question)
        scrollToBottom()
        await speak(question)
        setSessionStarted(true)
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
      addMessage("AI", "Could not start speech recognition. Please check microphone permissions.")
    }
  }

  async function stopRecording() {
    if (!recognitionRef.current) return

    recognitionRef.current._keepAlive = false
    try { recognitionRef.current.stop() } catch { /* ignore */ }
    setIsRecording(false)
    clearInterval(recordingIntervalRef.current)

    // Wait a moment for final results
    await new Promise((r) => setTimeout(r, 300))

    const transcript = fullTranscriptRef.current.trim()
    if (!transcript) {
      addMessage("AI", "I didn't catch that. Could you try again?")
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
      await apiPostAnswer(answerText)
      const { question, questionNumber } = await apiNextQuestion()
      setQuestionCount(questionNumber)
      addMessage("AI", question)
      scrollToBottom()
      await speak(question)
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
        <h1>TalkScout Interview</h1>
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

          <div className="input-group">
            <input
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTypedAnswer() } }}
              placeholder="Or type your answer here..."
              disabled={isRecording || loading}
            />
            <button
              onClick={sendTypedAnswer}
              disabled={isRecording || !userInput.trim() || loading}
            >
              Send
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
