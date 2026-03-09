import { useState, useRef, useEffect } from "react"
import "../styles/InterviewPage.css"

function InterviewPage({ topic, onEndInterview, onBack }) {
  const [messages, setMessages] = useState([
    {
      sender: "AI",
      text: `Welcome to the ${topic} interview! Let's get your first question.`
    }
  ])
  const [loading, setLoading] = useState(false)
  const [userInput, setUserInput] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [questionCount, setQuestionCount] = useState(0)
  const [sessionData, setSessionData] = useState([])
  const [pendingTranscript, setPendingTranscript] = useState(null)

  const recognitionRef = useRef(null)
  const recordingIntervalRef = useRef(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      console.warn("SpeechRecognition API is not supported in this browser.")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = "en-US"
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      if (!transcript || !transcript.trim()) return
      setMessages((prev) => [...prev, { sender: "You", text: transcript }])
      setPendingTranscript(transcript)
    }

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event)
      setIsRecording(false)
      clearInterval(recordingIntervalRef.current)
      setMessages((prev) => [
        ...prev,
        {
          sender: "AI",
          text:
            "Error: Speech recognition failed. Please check your microphone and try again."
        }
      ])
    }

    recognition.onend = () => {
      setIsRecording(false)
      clearInterval(recordingIntervalRef.current)
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null
        recognitionRef.current.onerror = null
        recognitionRef.current.onend = null
        recognitionRef.current = null
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // Load first question on mount (separate from hooks dependencies)
    const loadInitialQuestion = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/${topic}`)
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }

        const data = await res.json()
        const question = data.question || "What is your experience with this topic?"

        setMessages((prev) => [...prev, { sender: "AI", text: question }])
        setQuestionCount(1)
        await playTextAsAudio(question)
      } catch (error) {
        console.error("Error fetching initial question:", error)
        setMessages((prev) => [
          ...prev,
          {
            sender: "AI",
            text: "Error: Could not load the first question. Please try again."
          }
        ])
      } finally {
        setLoading(false)
      }
    }

    loadInitialQuestion()
  }, [topic])

  async function getQuestion() {
    setLoading(true)
    try {
      const res = await fetch(`/api/${topic}`)
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const data = await res.json()
      const question = data.question || "What is your experience with this topic?"

      setMessages((prev) => [...prev, { sender: "AI", text: question }])
      setQuestionCount((prev) => prev + 1)

      // Play question as speech
      await playTextAsAudio(question)
    } catch (error) {
      console.error("Error fetching question:", error)
      setMessages((prev) => [
        ...prev,
        {
          sender: "AI",
          text: "Error: Could not load question. Please try again."
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  async function startRecording() {
    if (!recognitionRef.current) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "AI",
          text:
            "Speech recognition is not supported in this browser. Please type your answer instead."
        }
      ])
      return
    }

    try {
      setIsRecording(true)
      setRecordingTime(0)

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)

      recognitionRef.current.start()
    } catch (error) {
      console.error("Error starting speech recognition:", error)
      setIsRecording(false)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
      setMessages((prev) => [
        ...prev,
        {
          sender: "AI",
          text:
            "Error: Could not start speech recognition. Please check microphone permissions."
        }
      ])
    }
  }

  function stopRecording() {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop()
      setIsRecording(false)
      clearInterval(recordingIntervalRef.current)
    }
  }

  async function playTextAsAudio(text) {
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = "en-US"
        window.speechSynthesis.speak(utterance)
        return
      }

      console.warn("speechSynthesis API is not supported in this browser.")
    } catch (error) {
      console.error("Error playing audio:", error)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  useEffect(() => {
    if (!pendingTranscript) return

    const process = async () => {
      await processAnswerText(pendingTranscript)
      setPendingTranscript(null)
    }

    process()
    // We intentionally only depend on pendingTranscript here to avoid
    // reinitializing recognition or changing its handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTranscript])

  async function processAnswerText(answerText) {
    if (!answerText || !answerText.trim()) return

    setLoading(true)

    try {
      const res = await fetch("/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ answer: answerText, topic })
      })

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const data = await res.json()

      if (data.success) {
        const feedback = data.feedback || "Thank you for your response."
        setMessages((prev) => [...prev, { sender: "AI", text: feedback }])

        // Store session data
        const newData = [
          ...sessionData,
          { question: "Q" + (questionCount + 1), answer: answerText, feedback }
        ]
        setSessionData(newData)

        await playTextAsAudio(feedback)
      } else {
        setMessages((prev) => [
          ...prev,
          { sender: "AI", text: `Error: ${data.message || "Failed to process answer"}` }
        ])
      }
    } catch (error) {
      console.error("Error sending answer:", error)
      setMessages((prev) => [
        ...prev,
        { sender: "AI", text: "Error: Could not process your answer." }
      ])
    } finally {
      setLoading(false)
    }
  }

  async function sendAnswer() {
    if (!userInput.trim()) return

    const text = userInput
    setUserInput("")
    setMessages((prev) => [...prev, { sender: "You", text }])
    await processAnswerText(text)
  }

  return (
    <div className="interview-page">
      <div className="interview-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <h1>Interview: {topic}</h1>
        <p className="question-counter">Question {questionCount}</p>
      </div>

      <div className="interview-container">
        <div className="chat-box">
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
                disabled={loading}
              >
                🎤 Start Recording
              </button>
            ) : (
              <button className="record-button recording" onClick={stopRecording}>
                ⏹ Stop ({formatTime(recordingTime)})
              </button>
            )}
            <button
              className="next-button"
              onClick={getQuestion}
              disabled={loading || isRecording}
            >
              ❓ Next Question
            </button>
          </div>

          <div className="input-group">
            <input
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Or type your answer here..."
              disabled={isRecording || loading}
            />
            <button
              onClick={sendAnswer}
              disabled={isRecording || !userInput.trim() || loading}
            >
              Send
            </button>
          </div>

          <div className="interview-actions">
            <button
              className="end-interview-button"
              onClick={() => onEndInterview(sessionData)}
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
