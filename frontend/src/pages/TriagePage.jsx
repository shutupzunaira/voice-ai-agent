import { useState, useRef, useEffect, useCallback } from "react"
import "../styles/TriagePage.css"

function TriagePage({ onEndSession, onBack }) {
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [userInput, setUserInput] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [triageLevel, setTriageLevel] = useState("UNCLEAR")

  const recognitionRef = useRef(null)
  const recordingIntervalRef = useRef(null)
  const fullTranscriptRef = useRef("")
  const chatBoxRef = useRef(null)

  /* ─── Helpers ─── */
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

  /* ─── TTS (Text-to-Speech) ─── */
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

  /* ─── Speech Recognition Setup ─── */
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn("🔇 Speech Recognition API not supported in this browser")
      return
    }

    recognitionRef.current = new SpeechRecognition()
    recognitionRef.current.continuous = false
    recognitionRef.current.interimResults = true
    recognitionRef.current.lang = "en-US"

    recognitionRef.current.onstart = () => {
      fullTranscriptRef.current = ""
    }

    recognitionRef.current.onresult = (event) => {
      let interimTranscript = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          fullTranscriptRef.current += transcript + " "
        } else {
          interimTranscript += transcript
        }
      }
      setUserInput(fullTranscriptRef.current || interimTranscript)
    }

    recognitionRef.current.onerror = (event) => {
      if (event.error === "not-allowed") {
        console.warn("🎤 Microphone permission denied. Please enable in browser settings.")
      } else {
        console.warn("🔇 Speech recognition error:", event.error)
      }
    }

    recognitionRef.current.onend = () => {
      setIsRecording(false)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  /* ─── Start Recording ─── */
  function handleRecordingStart() {
    if (recognitionRef.current && !isRecording) {
      setIsRecording(true)
      setRecordingTime(0)
      recognitionRef.current.start()

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1)
      }, 1000)
    }
  }

  /* ─── Stop Recording ─── */
  function handleRecordingStop() {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop()
      setIsRecording(false)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }

  /* ─── Initialize Triage Session ─── */
  async function initializeTriageSession() {
    try {
      setLoading(true)
      const res = await fetch("/api/triage/start", { method: "POST" })
      const data = await res.json()
      if (data.success) {
        setSessionId(data.sessionId)
        addMessage("assistant", data.message)
        await speak(data.message)

        // Fetch initial triage question
        const qRes = await fetch(`/api/triage/initial-question?sessionId=${data.sessionId}`)
        const qData = await qRes.json()
        if (qData.success) {
          addMessage("assistant", qData.question)
          await speak(qData.question)
        }
      }
    } catch (error) {
      console.error("Error initializing session:", error)
      addMessage("assistant", "Error starting session. Please try again.")
    } finally {
      setLoading(false)
      scrollToBottom()
    }
  }

  /* ─── Submit Answer ─── */
  async function submitAnswer() {
    if (!userInput.trim() || !sessionId) return

    setLoading(true)
    addMessage("patient", userInput)
    setUserInput("")

    try {
      const res = await fetch("/api/triage/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userAnswer: userInput })
      })

      const data = await res.json()
      if (data.success) {
        if (data.triageLevel) setTriageLevel(data.triageLevel)

        if (data.nextAction === "escalate_emergency") {
          addMessage("assistant", data.message)
          await speak(data.message)
          // Show emergency action needed
          setTriageLevel("EMERGENCY")
        } else {
          // Continue with triage
          addMessage("assistant", "Thank you for that information. Let me ask another question...")
          await speak("Thank you. Let me ask another question...")
        }
      }
    } catch (error) {
      console.error("Error submitting answer:", error)
      addMessage("assistant", "Error processing your response. Please try again.")
    } finally {
      setLoading(false)
      scrollToBottom()
    }
  }

  /* ─── Initialize on Mount ─── */
  useEffect(() => {
    if (!sessionId) {
      initializeTriageSession()
    }
  }, [])

  return (
    <div className="triage-container">
      {/* Header ─── */}
      <div className="triage-header">
        <button className="back-button" onClick={onBack} title="Return to home">
          ← Back
        </button>
        <div className="header-content">
          <h1>🏥 CliniQ Medical Triage</h1>
          <p>Professional Health Evaluation & Care Routing</p>
        </div>
        <div className="status-bar">
          <span className={`triage-level triage-level-${triageLevel.toLowerCase()}`}>
            {triageLevel || "Assessing..."}
          </span>
          {sessionId && <span className="session-id">Session: {sessionId.slice(0, 8)}...</span>}
        </div>
      </div>

      {/* Chat Area ─── */}
      <div className="chat-box" ref={chatBoxRef}>
        {messages.length === 0 ? (
          <div className="welcome-message">
            <p>👋 Welcome to Virtual Clinic intake. I'm here to help assess your health concern and get you the appropriate care level.</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`message message-${msg.sender}`}>
              <div className="message-avatar">
                {msg.sender === "assistant" ? "🏥" : "👤"}
              </div>
              <div className="message-content">
                <p>{msg.text}</p>
              </div>
            </div>
          ))
        )}

        {isSpeaking && (
          <div className="message message-assistant">
            <div className="message-avatar">🏥</div>
            <div className="message-content">
              <p>
                <span className="speaking-indicator">
                  <span></span><span></span><span></span>
                </span>
                Listening to response...
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="message message-assistant">
            <div className="message-avatar">🏥</div>
            <div className="message-content">
              <p>
                <span className="loading-dots">
                  <span></span><span></span><span></span>
                </span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Input Section ─── */}
      {triageLevel !== "EMERGENCY" && (
        <div className="input-section">
          {/* Recording Buttons ─── */}
          <div className="recording-controls">
            {!isRecording ? (
              <button
                className="btn btn-primary"
                onClick={handleRecordingStart}
                disabled={loading || isSpeaking}
                title="Click to start recording your response (must allow microphone)"
              >
                🎤 Start Speaking
              </button>
            ) : (
              <button
                className="btn btn-danger recording-active"
                onClick={handleRecordingStop}
                title="Click to stop recording"
              >
                ⏹️ Stop ({recordingTime}s)
              </button>
            )}
          </div>

          {/* Text Input ─── */}
          <div className="text-input-group">
            <input
              type="text"
              className="text-input"
              placeholder="Or type your response here..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  submitAnswer()
                }
              }}
              disabled={loading || isRecording}
            />
            <button
              className="btn btn-submit"
              onClick={submitAnswer}
              disabled={!userInput.trim() || loading}
            >
              Send
            </button>
          </div>

          {/* Recording Transcript ─── */}
          {isRecording && (
            <div className="recording-status">
              🎙️ Recording... {recordingTime}s
            </div>
          )}
        </div>
      )}

      {/* Emergency Section ─── */}
      {triageLevel === "EMERGENCY" && (
        <div className="emergency-alert">
          <h2>🚨 Emergency Situation Detected</h2>
          <p>Based on your responses, you may need immediate medical attention.</p>
          <div className="emergency-actions">
            <button className="btn btn-danger btn-large">
              📞 Call Emergency Services (911)
            </button>
            <button className="btn btn-danger btn-outline btn-large">
              🏥 Go to Nearest ER Immediately
            </button>
          </div>
          <button className="btn btn-secondary" onClick={onBack}>
            ← Back to Menu
          </button>
        </div>
      )}

      {/* Footer ─── */}
      <div className="triage-footer">
        <small>Your health information is kept confidential. If you need immediate help, please call 911 or visit your nearest emergency room.</small>
      </div>
    </div>
  )
}

export default TriagePage
